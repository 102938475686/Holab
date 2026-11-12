import { useEffect, useState } from 'react'
import { ArrowRight, CircleHelp, Sparkles, X, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field } from '@/components/common'
import { judgeCalc, type JudgeReply } from '@/lib/api'
import LegalIssues from '@/components/LegalIssues'
import JudgmentCard, { type JudgmentChip } from '@/components/JudgmentCard'
import { calcIssues } from '@/lib/legal'
import { MIN_WAGE, WEEKS_PER_MONTH as WPM, won, type CalcInput, type CalcResult } from '@/lib/calc'
import { useStore } from '@/store'

const NUM_FIELDS: [keyof CalcInput, string, string, string][] = [
  ['hourly', '시급 (원)', '예: 10320', '계약서·급여명세서 기준'],
  ['weekly', '주 근로시간 (계약)', '예: 20', '휴게·연장 시간 제외, 일하기로 정한 시간'],
  ['months', '일한 기간 (개월)', '예: 3', '대략이어도 돼요'],
  ['ot', '주당 연장 시간', '없으면 비움', ''],
  ['night', '주당 야간 시간 (22~06시)', '없으면 비움', ''],
  ['hol', '주당 휴일 근로 시간', '없으면 비움', ''],
  ['missedWeeks', '결근한 주 (주 수)', '없으면 0', '하루라도 통째로 빠진 주'],
]
const CHECKS: [keyof CalcInput, string, string?][] = [
  ['under5', '상시 근로자 5인 미만', '사장님 포함 5명이 안 되면 체크'],
  ['holidayPaid', '주휴수당을 받고 있음', '명세서에 "주휴수당" 항목이 따로 있을 때만 체크. "시급에 포함"이라는 말만 들었다면 체크하지 마세요.'],
  ['extraPaid', '가산수당을 받고 있음', '연장·야간·휴일 수당이 명세서에 따로 있을 때만 체크'],
]

// 금액이 0에서 올라가며 나타남 (모션 줄이기 설정이면 바로 표시)
function CountWon({ value }: { value: number }) {
  const [v, setV] = useState(value)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(value); return }
    const t0 = performance.now(); let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      setV(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{won(v)}</>
}

// 계산 결과를 "총 얼마를 받아야 하고 어디서 깎였는지" 한 문장으로 요약
function summarySentence(c: CalcResult) {
  const reasons: string[] = []
  if (c.holUnpaid > 0) reasons.push(`주휴수당 ${won(c.holUnpaid)}`)
  if (c.extraUnpaid > 0) reasons.push(`가산수당 ${won(c.extraUnpaid)}`)
  if (c.minWageUnpaid > 0) reasons.push(`최저임금 차액 ${won(c.minWageUnpaid)}`)
  if (!reasons.length) return `${c.months || 0}개월 동안 받아야 할 급여는 총 약 ${won(c.totalDue)}(한 달 평균 약 ${won(c.monthlyDue)})이고, 입력하신 조건으로는 미지급 항목이 확인되지 않았어요.`
  return `${c.months || 0}개월 동안 받아야 할 급여는 총 약 ${won(c.totalDue)}(한 달 평균 약 ${won(c.monthlyDue)})인데, 그중 ${reasons.join(' + ')}을 못 받으신 것으로 보여요.`
}

// 계산 결과를 보고 HoLab이 내린 판단: 확인된 사실 + 다음으로 계약서 분석을 권하는 이유
function judge(c: CalcResult) {
  const facts: string[] = []
  const missed = Math.round(c.missedWeeks * 10) / 10
  if (c.minWageGap > 0) facts.push(`시급 ${c.hourly.toLocaleString()}원이 2026년 최저임금(${MIN_WAGE.toLocaleString()}원)보다 ${c.minWageGap.toLocaleString()}원 낮아요. (차액 ${won(c.minWageUnpaid)})`)
  if (c.holUnpaid > 0) facts.push(`주휴수당 ${won(c.holUnpaid)}을 받지 못한 것으로 계산돼요.`)
  if (c.extraUnpaid > 0) facts.push(`연장·야간·휴일 가산수당 ${won(c.extraUnpaid)}을 받지 못한 것으로 계산돼요.`)
  if (c.weekly < 15) facts.push('주 15시간 미만이라 주휴수당 지급 대상이 아니에요.')
  if (missed > 0) facts.push(`일하기로 한 날을 빠진 ${missed}주는 개근이 아니어서 주휴수당에서 뺐어요.`)
  if (c.under5) facts.push('5인 미만 사업장이라 가산수당은 적용되지 않지만, 주휴수당과 최저임금은 적용돼요.')
  let reason: string
  if (c.minWageGap > 0) reason = '계약서에 적힌 시급이 법 기준보다 낮은 것이 문제의 핵심일 수 있어서, 계약서의 시급·수습·공제 조항을 먼저 확인하는 게 좋아요.'
  else if (c.holUnpaid > 0) reason = '“주휴수당은 시급에 포함” 같은 문구가 계약서에 있는지 확인하면 청구 근거를 잡을 수 있어요.'
  else if (c.extraUnpaid > 0) reason = '연장·야간·휴일 근로에 수당을 어떻게 정했는지 계약서에서 확인해 보세요.'
  else reason = '계산상 미지급 항목은 없지만, 계약서에 불리한 조항이 있는지 한 번 점검해 두면 좋아요.'
  return { facts, reason }
}

// AI 판단: 계산 결과(숫자만, 개인정보 없음)를 서버에 보내 받아옴. 같은 결과는 다시 묻지 않고, 실패하면 위 규칙 기반 판단을 보여 줌
const judgeCache = new Map<string, JudgeReply>()
const judgeKey = (c: CalcResult) => [c.hourly, c.weekly, c.months, c.missedWeeks, c.under5, c.holidayPaid, c.extraPaid, Math.round(c.total), Math.round(c.totalDue)].join('|')
function useAiJudge(calc: CalcResult | null) {
  const key = calc ? judgeKey(calc) : ''
  const [res, setRes] = useState<{ key: string; data: JudgeReply | null } | null>(null)
  useEffect(() => {
    if (!calc) return
    const hit = judgeCache.get(key)
    if (hit) { setRes({ key, data: hit }); return }
    let live = true
    judgeCalc({
      hourly: calc.hourly, minWage: MIN_WAGE, weekly: calc.weekly, months: calc.months, missedWeeks: calc.missedWeeks,
      under5: calc.under5, holidayPaid: calc.holidayPaid, extraPaid: calc.extraPaid,
      holUnpaid: calc.holUnpaid, extraUnpaid: calc.extraUnpaid, minWageUnpaid: calc.minWageUnpaid, total: calc.total,
      monthlyDue: calc.monthlyDue, totalDue: calc.totalDue,
    }).then((d) => { if (!d.demo) judgeCache.set(key, d); if (live) setRes({ key, data: d.demo ? null : d }) })
      .catch(() => { if (live) setRes({ key, data: null }) })
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return { loading: !!calc && res?.key !== key, ai: res?.key === key ? res.data : null }
}
// 계약서·급여명세서가 없거나 금액을 모를 때: 어떻게 진행하면 되는지 + 통장 입금액으로 시급 어림하기
function NoAmountHelp({ onHourly }: { onHourly: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const [pay, setPay] = useState('')
  const [hours, setHours] = useState('')
  const est = +pay > 0 && +hours > 0 ? Math.round(+pay / +hours) : 0
  return (
    <div className="rounded-xl border border-dashed p-3 text-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left font-semibold">
        <CircleHelp className="size-4 shrink-0 text-primary" /> 계약서나 급여명세서가 없어서 금액을 모르겠어요
        <span className="ml-auto text-[13px] font-normal text-primary">{open ? '닫기' : '방법 보기'}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3">
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li><b className="text-foreground">통장 입금액으로 어림해요.</b> 한 달에 들어온 월급 ÷ 그 달에 일한 시간 = 대략의 시급이에요. 아래에서 바로 계산해 드려요.</li>
            <li><b className="text-foreground">채용 공고·문자·카톡을 찾아봐요.</b> “시급 ○○원”이라고 적힌 대화나 공고 캡처가 있으면 그 금액을 쓰세요.</li>
            <li><b className="text-foreground">그래도 모르면 최저임금({MIN_WAGE.toLocaleString()}원)으로 계산해요.</b> 그러면 결과는 “적어도 이만큼은 받아야 한다”는 최소 금액이에요.</li>
            <li><b className="text-foreground">급여명세서는 요청할 수 있어요.</b> 사업주는 임금을 줄 때 임금명세서를 줘야 해요(근로기준법 제48조). 받은 적이 없다면 그것도 상담 내용이 돼요.</li>
          </ol>
          <div className="grid gap-2 rounded-lg bg-muted/50 p-3">
            <b className="text-[13px]">통장 입금액으로 시급 어림하기</b>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-[13px] text-muted-foreground">한 달에 들어온 돈 (원)<Input type="number" min={0} value={pay} onChange={(e) => setPay(e.target.value)} placeholder="예: 800000" className="h-9 w-40" /></label>
              <label className="grid gap-1 text-[13px] text-muted-foreground">그 달에 일한 시간<Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="예: 86" className="h-9 w-32" /></label>
              <Button size="sm" variant="outline" disabled={!est} onClick={() => onHourly(est)}>{est ? `시급 약 ${est.toLocaleString()}원으로 채우기` : '두 칸을 입력하세요'}</Button>
              <Button size="sm" variant="ghost" onClick={() => onHourly(MIN_WAGE)}>최저임금으로 채우기</Button>
            </div>
            <p className="text-[13px] text-muted-foreground">세금·4대보험이 빠진 금액이면 실제 시급보다 조금 낮게 나와요. 주휴수당이 섞여 있을 수도 있으니 결과는 어림값으로 봐 주세요.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StepCalc() {
  const { calcIn, setCalcIn, calc, runCalc, go, calcAuto, setCalcAuto, masked, pasteText, analysis, setNextRec } = useStore()
  const bad = !!calc && calc.total > 0
  const { loading: judging, ai: aiJudge } = useAiJudge(calc)
  useEffect(() => {
    if (!calc || judging) return
    const k = aiJudge?.recommend?.key ?? 'contract'
    const STEP = { contract: [2, '계약서 분석'], complaint: [3, '진정서 작성'], lawyer: [4, '노무사 매칭'] } as const
    setNextRec({ from: '못 받은 돈 확인', step: STEP[k][0], label: STEP[k][1], reason: aiJudge?.recommend?.reason || judge(calc).reason })
  }, [calc, judging, aiJudge]) // eslint-disable-line react-hooks/exhaustive-deps
  const [helpOpen, setHelpOpen] = useState<string | null>(null)
  // "잘 모르겠어요"를 고른 항목: 체크 해제 상태로 계산은 계속하고, 결과에 "추가 확인 필요"로 표시
  const [unknown, setUnknown] = useState<Set<string>>(new Set())
  const toggleUnknown = (k: string) => {
    const next = new Set(unknown)
    if (next.has(k)) next.delete(k)
    else { next.add(k); setCalcIn({ [k]: false } as Partial<CalcInput>) }
    setUnknown(next)
  }
  const unknownLabels = CHECKS.filter(([k]) => unknown.has(k)).map(([, l]) => l)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">못 받은 돈 확인</CardTitle>
        <CardDescription>근무 조건을 넣으면 못 받은 돈을 계산해요. (2026년 최저임금 10,320원 기준 · 입력값은 이 브라우저에서만 계산돼요)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {calcAuto.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/10 p-3 text-[13px]">
            <Badge>AI 상담에서 가져옴</Badge>
            <span>말씀하신 내용에서 채운 항목이에요. 맞는지 확인하고 틀리면 고치세요:</span>
            {calcAuto.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
            <Button variant="ghost" size="sm" className="ml-auto h-auto px-2 py-1 text-[13px]" onClick={() => setCalcAuto([])}>확인했어요</Button>
          </div>
        )}
        <NoAmountHelp onHourly={(v) => setCalcIn({ hourly: String(v) })} />
        <div className="grid gap-4 sm:grid-cols-3">
          {NUM_FIELDS.map(([k, label, ph, hint]) => (
            <Field key={k} label={label}>
              <Input type="number" min={0} step="any" value={calcIn[k] as string} placeholder={ph} onChange={(e) => setCalcIn({ [k]: e.target.value })} />
              {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
            </Field>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHECKS.map(([k, label, help]) => (
            <div key={k} className="grid gap-1.5">
              <div className="flex items-center gap-2.5">
                <Checkbox id={`c-${k}`} checked={calcIn[k] as boolean} onCheckedChange={(v) => setCalcIn({ [k]: !!v })} />
                <Label htmlFor={`c-${k}`} className="cursor-pointer font-normal">{label}</Label>
                {help && (
                  <button type="button" aria-label={`${label} 설명 보기`} onClick={() => setHelpOpen((v) => (v === k ? null : k))} className="text-muted-foreground hover:text-foreground">
                    <CircleHelp className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={unknown.has(k)}
                  onClick={() => toggleUnknown(k)}
                  className={`ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-[13px] ${unknown.has(k) ? 'border-primary bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  잘 모르겠어요
                </button>
              </div>
              {help && helpOpen === k && (
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-[13px] leading-relaxed text-muted-foreground">
                  <span className="flex-1">{help}</span>
                  <button type="button" aria-label="설명 닫기" onClick={() => setHelpOpen(null)} className="shrink-0"><X className="size-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div>
          {/* 계산 전엔 주요 버튼, 계산 후엔 아래 "다음 단계" 버튼에 주요 자리를 넘기고 보조로 낮춤(한 화면에 파란 버튼 1개만) */}
          <Button variant={calc ? 'outline' : 'default'} onClick={() => { if (!runCalc()) alert('시급과 주 근로시간을 입력하세요.') }}>
            {calc ? '다시 계산하기' : '계산하기'}
          </Button>
        </div>

        {calc && (
          <div className="grid gap-4">
            <div className={`rounded-xl border p-5 ${bad ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-400/30 bg-emerald-500/10'}`}>
              {bad ? (
                <>
                  <p className="text-sm text-muted-foreground">확인된 <b className="text-foreground">미지급 추정액</b> ({calc.months || 0}개월 기준)</p>
                  <p className="mt-1 text-4xl font-extrabold tracking-tight text-destructive"><CountWon value={calc.total} /></p>
                </>
              ) : (
                <p className="text-3xl font-extrabold text-emerald-700">미지급 추정액 없음</p>
              )}
              <p className="mt-4 text-sm leading-relaxed">{summarySentence(calc)}</p>
              {bad && <p className="mt-1 text-[13px] text-muted-foreground">임금채권 소멸시효는 3년이에요.</p>}
            </div>

            {(() => {
              const rec = +calcIn.received || 0
              const monthlyFill = Math.round(calc.hourly * calc.weekly * WPM)
              const showTotal = calc.months > 0
              const recTotal = rec * calc.months
              const shortM = Math.max(0, calc.monthlyDue - rec)
              const shortT = Math.max(0, calc.totalDue - recTotal)
              const short = (v: number) => (v > 0 ? <span className="font-bold text-destructive">{won(v)}</span> : '부족분 없음')
              return (
                <div className="grid gap-3 rounded-xl border p-4">
                  <div>
                    <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">실제로 받은 금액과 비교해 볼까요? <Badge variant="secondary">선택</Badge></h4>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">한 달 평균 세전 금액을 적으면 나란히 비교해요.</p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="grid w-full max-w-xs gap-1.5">
                      <Label htmlFor="received">실제로 받은 급여 (한 달 평균, 세전, 원)</Label>
                      <Input id="received" type="number" min={0} step="any" value={calcIn.received ?? ''} placeholder="예: 1238325" onChange={(e) => setCalcIn({ received: e.target.value })} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCalcIn({ received: String(monthlyFill) })}>계약 시급({calc.hourly.toLocaleString()}원)대로 받은 경우로 채우기 · {won(monthlyFill)}</Button>
                  </div>
                  {rec > 0 && (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>구분</TableHead>
                            <TableHead className="text-right">한 달 평균</TableHead>
                            {showTotal && <TableHead className="text-right">{calc.months}개월 합계</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow><TableCell>법적으로 받아야 할 급여</TableCell><TableCell className="text-right">{won(calc.monthlyDue)}</TableCell>{showTotal && <TableCell className="text-right">{won(calc.totalDue)}</TableCell>}</TableRow>
                          <TableRow><TableCell>실제로 받은 급여</TableCell><TableCell className="text-right">{won(rec)}</TableCell>{showTotal && <TableCell className="text-right">{won(recTotal)}</TableCell>}</TableRow>
                          <TableRow className="font-bold"><TableCell>= 부족한 금액</TableCell><TableCell className="text-right">{short(shortM)}</TableCell>{showTotal && <TableCell className="text-right">{short(shortT)}</TableCell>}</TableRow>
                        </TableBody>
                      </Table>
                      {showTotal && Math.abs(shortT - calc.total) > 1000 && (
                        <p className="text-[13px] text-muted-foreground">위 부족액은 실제 입금 기준이고, 항목별 계산(주휴수당·최저임금 차액 등)은 {won(calc.total)}이에요. 차이가 크면 급여명세서의 항목별 금액을 확인해 보세요.</p>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
            {unknownLabels.length > 0 && (
              <Alert><CircleHelp /><AlertDescription>추가 확인 필요: {unknownLabels.join(', ')} 항목은 “잘 모르겠어요”로 두고 계산했어요. 급여명세서나 계약서로 확인하면 결과가 더 정확해져요.</AlertDescription></Alert>
            )}

            <details className="group rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-semibold">왜 이렇게 계산됐나요?</summary>
            <div className="mt-3 grid gap-2">
              <h4 className="text-sm font-semibold text-muted-foreground">법정 기준으로 계산한 급여 구성 (아래 항목을 다 더하면 받아야 할 급여가 돼요)</h4>
              {(() => {
                const w = calc.weeks
                const showTotal = w > 0
                const rows: [string, number | string, number | string, boolean?][] = [
                  [`기본급 (${calc.legalHourly.toLocaleString()}원${calc.legalHourly > calc.hourly ? ' · 최저임금 기준' : ''} × 주 ${calc.weekly}시간)`, calc.basePay * WPM, calc.basePay * w],
                  [calc.weekly < 15 ? '주휴수당 (주 15시간 미만이라 대상 아님)' : `주휴수당 (주 ${Math.min(calc.weekly, 40)}시간 ÷ 40 × 8시간 = 주 ${calc.holHours.toFixed(1)}시간분 × ${calc.legalHourly.toLocaleString()}원${calc.missedWeeks > 0 ? `, 빠진 ${Math.round(calc.missedWeeks * 10) / 10}주 제외` : ''})`, calc.eligible ? calc.monthlyHolPay : '해당 없음', calc.eligible ? calc.weeklyHolPay * calc.holWeeks : '해당 없음'],
                ]
                if (calc.ot + calc.hol > 0) rows.push(['연장·휴일 근로 기본급', (calc.ot + calc.hol) * calc.legalHourly * WPM, (calc.ot + calc.hol) * calc.legalHourly * w])
                rows.push(['연장·야간·휴일 가산수당 (+50%)', calc.under5 ? '5인 미만 – 미적용' : calc.extraWeekly * WPM, calc.under5 ? '5인 미만 – 미적용' : calc.extraWeekly * w])
                const fmt = (v: number | string) => (typeof v === 'number' ? won(v) : v)
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>항목</TableHead>
                        <TableHead className="text-right">한 달 평균</TableHead>
                        {showTotal && <TableHead className="text-right">{calc.months}개월 합계</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(([label, m, tot]) => (
                        <TableRow key={label}><TableCell>{label}</TableCell><TableCell className="text-right">{fmt(m)}</TableCell>{showTotal && <TableCell className="text-right">{fmt(tot)}</TableCell>}</TableRow>
                      ))}
                      <TableRow className="font-bold"><TableCell>= 받아야 할 급여 (세전)</TableCell><TableCell className="text-right">{won(calc.monthlyDue)}</TableCell>{showTotal && <TableCell className="text-right">{won(calc.totalDue)}</TableCell>}</TableRow>
                    </TableBody>
                  </Table>
                )
              })()}
            </div>
            </details>

            {bad && (
              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-muted-foreground">그중 아직 못 받은 것으로 보이는 금액</h4>
                <Table>
                  <TableHeader><TableRow><TableHead>미지급 항목</TableHead><TableHead className="text-right">금액</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {calc.holUnpaid > 0 && <TableRow><TableCell className="flex items-center gap-1.5"><XCircle className="size-3.5 text-destructive" /> 주휴수당</TableCell><TableCell className="text-right text-destructive">{won(calc.holUnpaid)}</TableCell></TableRow>}
                    {calc.extraUnpaid > 0 && <TableRow><TableCell className="flex items-center gap-1.5"><XCircle className="size-3.5 text-destructive" /> 가산수당</TableCell><TableCell className="text-right text-destructive">{won(calc.extraUnpaid)}</TableCell></TableRow>}
                    {calc.minWageUnpaid > 0 && <TableRow><TableCell className="flex items-center gap-1.5"><XCircle className="size-3.5 text-destructive" /> 최저임금 차액</TableCell><TableCell className="text-right text-destructive">{won(calc.minWageUnpaid)}</TableCell></TableRow>}
                    <TableRow className="font-bold"><TableCell>합계</TableCell><TableCell className="text-right">{won(calc.total)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {(() => {
              const rule = judge(calc)
              const STEP = { contract: { n: 2, label: '계약서 분석' }, complaint: { n: 3, label: '진정서 작성' }, lawyer: { n: 4, label: '노무사 상담' } } as const
              const key = aiJudge?.recommend?.key ?? 'contract'
              const reason = aiJudge?.recommend?.reason || rule.reason
              const chips: JudgmentChip[] = []
              if (calc.total > 0) chips.push({ label: '못 받은 돈', value: won(calc.total), tone: 'bad' })
              if (calc.holUnpaid > 0) chips.push({ label: '주휴수당', value: won(calc.holUnpaid), tone: 'bad' })
              if (calc.minWageUnpaid > 0) chips.push({ label: '최저임금 차액', value: won(calc.minWageUnpaid), tone: 'bad' })
              if (calc.extraUnpaid > 0) chips.push({ label: '가산수당', value: won(calc.extraUnpaid), tone: 'bad' })
              if (!chips.length) chips.push({ label: '미지급', value: '없음', tone: 'ok' })
              return (
                <JudgmentCard
                  loading={judging} ai={!!aiJudge}
                  headline={`${STEP[key].label}으로 이어가세요`}
                  action={`${STEP[key].label}으로 가기`} onAction={() => go(STEP[key].n)}
                  reason={reason} chips={chips.slice(0, 3)}
                  extra={key !== 'complaint' && bad ? <Button variant="ghost" size="sm" onClick={() => go(3)}>바로 진정서 작성</Button> : undefined}
                >
                  {aiJudge?.summary && <p>{aiJudge.summary}</p>}
                  {rule.facts.length > 0 && <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{rule.facts.map((f) => <li key={f}>{f}</li>)}</ul>}
                </JudgmentCard>
              )
            })()}
            <LegalIssues issues={calcIssues(calc, masked || pasteText, analysis)} heading="관련 법 조항 · 입력하신 내용 기준" />

          </div>
        )}
      </CardContent>
    </Card>
  )
}



