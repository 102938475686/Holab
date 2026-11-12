import { useEffect, useMemo, useState } from 'react'
import JudgmentCard, { type JudgmentChip } from '@/components/JudgmentCard'
import { ArrowRight, Bot, CheckCircle2, CircleAlert, FileDown, Printer, Sparkles } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceField, Field, TextField } from '@/components/common'
import ComplaintAssistant from '@/components/ComplaintAssistant'
import { StepFooter } from '@/components/StepFooter'
import { draftComplaint, judgeComplaint, type JudgeComplaintReply } from '@/lib/api'
import { won } from '@/lib/calc'
import { calcIssues, clauseIssues, dedupeIssues, verdictOf } from '@/lib/legal'
import { savePdf } from '@/lib/pdf'
import { EVIDENCE_ALT, evidenceList, type Evidence } from '@/lib/evidence'
import { useStore } from '@/store'

const SUBS = ['진정인', '사업장', '진정 내용', '내용 작성', '최종 확인']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <h3 className="border-b-2 border-primary pb-1.5 font-semibold">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

export default function StepComplaint() {
  const { calc, analysis, masked, form, setForm, setAskLawyer, consultNotes, setConsultNotes, autoSrc, markAuto, clearAuto, legalConsult, caseKey, caseLabel, report, setReport } = useStore()
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [badge, setBadge] = useState<{ demo: boolean; consulted?: boolean } | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [sub, setSub] = useState(1) // 진정서 작성 5단계 (한 번에 한 묶음씩)
  const [auto, setAuto] = useState<string[]>([]) // 계산·계약서에서 자동으로 채워진 항목 (사용자가 확인할 수 있게 표시)
  const AUTO_LABEL: Record<string, string> = { wageTotal: '체불임금 총액', etcAmt: '기타 체불금액', duty: '업무내용', payDay: '임금 지급일', rName: '사업장명', rCount: '근로자 수', startDate: '입사일' }

  const issues = useMemo(() => {
    const out: string[] = []
    if (calc && calc.holUnpaid > 0) out.push(`주휴수당 미지급 (주당 ${won(calc.weeklyHolPay)})`)
    if (calc && calc.extraUnpaid > 0) out.push('연장·야간·휴일 가산수당 미지급')
    if (calc && calc.minWageUnpaid > 0) out.push(`최저임금 미달 (시급 ${calc.hourly.toLocaleString()}원)`)
    for (const c of analysis?.clauses ?? []) if (c.severity !== 'low') out.push(`계약서 조항 문제: ${c.title}`)
    // AI 상담에서 나온 관련 조항은 직접 증거가 없으면 "해당될 수 있음"으로만 전달
    for (const x of legalConsult) out.push(`관련 법 조항(${verdictOf(x.basis)}): ${x.title}`)
    return out
  }, [calc, analysis, legalConsult])

  // 계산 결과·계약서(마스킹본)에서 알 수 있는 항목을 빈 칸에만 자동 입력
  useEffect(() => {
    const patch: Record<string, string> = {}
    const set = (k: string, v: string) => { if (v && !(form as unknown as Record<string, string>)[k]?.trim()) patch[k] = v }
    if (calc && calc.total > 0) set('wageTotal', won(calc.total)) // 기타 체불금액에는 같은 금액을 또 넣지 않음(양식에 두 번 적혀 이중으로 보이는 것 방지)
    const pick = (re: RegExp) => masked.match(re)?.[1].trim() ?? ''
    set('duty', pick(/업무\s*내용\s*[:：]\s*([^\n]+)/))
    set('payDay', pick(/임금\s*지급일\s*[:：]\s*([^\n]+)/))
    set('rName', pick(/사업장\s*명\s*[:：]\s*([^\n]+)/))
    const cnt = pick(/근로자\s*수\s*[:：]\s*(\d+)/)
    if (cnt) set('rCount', cnt + '명')
    const sd = masked.match(/근로\s*개시일\s*[:：]\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
    if (sd) set('startDate', `${sd[1]}-${sd[2].padStart(2, '0')}-${sd[3].padStart(2, '0')}`)
    // 상담 내용 중 날짜가 있는 일을 "있었던 일의 순서"에 미리 채움 (수정 가능)
    if (!form.timeline.trim()) {
      const dated = Array.from(new Set(consultNotes.filter((n) => /\d{1,4}\s*[.년월/-]\s*\d|월\s*\d+일/.test(n))))
      if (dated.length) { patch.timeline = dated.join('\n'); setAuto((a) => a) }
    }
    if (Object.keys(patch).length) {
      setForm(patch); setAuto(Object.keys(patch).filter((k) => k !== 'timeline'))
      markAuto(Object.keys(patch).filter((k) => ['wageTotal', 'etcAmt'].includes(k)), '못 받은 돈 확인')
      markAuto(Object.keys(patch).filter((k) => ['duty', 'payDay', 'rName', 'rCount', 'startDate'].includes(k)), '계약서 분석')
      if (patch.timeline) markAuto(['timeline'], 'AI 상담')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const facts = () => {
    const c = calc
    return {
      hourly: c?.hourly, weeklyHours: c?.weekly, workedPeriod: c?.months ? `${c.months}개월` : undefined,
      under5: !!c?.under5, weeklyHolidayPay: Math.round(c?.weeklyHolPay ?? 0), totalUnpaid: Math.round(c?.total ?? 0),
      unpaidBreakdown: { 주휴수당: Math.round(c?.holUnpaid ?? 0), 가산수당: Math.round(c?.extraUnpaid ?? 0), 최저임금차액: Math.round(c?.minWageUnpaid ?? 0) },
      issues,
      // ①단계 급여명세서 비교 등에서 미리 반영해 둔 메모가 있으면 "바로 초안 만들기"에도 포함
      userNotes: [...consultNotes, ...form.timeline.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '경과: ' + l)],
    }
  }

  const draft = async () => {
    setBusy(true)
    try {
      const d = await draftComplaint(facts())
      setForm({ draft: d.text }); markAuto(['draft'], '못 받은 돈·계약서 결과로 AI가 작성')
      setBadge({ demo: !!d.demo, consulted: consultNotes.length > 0 })
    } catch (e) { alert('초안 생성 실패: ' + (e instanceof Error ? e.message : '')) }
    setBusy(false)
  }

  // 사건 유형별 증빙 안내: 상담 내용·계산·계약서 분석에 맞춰 만들고, 각 자료가 어떤 쟁점을 보여주는지 연결해서 보여줌
  // (상담 준비 리포트의 체크리스트와 같은 목록·같은 체크 상태)
  const have = useMemo(() => new Set(report?.have ?? []), [report])
  const setHave = (id: string, on: boolean) => {
    const next = on ? [...have, id] : [...have].filter((h) => h !== id)
    setReport({ lawyerName: report?.lawyerName ?? '', summary: report?.summary ?? '', questions: report?.questions ?? [], have: next })
  }
  const evidence = useMemo(() => evidenceList({
    calc, analysis, caseKey,
    text: [caseLabel, ...consultNotes, ...legalConsult.map((x) => x.title), form.draft].join(' '),
  }), [calc, analysis, caseKey, caseLabel, consultNotes, legalConsult, form.draft])
  // 쟁점별로 묶기: "주휴수당 ← 급여명세서, 출퇴근 기록"
  // 계약서·대화·신분증처럼 어느 사건에나 필요한 자료는 "공통"으로 마지막에 모음
  const byIssue = useMemo(() => {
    const COMMON = new Set(['근로 조건', '사건 경위', '본인 확인'])
    const m = new Map<string, Evidence[]>()
    for (const e of evidence) { const k = COMMON.has(e.proves) ? '' : e.proves; m.set(k, [...(m.get(k) ?? []), e]) }
    return [...m.entries()].sort(([a], [b]) => Number(a === '') - Number(b === ''))
  }, [evidence])

  const checks = [
    { sub: 1, label: '진정인 성명·연락처', ok: !!form.pName.trim() && !!(form.pMobile.trim() || form.pTel.trim()) },
    { sub: 2, label: '사업장명·주소', ok: !!form.rName.trim() && !!form.rBizAddr.trim() },
    { sub: 3, label: '입사일', ok: !!form.startDate },
    { sub: 3, label: '체불 금액', ok: !!form.wageTotal.trim() },
    { sub: 4, label: '진정 내용', ok: form.draft.trim().length > 20 },
    { sub: 4, label: '첨부 자료', ok: !!form.attach.trim() },
  ]
  const ready = agree && form.draft.trim().length > 20

  const download = async () => {
    const el = document.getElementById('printDoc')
    if (!el) return
    setPdfBusy(true)
    try {
      await savePdf(el, `진정서_${form.pName.trim() || '초안'}.pdf`)
      setAskLawyer(true)
    } catch (e) { alert(e instanceof Error ? e.message : 'PDF 생성 실패') }
    setPdfBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">노동청 진정서 작성 보조</CardTitle>
        <CardDescription>고용노동부 <b>진정서 양식</b> 그대로 작성됩니다. 인적사항(성명·주민번호 등)은 <b>이 브라우저에만</b> 입력되며 AI에는 전송되지 않습니다. 계약서·계산 결과에서 알 수 있는 항목은 자동으로 채워집니다.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* AI에 전달되는 사실관계를 항목별 목록으로: 초안을 만들기 전에 틀린 게 없는지 한눈에 확인 */}
        <details className="group rounded-xl border p-4" open={sub === 4}>
          <summary className="cursor-pointer text-sm font-semibold">AI에 전달되는 사실관계 확인하기 <span className="font-normal text-muted-foreground">(인적사항은 보내지 않아요)</span></summary>
          <div className="mt-3 grid gap-3 text-sm">
            {calc ? (
              <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">시급</dt><dd>{calc.hourly.toLocaleString()}원</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">주 근로시간</dt><dd>{calc.weekly}시간</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">일한 기간</dt><dd>{calc.months ? `${calc.months}개월` : '입력 안 함'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">5인 미만 사업장</dt><dd>{calc.under5 ? '예' : '아니오'}</dd></div>
                {calc.holUnpaid > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">주휴수당 미지급</dt><dd>{won(calc.holUnpaid)}</dd></div>}
                {calc.extraUnpaid > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">가산수당 미지급</dt><dd>{won(calc.extraUnpaid)}</dd></div>}
                {calc.minWageUnpaid > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">최저임금 차액</dt><dd>{won(calc.minWageUnpaid)}</dd></div>}
                <div className="flex justify-between gap-3 font-semibold"><dt>미지급 추정 합계</dt><dd>{won(calc.total)}</dd></div>
              </dl>
            ) : <p className="text-muted-foreground">못 받은 돈 확인을 먼저 해 두면 금액이 함께 전달돼 초안이 더 정확해져요.</p>}
            {issues.length > 0 && (
              <div>
                <p className="mb-1 font-semibold">확인된 문제</p>
                <ul className="list-disc space-y-0.5 pl-5">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            )}
            {(consultNotes.length > 0 || form.timeline.trim()) && (
              <div>
                <p className="mb-1 font-semibold">상담·경과 메모</p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {consultNotes.slice(0, 8).map((n) => <li key={n}>{n}</li>)}
                  {form.timeline.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => <li key={'t' + l}>경과: {l}</li>)}
                </ul>
              </div>
            )}
            <p className="text-[13px] text-muted-foreground">틀린 내용이 있으면 해당 단계(못 받은 돈 확인·계약서 분석)에서 고치거나, “있었던 일의 순서”를 수정하세요.</p>
          </div>
        </details>

        <ol className="flex flex-wrap gap-1.5 text-[13px]" aria-label="진정서 작성 단계">
          {SUBS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setSub(i + 1)} className={'rounded-full border px-3 py-1 ' + (sub === i + 1 ? 'border-primary bg-primary text-primary-foreground' : sub > i + 1 ? 'border-emerald-500/50 text-emerald-700' : 'text-muted-foreground')}>{i + 1}. {s}</button>
            </li>
          ))}
        </ol>

        {sub === 1 && auto.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/10 p-3 text-[13px]">
            <Badge>자동 입력</Badge>
            <span>계산·계약서에서 가져와 채운 항목이에요. 맞는지 확인하세요:</span>
            {auto.map((k) => <Badge key={k} variant="secondary">{AUTO_LABEL[k] ?? k}</Badge>)}
          </div>
        )}

        {sub === 1 && <Section title="1. 진정인">
          <TextField k="pName" label="성명" />
          <TextField k="pRrn" label="주민등록번호" placeholder="000000-0000000" />
          <TextField k="pAddr" label="주소" className="sm:col-span-2" />
          <TextField k="pTel" label="전화번호" />
          <TextField k="pMobile" label="휴대전화번호" />
          <TextField k="pEmail" label="전자우편주소" className="sm:col-span-2" />
          <ChoiceField k="pRecv" label="처리 상황 수신여부" options={['예', '아니오']} />
          <ChoiceField k="pPortal" label="노동포털 통지여부" options={['예', '아니오']} />
        </Section>}

        {sub === 2 && <Section title="2. 피진정인">
          <TextField k="rBoss" label="성명 (대표자)" />
          <TextField k="rTel" label="연락처" />
          <TextField k="rAddr" label="주소" className="sm:col-span-2" />
          <ChoiceField k="rKind" label="사업체 구분" options={['사업장', '공사현장']} />
          <TextField k="rName" label="사업장명" />
          <TextField k="rBizAddr" label="사업장 주소 (실근무장소)" className="sm:col-span-2" />
          <TextField k="rBizTel" label="사업장 전화번호" />
          <TextField k="rCount" label="근로자 수" placeholder="예: 7명" />
        </Section>}

        {sub === 3 && <Section title="3. 진정 내용">
          <TextField k="startDate" label="입사일" type="date" />
          <TextField k="endDate" label="퇴사일 (재직 중이면 비움)" type="date" />
          <TextField k="wageTotal" label="체불임금 총액" />
          <ChoiceField k="retired" label="퇴직 여부" options={['재직', '퇴직']} />
          <TextField k="retireAmt" label="체불퇴직금액" placeholder="없으면 비움" />
          <TextField k="etcAmt" label="기타 체불금액" />
          <TextField k="duty" label="업무내용" className="sm:col-span-2" />
          <TextField k="payDay" label="임금 지급일" />
          <ChoiceField k="contractType" label="근로계약방법" options={['서면', '구두']} />
        </Section>}

        {sub === 3 && <div className="grid gap-2">
          <Field label="있었던 일의 순서 (선택) — 한 줄에 하나씩, 날짜와 함께 적어 주세요" auto={autoSrc.timeline}>
            <Textarea rows={4} value={form.timeline} onChange={(e) => { clearAuto('timeline'); setForm({ timeline: e.target.value }) }} placeholder={'2026.07.01 근무 시작\n2026.09.10 주휴수당을 요청했으나 거절당함\n2026.09.30 월급이 계약보다 적게 입금됨'} />
          </Field>
          {consultNotes.length > 0 && (
            <div>
              <Button variant="outline" size="sm" onClick={() => { markAuto(['timeline'], 'AI 상담'); setForm({ timeline: [form.timeline.trim(), ...consultNotes.filter((n) => /\d{1,4}\s*[.년월/-]\s*\d|월\s*\d+일/.test(n))].filter(Boolean).join('\n') }) }}>AI 상담 내용에서 날짜 있는 일 가져오기</Button>
            </div>
          )}
          <p className="text-[13px] text-muted-foreground">적어 주신 순서는 AI 초안에 “경과”로 반영돼요. 날짜가 정확하지 않으면 “9월 초”처럼 적어도 돼요.</p>
        </div>}

        {sub === 4 && <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 초안이 이미 있으면 주요 자리를 아래 "PDF 다운로드" 버튼에 넘기고 보조로 낮춤(한 화면에 파란 버튼 1개만) */}
            <Button variant={form.draft.trim().length > 20 ? 'outline' : 'default'} onClick={() => setAssistantOpen(true)}><Bot /> AI 상담으로 내용 작성</Button>
            {form.draft.trim().length <= 20 && <Badge variant="outline" className="text-primary">추천</Badge>}
            <Button variant="ghost" size="sm" onClick={draft} disabled={busy} className="text-muted-foreground"><Sparkles /> {busy ? '작성 중…' : '또는, 상담 없이 바로 초안 만들기'}</Button>
            {badge && <Badge variant={badge.demo ? 'outline' : 'default'}>{badge.demo ? '기본 서식 초안' : badge.consulted ? 'AI 상담 반영 초안' : 'AI 초안'}</Badge>}
            <span className="w-full text-[13px] text-muted-foreground">넣고 싶은 이야기를 AI와 상담하듯 알려 주면, 분석된 내용과 함께 그걸 바탕으로 초안을 써 드려요.</span>
          </div>
          <Field label="내용 (직접 수정할 수 있습니다)" auto={autoSrc.draft}>
            <Textarea rows={12} value={form.draft} onChange={(e) => { clearAuto('draft'); setForm({ draft: e.target.value }) }} placeholder="[AI 상담으로 내용 작성] 또는 [바로 초안 만들기]를 누르면 초안이 생성됩니다." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField k="attach" label="파일 첨부 (첨부할 자료 이름)" placeholder="예: 근로계약서 사본, 통장 거래내역" />
            <TextField k="office" label="제출할 관할 노동청 (예: 서울서부)" placeholder="예: 서울서부" />
          </div>
        </div>}

        {sub === 5 && <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3.5 text-[13px]">
            <div className="mb-1.5 font-semibold text-foreground">제출 전 최종 확인</div>
            <ul className="grid gap-1">
              {checks.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-700' : 'text-amber-800'}`}>
                  {c.ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <CircleAlert className="size-3.5 shrink-0" />}{c.label}{c.ok ? '' : ' — 비어 있어요'}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-muted-foreground">비어 있어도 PDF는 만들 수 있지만, 접수 전에 채우는 게 좋아요.</p>
          </div>
          <div className="rounded-lg border p-3.5 text-[13px] sm:col-span-2">
            <div className="mb-1 font-semibold text-foreground">내 사건의 쟁점과 증빙자료</div>
            <p className="mb-2 text-muted-foreground">각 쟁점을 어떤 자료로 보여줄 수 있는지 묶었어요. 갖고 있는 자료를 체크하세요. (상담 준비 리포트의 체크리스트와 같이 저장돼요)</p>
            <div className="grid gap-3">
              {byIssue.map(([issue, list]) => (
                <div key={issue} className="grid gap-1.5 rounded-md bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">{issue ? `쟁점: ${issue}` : '어느 사건에나 필요한 기본 자료'}</p>
                  <ul className="grid gap-1.5">
                    {list.map((e) => (
                      <li key={e.id} className="flex items-start gap-2">
                        <Checkbox id={`ev-${issue}-${e.id}`} checked={have.has(e.id)} onCheckedChange={(v) => setHave(e.id, !!v)} className="mt-0.5" />
                        <Label htmlFor={`ev-${issue}-${e.id}`} className="grid cursor-pointer gap-0.5 font-normal">
                          <span className="text-foreground">{e.label} <span className="text-muted-foreground">— {e.why}</span></span>
                          {!have.has(e.id) && EVIDENCE_ALT[e.id] && <span className="text-muted-foreground">없다면: {EVIDENCE_ALT[e.id]}</span>}
                        </Label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={!have.size} onClick={() => setForm({ attach: evidence.filter((e) => have.has(e.id)).map((e) => e.label.replace(/\s*\(.*\)$/, '')).join(', ') })}>체크한 자료를 “파일 첨부” 칸에 넣기</Button>
              <span className="text-muted-foreground">없는 자료가 있어도 진정은 할 수 있어요.</span>
            </div>
          </div>
        </div>}

        {/* PDF 다운로드는 HoLab의 판단보다 먼저: 동의 → 다운로드 → (그 아래) 보완 제안 */}
        {sub === 5 && <div className="grid gap-3 rounded-xl border-2 border-primary/40 p-4">
          <div className="flex items-start gap-2.5">
            <Checkbox id="agree1" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
            <Label htmlFor="agree1" className="cursor-pointer font-normal leading-relaxed"><span>이 초안은 <b>참고용</b>이며 법률 자문이 아니고, 제출 전 내용을 직접 확인·수정해야 함을 이해했습니다.</span></Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={download} disabled={!ready || pdfBusy}><FileDown /> {pdfBusy ? 'PDF 만드는 중…' : '진정서 PDF 다운로드'}</Button>
            <span className="text-[13px] text-muted-foreground">{ready ? 'PDF를 저장하면 노무사 매칭으로 이어갈지 물어봐요. (양식: 고용노동부 진정서)' : '위 동의에 체크하고 진정 내용을 채우면 PDF를 만들 수 있어요.'}</span>
          </div>
        </div>}

        {sub === 5 && <ComplaintJudge missing={checks.filter((c) => !c.ok).map((c) => ({ label: c.label, sub: c.sub }))} have={evidence.filter((e) => have.has(e.id)).length} need={evidence.length} autoCount={Object.keys(autoSrc).length} draftDone={form.draft.trim().length > 20} goSub={setSub} />}
      </CardContent>
      {sub < 5 ? (
        <StepFooter hint="입력한 내용은 자동으로 저장돼요." primary={{ label: '다음: ' + SUBS[sub], onClick: () => setSub(sub + 1) }} secondary={sub > 1 ? [{ label: '이전', onClick: () => setSub(sub - 1) }] : undefined} />
      ) : (
      <StepFooter
        hint="진정서 PDF 다운로드 버튼은 위쪽 동의 체크 바로 아래에 있어요."
        secondary={[{ label: '이전', onClick: () => setSub(4) }]}
      />
      )}
      <ComplaintAssistant open={assistantOpen} onOpenChange={setAssistantOpen} facts={facts()} onDraft={(text, meta) => { setForm({ draft: text }); markAuto(['draft'], '상담·못 받은 돈·계약서 결과로 AI가 작성'); setBadge(meta); setConsultNotes(meta.notes) }} />
    </Card>
  )
}

// ── 3단계 "HoLab의 판단": 제출 전 점검 (빈 항목·증빙·관련 법 조항 → 이 단계에서 보완할지, 노무사 매칭으로 갈지) ──
const complaintJudgeCache = new Map<string, JudgeComplaintReply>()
function ComplaintJudge({ missing, have, need, autoCount, draftDone, goSub }: { missing: { label: string; sub: number }[]; have: number; need: number; autoCount: number; draftDone: boolean; goSub: (n: number) => void }) {
  const { calc, analysis, legalConsult, masked, pasteText, go, setNextRec } = useStore()
  const legal = dedupeIssues([...clauseIssues(analysis), ...(calc ? calcIssues(calc, masked || pasteText, analysis) : []), ...legalConsult])
  const docN = legal.filter((x) => x.basis === 'document').length
  const stmtN = legal.length - docN
  const total = Math.round(calc?.total ?? 0)
  const sig = JSON.stringify([total, missing.map((m) => m.label), have, need, docN, stmtN, autoCount, draftDone])
  const [res, setRes] = useState<{ sig: string; data: JudgeComplaintReply | null } | null>(null)
  useEffect(() => {
    const hit = complaintJudgeCache.get(sig)
    if (hit) { setRes({ sig, data: hit }); return }
    let live = true
    judgeComplaint({ total, missing: missing.map((m) => m.label), haveEvidence: have, needEvidence: need, suggest: missing.length > 0 || !draftDone || (need > 0 && have === 0) ? 'fix' : 'lawyer', docIssues: docN, stmtIssues: stmtN, autoCount, draftDone, laws: legal.map((x) => x.title) })
      .then((d) => { if (!d.demo) complaintJudgeCache.set(sig, d); if (live) setRes({ sig, data: d.demo ? null : d }) })
      .catch(() => { if (live) setRes({ sig, data: null }) })
    return () => { live = false }
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const judging = res?.sig !== sig
  const ai = res?.sig === sig ? res.data : null

  // 추천 기능은 규칙으로 정함(항목이나 초안이 비었거나 증빙이 하나도 없을 때만 먼저 보완). AI는 그 이유만 설명해서 말과 추천이 어긋나지 않게 함
  const shortfall = Math.max(0, need - have)
  const key: 'fix' | 'lawyer' = missing.length > 0 || !draftDone || (need > 0 && have === 0) ? 'fix' : 'lawyer'
  const reason = ai?.recommend?.reason || (key === 'fix' ? '비어 있는 항목을 채우면 센터에서 설명할 내용이 더 정확해져요.' : '내용이 충분히 채워졌어요. PDF를 저장해 노무사를 매칭해 가져가세요.')
  useEffect(() => {
    if (judging) return
    setNextRec(key === 'fix' ? { from: '진정서 작성', step: 3, label: '진정서 보완', reason } : { from: '진정서 작성', step: 4, label: '노무사 매칭', reason })
  }, [judging, key, reason]) // eslint-disable-line react-hooks/exhaustive-deps

  const facts = [
    missing.length ? `아직 비어 있는 항목: ${missing.map((m) => m.label).join(', ')}` : '필수 항목은 모두 채워졌어요.',
    need > 0 ? (shortfall === 0 ? `필요한 증빙 ${need}개를 모두 갖췄다고 체크했어요.` : `갖고 있다고 체크한 증빙 ${have}개 / 내 사건에 필요한 증빙 ${need}개 (아직 ${shortfall}개 더 모을 수 있어요)`) : '',
    legal.length ? `관련 법 조항 ${legal.length}건 · 계약서 등 확실한 자료가 근거인 것(위반) ${docN}건 · 말한 내용만 있어 확인이 더 필요한 것(해당될 수 있어요) ${stmtN}건` : '',
    autoCount > 0 ? `앞서 입력한 내용으로 자동 작성된 칸 ${autoCount}개 — 맞는지 한 번 더 확인해 주세요.` : '',
    !draftDone ? '진정 내용(초안)이 아직 없어요.' : '',
  ].filter(Boolean)

  const chips: JudgmentChip[] = [
    { label: '빈 항목', value: `${missing.length}개`, tone: missing.length ? 'warn' : 'ok' },
    ...(need > 0 ? [{ label: '증빙', value: `${have}/${need}`, tone: (shortfall ? 'warn' : 'ok') as 'warn' | 'ok' }] : []),
    { label: '진정 내용', value: draftDone ? '작성됨' : '없음', tone: draftDone ? 'ok' : 'warn' },
  ]
  const fixAction = missing[0] ? { label: `${missing[0].label} 채우러 가기`, run: () => goSub(missing[0].sub) } : !draftDone ? { label: '진정 내용 작성하러 가기', run: () => goSub(4) } : { label: '증빙 자료 체크하러 가기', run: () => goSub(4) }

  return (
    <JudgmentCard
      title="HoLab의 판단 · 제출 전 점검" loading={judging} ai={!!ai}
      headline={key === 'fix' ? '먼저 보완하고 제출하세요' : '노무사 매칭으로 이어가세요'}
      action={key === 'fix' ? fixAction.label : '노무사 매칭'} onAction={key === 'fix' ? fixAction.run : () => go(4)}
      reason={reason} chips={chips}
      extra={key === 'fix' ? <Button variant="ghost" size="sm" onClick={() => go(4)}>노무사 매칭</Button> : undefined}
    >
      {ai?.summary && <p>{ai.summary}</p>}
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{facts.map((f) => <li key={f}>{f}</li>)}</ul>
    </JudgmentCard>
  )
}
