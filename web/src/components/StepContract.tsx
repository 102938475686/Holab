import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Camera, ClipboardList, FlaskConical, Lock, ShieldAlert, Sparkles, UploadCloud } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { analyzeContract, judgeContract, type Analysis, type JudgeContractReply } from '@/lib/api'
import { MIN_WAGE, WEEKS_PER_MONTH, won } from '@/lib/calc'
import JudgmentCard, { type JudgmentChip } from '@/components/JudgmentCard'
import LegalIssues from '@/components/LegalIssues'
import { calcIssues, clauseIssues, dedupeIssues } from '@/lib/legal'
import { maskText } from '@/lib/mask'
import { SAMPLES, makeSampleImage } from '@/lib/sample'
import { StepFooter } from '@/components/StepFooter'
import { useStore } from '@/store'

const SEV: Record<string, { label: string; cls: string }> = {
  high: { label: '⚠ 위험', cls: 'bg-red-700 text-white' },
  medium: { label: '⚠ 주의', cls: 'bg-amber-700 text-white' },
  low: { label: 'ⓘ 참고', cls: 'bg-slate-600 text-white' },
}

// 확실성 표기: AI의 판단이 어느 정도 근거에 기댄 것인지 사용자가 구분할 수 있게 함
const CERTAINTY: Record<string, string> = {
  high: '확실성: 계약서에 적힌 문구가 법 조문과 직접 어긋나요(위반). 그래도 최종 판단은 전문가와 확인하세요.',
  medium: '확실성: 상황에 따라 달라질 수 있어요. 실제 근무 방식을 함께 확인해야 해요.',
  low: '확실성: 참고용 의견이에요. 문제가 아닐 수도 있어요.',
}

// OCR 전처리: 휴대폰 사진은 글자가 작고 회색 배경·그림자가 있어 인식률이 떨어짐.
// 글자가 충분히 커지게 확대(가로 1,800px 이상) → 흑백 → 밝기 범위를 늘려 대비를 높임. 모두 브라우저 안에서 처리.
async function prepImage(src: string): Promise<string> {
  const img = new Image()
  img.src = src
  await img.decode()
  const scale = Math.min(3, Math.max(1, 1800 / img.naturalWidth))
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return src
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h)
  const px = d.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114)
    px[i] = px[i + 1] = px[i + 2] = g
  }
  // 그림자 제거: 크게 흐린 사본(=종이 배경 밝기)으로 나눠서 어두운 부분의 글자도 살림.
  // canvas filter를 지원하지 않는 브라우저(구형 Safari 등)에서는 이 단계만 건너뜀.
  const bgCv = document.createElement('canvas')
  bgCv.width = w; bgCv.height = h
  const bg = bgCv.getContext('2d', { willReadFrequently: true })
  if (bg && typeof bg.filter === 'string') {
    ctx.putImageData(d, 0, 0)
    bg.filter = `blur(${Math.round(w / 60)}px)`
    if (bg.filter !== 'none') {
      bg.drawImage(cv, 0, 0)
      const b = bg.getImageData(0, 0, w, h).data
      for (let i = 0; i < px.length; i += 4) px[i] = Math.min(255, (px[i] / Math.max(1, b[i])) * 235)
    }
  }
  for (let i = 0; i < px.length; i += 4) hist[px[i]]++
  // 어두운 쪽·밝은 쪽 1%를 잘라 낸 범위를 0~255로 늘림
  const n = w * h
  let lo = 0, hi = 255, acc = 0
  while (lo < 255 && (acc += hist[lo]) < n * 0.01) lo++
  acc = 0
  while (hi > 0 && (acc += hist[hi]) < n * 0.01) hi--
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / range))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(d, 0, 0)
  return cv.toDataURL('image/png')
}

// OCR이 숫자를 자주 틀리는 패턴 바로잡기: 금액의 쉼표가 점으로(10.320원), 시각의 쌍점이 5·숫자로(16500~20:00)
function fixOcrNumbers(t: string) {
  return t
    .replace(/(\d{1,3})[.·](\d{3})(?=\s*원)/g, '$1,$2')
    .replace(/(?<![\d:])([01]?\d|2[0-3])[\d:;.]?([0-5]\d)(?=\s*[~∼-]\s*\d{1,2}\s*:)/g, '$1:$2')
}

// 사진과 꼭 대조해야 할 핵심 숫자들 (OCR 결과에서 찾은 값)
function keyNumbers(t: string): { label: string; value: string }[] {
  const s = t.replace(/[ \t]+/g, ' ')
  const pick = (label: string, re: RegExp) => { const m = s.match(re); return m ? [{ label, value: m[1].trim() }] : [] }
  return [
    ...pick('시급', /시급[^0-9\n]{0,6}([0-9][0-9,.]{3,8}\s*원)/),
    ...pick('근로시간', /근로\s*시간[^:\n]*:\s*([^\n]{3,40})/),
    ...pick('근로개시일', /근로\s*개시일[^:\n]*:\s*([^\n]{6,20})/),
    ...pick('임금 지급일', /임금\s*지급일[^:\n]*:\s*([^\n]{2,20})/),
    ...pick('근로자 수', /근로자\s*수[^:\n]*:\s*([^\n]{1,10})/),
  ]
}

export default function StepContract() {
  const { pasteText, setPasteText, masked, setMasked, analysis, setAnalysis, markDone, go, calc, sampleId } = useStore()
  const [tab, setTab] = useState(() => (pasteText.trim() ? 'paste' : 'photo')) // 샘플로 시작해 이미 글이 있으면 바로 텍스트 탭
  const [preview, setPreview] = useState<string | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [pctText, setPctText] = useState('')
  const [retry, setRetry] = useState<string | null>(null)
  const [maskCount, setMaskCount] = useState(0)
  const [showMask, setShowMask] = useState(!!masked)
  const [busy, setBusy] = useState(false)
  const [useRag, setUseRag] = useState(true) // 법령 근거 검색(RAG) 켜기/끄기 — 끄면 AI가 자체 지식만으로 판단
  const [err, setErr] = useState<string | null>(null)
  const [fromOcr, setFromOcr] = useState(false) // 사진에서 읽은 글이면 "숫자 확인" 안내를 보여 줌
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const showMasked = (text: string) => {
    const { out, count } = maskText(text)
    setMasked(out); setMaskCount(count); setShowMask(true); setAnalysis(null); setErr(null)
  }

  const runOcr = async (srcs: string[]) => {
    setRetry(null); setPct(3); setPctText('글자 인식 엔진 준비 중…'); setShowMask(false)
    try {
      const { default: Tesseract } = await import('tesseract.js')
      let all = ''; let conf = 0
      for (let i = 0; i < srcs.length; i++) {
        const src = await prepImage(srcs[i]).catch(() => srcs[i])
        const { data } = await Tesseract.recognize(src, 'kor+eng', {
          logger: (m: { status: string; progress: number }) => {
            const pg = srcs.length > 1 ? ` (${i + 1}/${srcs.length}쪽)` : ''
            if (m.status === 'recognizing text') { setPct(10 + ((i + m.progress) / srcs.length) * 88); setPctText(`글자 인식 중…${pg} ${Math.round(m.progress * 100)}%`) }
            else if (m.status) { setPct(6); setPctText('언어 데이터 불러오는 중…') }
          },
        })
        all += (data.text || '') + '\n'; conf += data.confidence / srcs.length
      }
      setPct(null)
      const text = fixOcrNumbers(all.trim())
      setFromOcr(true)
      const hangul = (text.match(/[가-힣]/g) || []).length
      if (conf < 55 || hangul < 40 || !/(시급|임금|근로시간|근무|계약)/.test(text)) {
        setRetry(`글자를 또렷하게 읽지 못했습니다. (인식 신뢰도 ${Math.round(conf)}%, 읽은 한글 ${hangul}자)`)
        return
      }
      showMasked(text)
    } catch (e) {
      setPct(null)
      setRetry('인식 중 문제가 발생했습니다: ' + (e instanceof Error ? e.message : ''))
    }
  }

  const startPdf = async (f: File) => {
    setRetry(null); setPreview(null); setTab('photo'); setPct(3); setPctText('PDF 읽는 중…'); setShowMask(false)
    try {
      const { readPdf } = await import('@/lib/pdfText')
      const r = await readPdf(f)
      if (r.text) { setPct(null); setFromOcr(false); showMasked(r.text); return } // 글자가 들어 있는 PDF는 OCR 없이 바로
      setPreview(r.images[0]); await runOcr(r.images)
    } catch (e) {
      setPct(null); setRetry('PDF를 읽지 못했습니다: ' + (e instanceof Error ? e.message : ''))
    }
  }

  const startFile = (f: File) => {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) { startPdf(f); return }
    const url = URL.createObjectURL(f); setPreview(url); setTab('photo'); runOcr([url])
  }

  const analyze = async () => {
    setBusy(true); setErr(null)
    try {
      const d = await analyzeContract(masked, useRag)
      setAnalysis(d); markDone(2)
    } catch (e) { setErr(e instanceof Error ? e.message : '분석 실패') }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">근로계약서 인식 · 분석</CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <span>사진·PDF는 <b>내 브라우저 안에서</b> 글자로 변환되고, 이름·연락처·주민번호·주소를 가린 <b>텍스트만</b> AI에 전송됩니다. 원본 파일은 밖으로 나가지 않습니다.</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList>
            <TabsTrigger value="photo"><Camera /> 사진·PDF 업로드</TabsTrigger>
            <TabsTrigger value="paste">텍스트 붙여넣기</TabsTrigger>
          </TabsList>
          <TabsContent value="photo" className="grid gap-3 pt-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 p-8 text-sm text-muted-foreground transition-colors hover:bg-muted">
              <UploadCloud className="size-7" />
              계약서 사진 또는 PDF를 선택하세요 (사진은 밝은 곳에서 정면으로)
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) startFile(f); e.target.value = '' }} />
            <div>
              <Button variant="outline" size="sm" onClick={() => { const img = makeSampleImage(SAMPLES[sampleId ?? 'minsu'].text); setPreview(img); runOcr([img]) }}>
                <FlaskConical /> 샘플 계약서 사진으로 OCR 실행
              </Button>
            </div>
            {preview && <img src={preview} alt="계약서 미리보기" className="max-h-80 rounded-lg border object-contain" />}
            {pct !== null && (
              <div className="grid gap-1.5">
                <Progress value={pct} />
                <p className="text-[13px] text-muted-foreground">{pctText}</p>
              </div>
            )}
            {retry && (
              <Alert variant="destructive">
                <Camera />
                <AlertTitle>사진을 다시 올려 주세요.</AlertTitle>
                <AlertDescription>{retry} 밝은 곳에서, 계약서 전체가 화면에 꽉 차게, 그림자·반사 없이 정면으로 찍어 주세요.</AlertDescription>
              </Alert>
            )}
          </TabsContent>
          <TabsContent value="paste" className="grid gap-3 pt-3">
            <Textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="계약서 내용을 붙여넣으세요" />
            <div>
              <Button variant="outline" onClick={() => { if (pasteText.trim().length < 20) alert('계약서 내용을 붙여넣어 주세요.'); else { setFromOcr(false); showMasked(pasteText) } }}>이 텍스트로 진행</Button>
            </div>
          </TabsContent>
        </Tabs>

        {showMask && (
          <div className="grid gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><Lock className="size-4" /> 개인정보 마스킹 결과 <Badge variant="secondary">{maskCount}곳 가림</Badge></h3>
            <p className="text-sm text-muted-foreground">아래 내용만 AI에 전송됩니다.</p>
            <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-muted-foreground">
              <li><b className="text-foreground">글자가 잘못 읽혔을 수 있어요.</b> 시급·근로시간·날짜 같은 숫자가 맞는지 확인하고 틀리면 아래에서 직접 고치세요.</li>
              <li>가려지지 않은 개인정보가 있으면 지운 뒤 분석하세요.</li>
              <li>고친 내용은 <b className="text-foreground">다시 분석하기</b>로 바로 반영돼요.</li>
            </ul>
            {fromOcr && keyNumbers(masked).length > 0 && (
              <div className="grid gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                <p className="font-semibold">ⓘ 사진에서 읽은 핵심 숫자 — 계약서 사진과 같은지 확인하세요</p>
                <dl className="grid gap-1 sm:grid-cols-2">
                  {keyNumbers(masked).map((k) => (
                    <div key={k.label} className="flex gap-2"><dt className="shrink-0 text-muted-foreground">{k.label}</dt><dd className="font-semibold">{k.value}</dd></div>
                  ))}
                </dl>
                <p className="text-[13px] text-muted-foreground">다르면 아래 글에서 직접 고친 뒤 분석하세요. 분석 결과는 이 숫자를 기준으로 나와요.</p>
              </div>
            )}
            <Textarea ref={taRef} rows={11} value={masked} onChange={(e) => setMasked(e.target.value)} />
            {/* 분석 전엔 주요 버튼, 분석 후엔 아래 "다음 단계" 버튼에 주요 자리를 넘김(한 화면에 파란 버튼 1개만) */}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={analysis ? 'outline' : 'default'} onClick={analyze} disabled={busy}>{busy ? '분석 중…' : analysis ? '다시 분석하기' : 'AI로 계약서 분석하기'}</Button>
              {/* 평가용 RAG ON/OFF: 주소에 ?eval=1이 있을 때만 노출 */}
              {new URLSearchParams(location.search).has('eval') && <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox checked={useRag} onCheckedChange={(v) => setUseRag(!!v)} />
                법령 근거 검색 사용 <span className="text-muted-foreground/80">(끄고 다시 분석하면 AI 단독 판단과 비교할 수 있어요)</span>
              </label>}
            </div>
          </div>
        )}
        {err && <Alert variant="destructive"><ShieldAlert /><AlertDescription>{err}</AlertDescription></Alert>}
        {analysis && (
          <AnalysisView
            a={analysis}
            onRemove={(i) => setAnalysis({ ...analysis, clauses: analysis.clauses.filter((_, j) => j !== i) })}
            onDispute={() => { taRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); taRef.current?.focus() }}
          />
        )}
        {analysis && <ContractJudge analysis={analysis} />}
      </CardContent>
      {analysis && (
        <StepFooter
          hint="확인된 문제는 자동으로 진정서 초안에 반영돼요."
          primary={{ label: '진정서 작성하기', onClick: () => go(3) }}
        />
      )}
    </Card>
  )
}

const SEV_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function AnalysisView({ a, onDispute, onRemove }: { a: Analysis; onDispute: () => void; onRemove: (i: number) => void }) {
  // 위험한 것부터 보이도록 정렬 (빼기 버튼은 원래 순서 번호로 동작)
  const sorted = a.clauses.map((c, i) => ({ c, i })).sort((x, y) => (SEV_ORDER[x.c.severity] ?? 2) - (SEV_ORDER[y.c.severity] ?? 2))
  const count = (s: string) => a.clauses.filter((c) => c.severity === s).length
  return (
    <div className="grid gap-3">
      <h3 className="flex flex-wrap items-center gap-2 font-semibold">
        <ClipboardList className="size-4 text-muted-foreground" /> 분석 결과 {a.demo ? <Badge variant="outline">규칙 기반 점검</Badge> : <Badge>AI 분석</Badge>}
      </h3>
      {/* 한눈에 보는 요약: 몇 건이 얼마나 심각한지 먼저 */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${SEV.high.cls}`}>{SEV.high.label} {count('high')}건</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${SEV.medium.cls}`}>{SEV.medium.label} {count('medium')}건</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${SEV.low.cls}`}>{SEV.low.label} {count('low')}건</span>
        {!!a.missing?.length && <span className="text-[13px] text-muted-foreground">· 빠진 항목 {a.missing.length}개</span>}
      </div>
      {a.summary && <p className="text-base leading-relaxed">{a.summary}</p>}
      {a.clauses.length === 0 && <p className="text-sm text-muted-foreground">문제 소지가 있는 조항이 발견되지 않았습니다.</p>}
      {sorted.map(({ c, i }) => {
        const lv = c.evidence || c.lawText ? '근거 충분' : a.rag?.used ? '현재 정보로 판단 어려움' : '추가 확인 필요'
        return (
          <div key={i} className={`grid gap-3 rounded-xl border border-l-4 p-4 ${c.severity === 'high' ? 'border-l-destructive' : c.severity === 'medium' ? 'border-l-amber-500' : 'border-l-slate-400'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${(SEV[c.severity] ?? SEV.low).cls}`}>{(SEV[c.severity] ?? SEV.low).label}</span>
              <b className="text-base">{c.title}</b>
              <Badge variant="outline" className="ml-auto">{lv}</Badge>
            </div>
            {c.quote && (
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">계약서에 적힌 문장</p>
                <blockquote className="mt-1 rounded-md bg-muted px-3 py-2 text-sm">“{c.quote}”</blockquote>
              </div>
            )}
            <div>
              <p className="text-[13px] font-semibold text-muted-foreground">무엇이 문제인가요</p>
              <p className="mt-1 text-sm leading-relaxed">{c.issue}</p>
            </div>
            {c.law && (
              <div>
                <p className="text-[13px] font-semibold text-muted-foreground">법 기준</p>
                <p className="mt-1 text-sm font-medium text-primary">{c.law}</p>
              </div>
            )}
            <Accordion className="rounded-lg border bg-muted/40 px-3">
              <AccordionItem value="law" className="border-0">
                <AccordionTrigger className="py-2 text-[13px] font-semibold text-primary">
                  <span className="flex items-center gap-1.5"><BookOpen className="size-3.5" /> 근거 자세히 보기{c.lawText ? ` · ${c.lawText.name} ${c.lawText.article}` : ''}</span>
                </AccordionTrigger>
                <AccordionContent className="grid gap-2 text-[13px] leading-relaxed">
                  <p className="text-muted-foreground">{CERTAINTY[c.severity] ?? CERTAINTY.low}</p>
                  {a.rag?.used && (c.evidence
                    ? <p><b>검색된 근거</b> <span className="text-muted-foreground">{c.evidence.title} — {c.evidence.text}</span></p>
                    : <p className="text-amber-800">근거 자료에서 확인되지 않아 단정하지 않았어요. 전문가에게 확인해 보세요.</p>)}
                  {c.lawText && (
                    <>
                      <p className="font-semibold">{c.lawText.name} {c.lawText.article}{c.lawText.title ? `(${c.lawText.title})` : ''}</p>
                      <p className="whitespace-pre-wrap">{c.lawText.text}</p>
                      <p className="text-muted-foreground">출처: 법제처 국가법령정보센터 (참고용 · 최신 원문은 law.go.kr에서 확인) <a className="font-medium text-primary underline" href={`https://www.law.go.kr/법령/${encodeURIComponent(c.lawText.name)}`} target="_blank" rel="noreferrer">공식 출처 보기</a></p>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Button variant="ghost" size="sm" className="h-auto justify-self-start px-0 text-[13px] text-muted-foreground" onClick={() => onRemove(i)}>이 지적이 맞지 않아요 (빼기)</Button>
          </div>
        )
      })}
      {!!a.missing?.length && (
        <div className="grid gap-2">
          <h4 className="text-sm font-semibold">계약서에 없거나 확인이 안 된 항목</h4>
          <div className="flex flex-wrap gap-1.5">{a.missing.map((m) => <Badge key={m} variant="secondary">{m}</Badge>)}</div>
          <p className="text-[13px] text-muted-foreground">근로계약서에는 임금, 소정근로시간, 휴일, 연차휴가 등이 명시되어야 합니다. (근로기준법 제17조)</p>
        </div>
      )}
      <div className="grid gap-1.5 border-t pt-3 text-[13px] text-muted-foreground">
        <p>
          {a.rag?.used ? <>법령 근거 검색 사용 · 참고한 조문 {a.rag.sources.length}개{a.rag.sources.length ? `: ${a.rag.sources.join(', ')}` : ''}</> : <>법령 근거 검색 미사용 (AI 단독 판단)</>}
        </p>
        <p>AI 분석은 틀릴 수 있어요. 뺀 지적은 진정서에도 반영되지 않고, “다시 분석하기”를 누르면 되돌아와요.</p>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={onDispute}>이 분석이 맞지 않아요 · 계약서 내용 수정</Button>
      </div>
    </div>
  )
}

// ── HoLab의 판단 (계약서 점검 결과 + 계약서 금액 vs 실제 받은 금액) ──
const judgeCache = new Map<string, JudgeContractReply>()
const contractHourlyOf = (text: string) => {
  const m = text.replace(/\s+/g, ' ').match(/시급[^0-9]{0,6}([0-9,]{4,7})\s*원/)
  const v = m ? Number(m[1].replace(/,/g, '')) : 0
  return v >= 1000 && v <= 100000 ? v : 0
}

function ContractJudge({ analysis }: { analysis: Analysis }) {
  const { calc, calcIn, masked, pasteText, go, legalConsult, setNextRec } = useStore()
  const legalList = dedupeIssues([...clauseIssues(analysis), ...(calc ? calcIssues(calc, masked || pasteText, analysis) : []), ...legalConsult])
  const contractHourly = contractHourlyOf(masked || pasteText)
  const received = Math.round(+(calcIn.received ?? '') || 0)
  const contractMonthly = calc && contractHourly ? Math.round(contractHourly * calc.weekly * WEEKS_PER_MONTH) : 0
  const legalMonthly = calc ? Math.round(calc.monthlyDue) : 0
  const shortC = received && contractMonthly ? contractMonthly - received : 0 // 계약서 기준에서 실제를 뺀 값(양수면 계약서보다 적게 받음)
  const shortL = received && legalMonthly ? legalMonthly - received : 0
  const high = analysis.clauses.filter((c) => c.severity === 'high')
  const medium = analysis.clauses.filter((c) => c.severity === 'medium').length
  const low = analysis.clauses.filter((c) => c.severity === 'low').length
  const missing = (analysis.missing ?? []).slice(0, 5)

  const sig = JSON.stringify([contractHourly, contractMonthly, received, legalMonthly, high.map((c) => c.title), medium, low, missing])
  const [res, setRes] = useState<{ sig: string; data: JudgeContractReply | null } | null>(null)
  useEffect(() => {
    const hit = judgeCache.get(sig)
    if (hit) { setRes({ sig, data: hit }); return }
    let live = true
    judgeContract({
      contractHourly, minWage: MIN_WAGE, contractMonthly, received, legalMonthly, shortVsContract: shortC, shortVsLegal: shortL,
      high: high.length, medium, low, highTitles: high.map((c) => c.title), missing,
    }).then((d) => { if (!d.demo) judgeCache.set(sig, d); if (live) setRes({ sig, data: d.demo ? null : d }) })
      .catch(() => { if (live) setRes({ sig, data: null }) })
    return () => { live = false }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const judging = res?.sig !== sig
  const ai = res?.sig === sig ? res.data : null

  const facts: string[] = []
  facts.push(`계약서 점검 결과: 위험 ${high.length}건 · 주의 ${medium}건 · 참고 ${low}건${high.length ? ` (위험: ${high.map((c) => c.title).join(', ')})` : ''}`)
  if (received && contractMonthly) {
    if (shortC > 1000) facts.push(`실제로 받은 금액(월 ${won(received)})이 계약서 기준(월 약 ${won(contractMonthly)})보다 ${won(shortC)} 적어요. 계약서와 다르게 지급됐을 수 있어요.`)
    else if (shortC < -1000) facts.push(`실제로 받은 금액(월 ${won(received)})이 계약서 기준(월 약 ${won(contractMonthly)})보다 ${won(-shortC)} 많아요.`)
    else facts.push(`실제로 받은 금액(월 ${won(received)})은 계약서 기준(월 약 ${won(contractMonthly)})과 비슷해요.`)
  } else if (received && !contractMonthly) facts.push('계약서에서 시급을 찾지 못해 계약서 금액과의 비교는 건너뛰었어요.')
  if (received && legalMonthly) facts.push(shortL > 1000 ? `법적으로 받아야 할 금액(월 약 ${won(legalMonthly)})보다 ${won(shortL)} 적어요.` : '실제로 받은 금액은 법적 기준 이상이에요.')
  const ruleKey: 'complaint' | 'lawyer' = high.length > 0 || shortL > 1000 ? 'complaint' : 'lawyer'
  const key = ai?.recommend?.key ?? ruleKey
  const reason = ai?.recommend?.reason || (ruleKey === 'complaint' ? '확인된 문제를 근거로 노동청에 낼 진정서 초안을 만들어 볼 수 있어요.' : '문제가 뚜렷하지 않아도 전문가에게 한 번 확인받아 두면 좋아요.')
  const STEP = { complaint: { n: 3, label: '진정서 작성' }, lawyer: { n: 4, label: '노무사 매칭' } } as const
  useEffect(() => { if (!judging) setNextRec({ from: '계약서 분석', step: STEP[key].n, label: STEP[key].label, reason }) }, [judging, key, reason]) // eslint-disable-line react-hooks/exhaustive-deps

  const chips: JudgmentChip[] = [
    { label: '위험', value: `${high.length}건`, tone: high.length ? 'bad' : 'ok' },
    { label: '주의', value: `${medium}건`, tone: medium ? 'warn' : 'ok' },
  ]
  if (shortC > 1000) chips.push({ label: '계약서보다 적게 받음', value: `월 ${won(shortC)}`, tone: 'bad' })
  else if (shortL > 1000) chips.push({ label: '법 기준보다 적게 받음', value: `월 ${won(shortL)}`, tone: 'bad' })
  const action = key === 'complaint' ? { label: '진정서 작성으로 가기', n: 3 } : { label: '노무사 매칭으로 가기', n: 4 }

  return (
    <>
    <JudgmentCard
      loading={judging} ai={!!ai}
      headline={`${STEP[key].label}으로 이어가세요`}
      action={action.label} onAction={() => go(action.n)}
      reason={reason} chips={chips}
      extra={key !== 'lawyer' ? <Button variant="ghost" size="sm" onClick={() => go(4)}>노무사 상담</Button> : <Button variant="ghost" size="sm" onClick={() => go(3)}>진정서 작성</Button>}
    >
      {ai?.summary && <p>{ai.summary}</p>}
      {received > 0 && (contractMonthly > 0 || legalMonthly > 0) && (
        <dl className="grid gap-1 rounded-lg bg-muted/50 p-3 text-[13px]">
          {contractMonthly > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">계약서 기준 월 금액</dt><dd>{won(contractMonthly)}</dd></div>}
          {legalMonthly > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">법적으로 받아야 할 월 금액</dt><dd>{won(legalMonthly)}</dd></div>}
          <div className="flex justify-between gap-3 font-semibold"><dt>실제로 받은 월 금액</dt><dd>{won(received)}</dd></div>
        </dl>
      )}
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
      {!received && (
        <p className="text-[13px] text-muted-foreground">
          '못 받은 돈 확인'에서 실제로 받은 금액을 넣으면 계약서·법적 기준과 비교해 드려요. <Button variant="link" size="sm" className="h-auto p-0 text-[13px]" onClick={() => go(1)}>못 받은 돈 확인으로 가기</Button>
        </p>
      )}
      <p className="text-[13px] text-muted-foreground">맞지 않는 지적은 위에서 “이 지적이 맞지 않아요”로 빼면 판단이 바로 달라져요.</p>
    </JudgmentCard>
    <LegalIssues issues={legalList} heading="한눈에 보는 관련 법 조항" />
    </>
  )
}
