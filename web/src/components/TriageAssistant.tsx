import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, Bot, Scale, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { explainLegal, triageChat, type TriageReply } from '@/lib/api'
import LegalIssues from '@/components/LegalIssues'
import type { LegalIssue } from '@/lib/legal'
import { maskText } from '@/lib/mask'
import { extractCalcInput } from '@/lib/extract'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'

interface Msg { id: number; role: 'user' | 'ai'; text: string }

const GREETING = '어떤 일이 있었는지 편하게 말씀해 주세요. 법률 용어를 몰라도 괜찮아요. 말씀해 주신 내용을 정리해서 알맞은 기능을 안내해 드릴게요.'
const FIRST = ['월급이 생각보다 적게 들어왔어요', '계약서가 이상한 것 같아요', '갑자기 그만두라는 말을 들었어요', '뭐가 문제인지 모르겠어요']
const FEATURE: Record<string, { label: string; step: number }> = {
  calc: { label: '못 받은 돈 확인하기', step: 1 },
  contract: { label: '계약서 분석하기', step: 2 },
  complaint: { label: '진정서 작성하기', step: 3 },
  lawyer: { label: '노무사 매칭', step: 4 },
}

type FKey = 'calc' | 'contract' | 'complaint' | 'lawyer'
// 1순위에 이어 함께 확인하면 좋은 2순위 기능과 그 이유
const SECOND: Record<FKey, FKey> = { calc: 'contract', contract: 'calc', complaint: 'calc', lawyer: 'complaint' }
const FOLLOW: Record<FKey, string> = {
  calc: '실제 근무시간을 기준으로 받아야 할 금액을 먼저 계산해보세요.',
  contract: '계약서에 적힌 임금 조건과 실제 근무 조건을 확인해보세요.',
  complaint: '정리된 내용을 바탕으로 노동청에 낼 진정서 초안을 만들어 보세요.',
  lawyer: '가까운 무료 상담기관에서 전문가와 이야기해 보세요.',
}

// 인용 제목(예: '근로기준법 제28조 부당해고등의 구제신청') → 국가법령정보센터 조문 링크
const lawUrl = (title: string) => {
  const name = title.match(/^(.+?)\s제\d/)?.[1]
  const art = title.match(/제\d+조(?:의\d+)?/)?.[0]
  return name && art ? `https://www.law.go.kr/법령/${encodeURIComponent(name)}/${art}` : 'https://www.law.go.kr'
}

export default function TriageAssistant() {
  const { consultOpen, setConsultOpen, setConsultNotes, go, calcIn, setCalcIn, setCalcAuto, setRecommended, legalConsult, setLegalConsult, setNextRec, setCaseLabel, setCaseKey, setView, resetNonce } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: 'ai', text: GREETING }])
  const [suggestions, setSuggestions] = useState<string[]>(FIRST)
  const [state, setState] = useState<TriageReply | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const evalMode = new URLSearchParams(location.search).has('eval') // 발표·평가용: 법령 검색(RAG) 켜고 끄기
  const [useRag, setUseRag] = useState(true)
  const [legalBusy, setLegalBusy] = useState(false)
  const history = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const seq = useRef(1)
  const lastCites = useRef('')
  const chatRef = useRef<HTMLDivElement>(null)
  // 처음으로 돌아가며 데이터를 지웠을 때(resetNonce 변화) 상담 대화도 처음 상태로
  useEffect(() => {
    if (!resetNonce) return
    setMsgs([{ id: 0, role: 'ai', text: GREETING }]); setSuggestions(FIRST); setState(null); setQ(''); setBusy(false); setLegalBusy(false)
    history.current = []; seq.current = 1
  }, [resetNonce])
  useEffect(() => { const el = chatRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }, [msgs, busy, consultOpen])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setQ(''); setSuggestions([])
    setMsgs((m) => [...m, { id: seq.current++, role: 'user', text }])
    history.current.push({ role: 'user', content: maskText(text).out }) // 개인정보는 가린 뒤 전송
    setBusy(true)
    try {
      const d = await triageChat(history.current, useRag)
      history.current.push({ role: 'assistant', content: d.reply })
      setMsgs((m) => [...m, { id: seq.current++, role: 'ai', text: d.reply }])
      // 이번 답에서 정리된 사실이 이전보다 줄었으면 이전 내용을 유지(정리 칸이 갑자기 비지 않게)
      if (state && d.facts.length < state.facts.length) d.facts = [...new Set([...state.facts, ...d.facts])]
      // 근거 조항은 대화가 이어져도 사라지지 않게 누적 (최대 4개)
      if (d.rag?.used) d.citations = [...new Set([...(state?.citations ?? []), ...(d.citations ?? [])])].slice(0, 4)
      setState(d)
      setCaseLabel(d.caseType && d.caseType !== 'other' ? (d.caseLabel ?? '') : '')
      setCaseKey(d.caseType && d.caseType !== 'other' ? d.caseType : '')
      if (d.ranking?.[0]) setNextRec({ from: 'AI 상담', step: FEATURE[d.ranking[0].key].step, label: FEATURE[d.ranking[0].key].label.replace('하기', ''), reason: d.ranking[0].reason })
      // 검색된 조문이 있으면 쉬운 풀이·내 상황 연결·먼저 확인할 자료를 만들어 법적 쟁점 카드로 보여 줌 (직접 증거가 없으므로 항상 "해당될 수 있어요")
      const citeKey = (d.citations ?? []).join('|')
      if (d.rag?.used && (d.citations?.length ?? 0) > 0 && citeKey === lastCites.current) {
        /* 같은 조항이면 이미 만든 법적 쟁점 카드를 그대로 사용 */
      } else if (d.rag?.used && (d.citations?.length ?? 0) > 0) {
        lastCites.current = citeKey
        setLegalBusy(true)
        explainLegal(d.citations!, d.facts).then((r) => {
          setLegalConsult(r.items.map((x, i): LegalIssue => ({ key: 'c' + i, title: x.title, basis: 'statement', plain: x.plain, situation: x.situation, checks: x.checks, from: '상담' })))
        }).catch(() => setLegalConsult(d.citations!.map((c, i): LegalIssue => ({ key: 'c' + i, title: c, basis: 'statement', from: '상담' })))).finally(() => setLegalBusy(false))
      } else setLegalConsult([])
      setSuggestions(d.suggestions) // 정보가 더 필요할 때 눌러서 답할 수 있는 1인칭 문장
    } catch (e) {
      setMsgs((m) => [...m, { id: seq.current++, role: 'ai', text: `죄송해요, 답변을 가져오지 못했어요. (${e instanceof Error ? e.message : '오류'}) 아래에서 직접 기능을 골라 시작할 수도 있어요.` }])
    }
    setBusy(false)
  }

  const start = (step: number) => {
    // 상담에서 정리된 사실은 이후 진정서 작성 때 다시 말하지 않도록 넘겨 줌
    if (state?.facts.length) setConsultNotes(state.facts)
    // 사용자가 말한 시급·근무시간·기간 등을 급여 계산 입력으로 옮김 (이미 직접 입력한 칸은 덮어쓰지 않음)
    const { values, labels } = extractCalcInput(history.current.filter((m) => m.role === 'user').map((m) => m.content))
    const empty = (k: keyof typeof calcIn) => !String(calcIn[k] ?? '').trim() || calcIn[k] === false
    const patch: Record<string, string | boolean> = {}
    const used: string[] = []
    const keyOf: Record<string, keyof typeof calcIn> = { 시급: 'hourly', '주 근로시간': 'weekly', '일한 기간': 'months', '5인 미만 사업장': 'under5' }
    for (const l of labels) { const k = keyOf[l]; if (k && empty(k)) { patch[k] = (values as Record<string, string | boolean>)[k]; used.push(l) } }
    if (used.length) { setCalcIn(patch as Partial<typeof calcIn>); setCalcAuto(used) }
    // 위저드 상단에 "AI 상담 추천 순서"로 보여줌 (추천이 없으면 비움)
    setRecommended((state?.ranking?.length ? state.ranking : state?.recommend.key ? [{ key: state.recommend.key }] : []).slice(0, 2).map((r) => FEATURE[r.key].step))
    setConsultOpen(false)
    go(step)
  }
  if (!consultOpen) return null // 상담 화면이 아닐 때는 숨김(대화 내용은 유지)
  const hasPanel = !!state && (state.facts.length > 0 || state.issues.length > 0 || (state.ranking?.length ?? 0) > 0)

  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col">
      <header>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <button className="flex items-center gap-3 text-left" onClick={() => setView('home')} aria-label="처음 화면으로">
            <span className="flex h-10 w-11 shrink-0 items-center justify-center"><img src={logo} alt="HoLab 로고" className="h-full w-full object-contain" /></span>
            <span className="text-2xl font-extrabold tracking-tight">HoLab</span>
          </button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setView('home')}><ArrowLeft /> 처음으로</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <div className="mb-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Bot className="size-7 text-primary" /> 내 상황 이야기하기</h1>
          <p className="mt-1.5 max-w-2xl text-muted-foreground">겪은 일을 말씀해 주시면 HoLab이 정리하고, 해당될 수 있는 법 조항과 지금 쓰면 좋은 기능을 순서대로 알려 드려요. 법률 자문이 아닌 참고용 안내예요.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* 왼쪽: 대화 (화면이 길어져도 따라오도록 고정) */}
          <section className="flex flex-col gap-3 lg:sticky lg:top-12 lg:self-start" aria-label="대화">
            <div ref={chatRef} className="h-[min(56vh,30rem)] overflow-y-auto rounded-2xl bg-accent p-4">
              <div className="flex flex-col gap-2.5">
                {msgs.map((m) => (
                  <div key={m.id} className={`pop-in ${m.role === 'user' ? 'self-end' : 'self-start'}`} style={{ maxWidth: '88%' }}>
                    <div className={m.role === 'user'
                      ? 'whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground'
                      : 'whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed'}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-3">
                    <span className="inline-flex gap-1">
                      {[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${d}ms` }} />)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {suggestions.length > 0 && !busy && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-auto rounded-full whitespace-normal py-1.5 text-left" onClick={() => send(s)}>{s}</Button>
                ))}
              </div>
            )}

            {evalMode && <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground"><input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} /> 법령 검색(RAG) 사용 <span>(끄고 새로 말하면 AI 단독 판단과 비교할 수 있어요)</span></label>}
            <form onSubmit={(e) => { e.preventDefault(); send(q) }} className="flex items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="있었던 일을 적어 주세요" aria-label="상황 입력" disabled={busy} className="h-10" />
              <Button type="submit" size="icon" className="size-10" aria-label="보내기" disabled={!q.trim() || busy}><ArrowUp /></Button>
            </form>
            <p className="text-[13px] text-muted-foreground">입력한 내용의 이름·연락처 등은 가려서 전송돼요.</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[13px] text-muted-foreground">바로 기능으로:</span>
              {Object.values(FEATURE).map((f) => (
                <Button key={f.step} variant="ghost" size="sm" onClick={() => start(f.step)}>{f.label}</Button>
              ))}
            </div>
          </section>

          {/* 오른쪽: HoLab이 정리한 상황 → 다음 기능 순위 → 해당될 수 있는 법 조항 */}
          <aside className="grid content-start gap-4" aria-label="HoLab 정리">
            <div className="rounded-2xl bg-accent p-5">
              <div className="flex flex-wrap items-center gap-2 text-lg font-bold">
                <Sparkles className="size-5 text-primary" /> HoLab이 정리한 상황
                {state?.caseLabel && state.caseType !== 'other' && <Badge>{state.caseLabel}{state.rankingTentative ? ' · 잠정' : ''}</Badge>}
                {state?.rag?.used && <Badge variant="secondary"><Search /> 법령을 먼저 검색한 뒤 판단</Badge>}
              </div>
              {!state || (!state.facts.length && !state.issues.length) ? (
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <p>이야기를 나누면 여기에 이렇게 정리돼요.</p>
                  <ul className="list-disc space-y-1 pl-5"><li>말씀하신 사실 정리</li><li>확인해 볼 문제와 사건 유형</li><li>다음에 쓰면 좋은 기능 순위</li><li>해당될 수 있는 법 조항과 근거(펼쳐서 원문 확인)</li></ul>
                </div>
              ) : (
                <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                  {state.facts.length > 0 && (
                    <div><div className="mb-1 font-semibold">말씀하신 내용</div><ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{state.facts.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                  )}
                  {state.issues.length > 0 && (
                    <div><div className="mb-1 font-semibold">확인해볼 문제</div><ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{state.issues.map((f) => <li key={f}>{f}</li>)}</ul></div>
                  )}
                </div>
              )}
            </div>

            {state && (state.ranking?.length ?? 0) > 0 && (
              <div className="pop-in grid gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-primary">HoLab의 판단{state.rankingTentative && <Badge variant="outline">잠정</Badge>}</div>
                {(() => {
                  const [top, ...rest] = state.ranking!
                  return (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">가장 먼저 추천해요</p>
                        <p className="text-xl font-extrabold leading-snug tracking-tight">{FEATURE[top.key].label.replace('하기', '')}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{top.reason}</p>
                        <Button className="mt-3" size="sm" onClick={() => start(FEATURE[top.key].step)}>{FEATURE[top.key].label}<ArrowRight /></Button>
                        {state.rankingTentative && <p className="mt-2 text-[13px] text-muted-foreground">말씀하신 내용이 아직 적어서 잠정이에요. 질문에 답하면 더 정확해져요.</p>}
                      </div>
                      {rest.length > 0 && (
                        <details className="group rounded-lg bg-background/70 p-3">
                          <summary className="cursor-pointer list-none text-[13px] font-semibold text-muted-foreground">다른 추천 {rest.length}개 보기</summary>
                          <div className="mt-2 grid gap-2">
                            {rest.map((r, i) => (
                              <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 first:border-t-0 first:pt-0">
                                <div className="min-w-0 flex-1 text-sm"><b>{i + 2}순위 · {FEATURE[r.key].label.replace('하기', '')}</b><span className="block text-[13px] text-muted-foreground">{r.reason}</span></div>
                                <Button size="sm" variant="outline" onClick={() => start(FEATURE[r.key].step)}>가기<ArrowRight /></Button>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )
                })()}
                {state.procedure && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-950">
                    <div className="flex items-center gap-1.5 font-semibold"><Scale className="size-4" /> HoLab 기능 밖의 절차</div>
                    <p className="mt-1">{state.procedure}</p>
                    <p className="mt-1 text-amber-900/80">검색된 법령 원문을 근거로 한 안내예요. 구체적인 절차는 고용노동부 1350이나 상담 센터·노무사에게 확인하세요.</p>
                  </div>
                )}
              </div>
            )}

            {state?.rag?.used && (legalBusy || legalConsult.length > 0) && <LegalIssues issues={legalConsult} loading={legalBusy} heading={state.citationsTentative ? '해당될 수 있는 법 조항 (잠정) · 눌러서 자세히 보기' : '해당될 수 있는 법 조항 · 눌러서 자세히 보기'} openFirst />}
            {state && !state.rag?.used && (state.citations?.length ?? 0) > 0 && <div className="rounded-xl bg-accent p-4 text-sm text-muted-foreground">AI가 기억으로 쓴 조문(확인되지 않음): {state.citations!.join(', ')}</div>}
            {hasPanel && <p className="text-[13px] text-muted-foreground">위 내용은 말씀하신 내용만 근거라 “해당될 수 있어요”로 안내해요. 계약서 같은 확실한 자료를 올리면 더 정확히 알려 드려요.</p>}
          </aside>
        </div>
      </main>
    </div>
  )
}