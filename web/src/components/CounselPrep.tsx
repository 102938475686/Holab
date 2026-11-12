import { useEffect, useMemo, useState } from 'react'
import { evidenceList } from '@/lib/evidence'
import { CalendarPlus, Check, ClipboardList, FileDown, Loader2, Mail, Send, Sparkles, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Mascot from '@/components/Mascot'
import { Input } from '@/components/ui/input'
import { won } from '@/lib/calc'
import { clearReservations, downloadIcs, icsFor, loadReservation, methodOf, saveReservation, type MethodKey, type Reservation } from '@/lib/counsel'
import { CALL_QUESTIONS, CENTERS_SOURCE, COMMON_SCOPE, MAIN_PHONE, SEOUL_COUNSEL, counselorOf, unknownFields, type LabLawyer, type Lawyer } from '@/lib/lawyers'
import { fmtKm } from '@/lib/geo'
import { useStore } from '@/store'

// 상담 준비: 상담 리포트·챙길 것 체크리스트·예약 기록, 체크하면 열리는 노무사 이메일 전송
interface Props {
  center: Lawyer
  lawyer?: LabLawyer
  dist: number | null
  chosen: boolean
  openReport: (l: Lawyer) => void
  reportBusy: boolean
  reportSaved: boolean
  saveComplaintPdf: () => void
  cmpBusy: boolean
  mail: { realMail: boolean; to: string; setTo: (s: string) => void; valid: boolean; onSend: (l: Lawyer) => void; sentFor: string | null }
}

export default function CounselPrep({ center, lawyer, dist, chosen, openReport, reportBusy, reportSaved, saveComplaintPdf, cmpBusy, mail }: Props) {
  const { calc, analysis, form, consultNotes, go, markDone, setView, resetAll, caseKey, caseLabel, legalConsult } = useStore()
  const [res, setRes] = useState<Reservation>(() => loadReservation(center.name))
  const [flash, setFlash] = useState('')
  const [editing, setEditing] = useState(false) // 예약 날짜·시간을 입력하는 중
  const [thanks, setThanks] = useState<'booked' | 'done' | null>(null) // 상태를 바꾼 순간 한 번 보여 주는 마무리 인사
  useEffect(() => { setRes(loadReservation(center.name)) }, [center.name])
  useEffect(() => { if (reportSaved) markDone(4) }, [reportSaved]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (editing) setTimeout(() => document.getElementById('res-date')?.focus(), 120) }, [editing])
  useEffect(() => { setEditing(false) }, [center.name])

  const method: MethodKey = 'visit' // 상담 방식 선택은 없애고, 챙길 것은 방문 기준 목록 하나로 통일
  const m = methodOf(method)
  const cn = counselorOf(center)
  const unknown = unknownFields(cn)
  const note = (s: string) => { setFlash(s); setTimeout(() => setFlash(''), 2200) }
  const update = (patch: Partial<Reservation>) => {
    const next = { ...res, ...patch }
    setRes(next); saveReservation(center.name, next)
    if (next.status !== 'before') markDone(4)
  }

  // 진행 단계: 0 이메일 보내기 → 1 예약 → 2 상담 → 3 모두 마침
  const stage = res.status === 'done' ? 3 : res.status === 'booked' ? 2 : res.mailed ? 1 : 0
  // 메일 전송을 마치면 1단계를 자동으로 완료 처리
  useEffect(() => { if (mail.sentFor === center.name && !res.mailed) update({ mailed: true, method }) }, [mail.sentFor]) // eslint-disable-line react-hooks/exhaustive-deps

  // 챙길 것: 상담 내용·계산·계약서로 정한 사건별 증빙(리포트 체크리스트와 같은 목록) + 리포트·진정서 PDF
  const bring = useMemo(() => [
    ...evidenceList({ calc, analysis, caseKey, text: [caseLabel, ...consultNotes, ...legalConsult.map((x) => x.title)].join(' ') }).map((e) => e.label.replace(/\s*\(.*\)$/, '')),
    '상담 준비 리포트 PDF(출력하면 좋아요)',
    ...(form.draft.trim().length >= 20 ? ['진정서 초안 PDF'] : []),
  ], [calc, analysis, caseKey, caseLabel, consultNotes, legalConsult, form.draft])
  const ics = icsFor(center, res, bring)
  const reportTone = m.report === 'must' ? { badge: '꼭 챙기세요', cls: 'bg-red-700 text-white' } : m.report === 'good' ? { badge: '있으면 좋아요', cls: 'bg-primary text-primary-foreground' } : { badge: '선택', cls: 'bg-secondary text-secondary-foreground' }
  const reportRows = [
    { ok: consultNotes.length > 0 || !!calc || !!analysis, label: '사건 요약', src: consultNotes.length ? 'AI 상담' : 'AI가 입력 내용으로 정리' },
    { ok: !!calc, label: calc ? `못 받은 돈 ${won(calc.total)}` : '못 받은 돈', src: '못 받은 돈 확인', go: 1 },
    { ok: !!analysis, label: analysis ? `계약서 쟁점 ${analysis.clauses.length}건` : '계약서 쟁점', src: '계약서 분석', go: 2 },
    { ok: true, label: '노무사에게 물어볼 질문', src: 'AI가 사건에 맞게 작성' },
  ]

  return (
    <section id="prep" aria-labelledby="s4-3" className="scroll-mt-16 grid gap-4 overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/15 via-primary/5 to-background p-5 sm:p-6">
      <div>
        <h3 id="s4-3" className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">4</span> 상담 준비하기</h3>
        <p className="mt-2 text-sm text-muted-foreground">{chosen ? '선택한 노무사' : '아직 고르지 않아 1순위 노무사 기준이에요'}</p>
        <p className="text-lg font-extrabold">{lawyer ? `${lawyer.name} 노무사 · ` : ''}{center.name}{dist != null && dist >= 0.05 && <span className="ml-2 text-sm font-medium text-muted-foreground">{fmtKm(dist)}</span>}</p>
      </div>

      {/* 센터 상담 정보: 상담 준비 바로 아래에서 확인 (전화번호·상담 시간 등) */}
      <details className="rounded-lg border bg-background/70 p-3 text-[13px]">
        <summary className="cursor-pointer font-semibold">이 센터의 상담 정보 · 노무사 정보</summary>
        <div className="mt-2 grid gap-3">
          <dl className="grid gap-1.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">상주 노무사</dt>
            <dd><Badge variant={cn.resident ? 'default' : 'outline'}>{cn.resident ? '공인노무사 상주' : '확인 필요'}</Badge> <span className="text-muted-foreground">서울노동포털 안내 기준{cn.names ? ` · ${cn.names[0]} 노무사(임시 데이터, 가상 인물)` : ' · 개인 이름은 공개되지 않아요'}</span></dd>
            <dt className="text-muted-foreground">노동상담 전화</dt>
            <dd><b>{center.phone}</b>{MAIN_PHONE[center.name] && MAIN_PHONE[center.name].replace(/\D/g, '').slice(0, 9) !== center.phone.replace(/\D/g, '').slice(0, 9) && <span className="text-muted-foreground"> · 대표 {MAIN_PHONE[center.name]}</span>}</dd>
            <dt className="text-muted-foreground">서울 통합상담</dt>
            <dd><b>{SEOUL_COUNSEL.hotline}</b> <span className="text-muted-foreground">{SEOUL_COUNSEL.hotlineHours}</span></dd>
            <dt className="text-muted-foreground">상담 요일·시간</dt>
            <dd>{cn.hours ?? <span className="text-muted-foreground">공개 자료 없음 · 전화로 확인해 주세요</span>}</dd>
            <dt className="text-muted-foreground">전담 분야</dt>
            <dd>{cn.specialties?.join(', ') ?? <span className="text-muted-foreground">공개 자료 없음 · 모든 센터 공통: {COMMON_SCOPE}</span>}</dd>
            <dt className="text-muted-foreground">이용 대상</dt>
            <dd>{SEOUL_COUNSEL.who}</dd>
          </dl>
          {unknown.length > 0 && (
            <div className="rounded-md bg-muted/50 p-2.5">
              <div className="font-semibold">공개되지 않은 정보: {unknown.join(', ')}</div>
              <p className="mt-0.5 text-muted-foreground">전화할 때 이렇게 물어보세요.</p>
              <ol className="mt-1 list-decimal pl-5">{CALL_QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ol>
            </div>
          )}
          <p className="text-muted-foreground">출처: <a className="underline" href={CENTERS_SOURCE.url} target="_blank" rel="noreferrer">{CENTERS_SOURCE.label}</a> · <a className="underline" href={SEOUL_COUNSEL.source.url} target="_blank" rel="noreferrer">{SEOUL_COUNSEL.source.label}</a> ({SEOUL_COUNSEL.source.checkedAt} 확인)</p>
        </div>
      </details>

      {/* 상담 리포트: 방식에 따라 필요한 정도가 달라요 */}
      {m.report === 'optional' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/80 p-4">
          <ClipboardList className="size-5 shrink-0 text-primary" />
          <div className="min-w-[200px] flex-1">
            <div className="flex flex-wrap items-center gap-2 font-semibold">상담 준비 리포트 <span className={`rounded-full px-2 text-[13px] ${reportTone.cls}`}>{reportTone.badge}</span></div>
            <p className="text-[13px] text-muted-foreground">{m.reportNote}</p>
          </div>
          <Button variant="outline" onClick={() => openReport(center)} disabled={reportBusy}>{reportBusy ? <Loader2 className="animate-spin" /> : <FileDown />} 리포트 미리보기</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-6 rounded-xl border-2 border-primary/40 bg-background/80 p-4 sm:p-5">
          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge><ClipboardList /> 상담 준비 리포트</Badge>
              <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${reportTone.cls}`}>{reportTone.badge}</span>
              <Badge variant="secondary"><Sparkles /> 앞서 입력한 내용으로 자동 작성</Badge>
            </div>
            <h4 className="mt-2 text-xl font-extrabold leading-snug">상담 30분을 본론부터 시작하세요</h4>
            <p className="mt-1 text-sm text-muted-foreground">{m.reportNote}</p>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {reportRows.map((r) => (
                <li key={r.label} className="flex flex-wrap items-center gap-2">
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${r.ok ? 'bg-emerald-700 text-white' : 'border border-dashed text-muted-foreground'}`}>{r.ok && <Check className="size-3.5" strokeWidth={3} />}</span>
                  <b>{r.label}</b>
                  <span className="text-[13px] text-muted-foreground">{r.ok ? `· ${r.src}에서 자동 반영` : '· 아직 없어요'}</span>
                  {!r.ok && r.go && <Button variant="link" size="sm" className="h-auto p-0 text-[13px]" onClick={() => go(r.go!)}>{r.src}으로 가기</Button>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-12 px-6 text-base font-bold" onClick={() => openReport(center)} disabled={reportBusy}>
                {reportBusy ? <Loader2 className="animate-spin" /> : <FileDown className="size-5" />} 상담 준비 리포트 미리보기
              </Button>
              {(method === 'visit' || method === 'video') && (
                <Button variant="outline" onClick={saveComplaintPdf} disabled={cmpBusy || form.draft.trim().length < 20}>{cmpBusy ? <Loader2 className="animate-spin" /> : <FileDown />} 진정서 PDF</Button>
              )}
            </div>
            {(method === 'visit' || method === 'video') && form.draft.trim().length < 20 && <p className="mt-1.5 text-[13px] text-muted-foreground">진정서는 `진정서 작성`에서 내용을 작성하면 저장할 수 있어요. 아직 안 했다면 리포트만 있어도 돼요.</p>}
          </div>
          <div aria-hidden="true" className="hidden w-48 shrink-0 rotate-2 rounded-lg border bg-white p-3 text-[13px] text-slate-700 shadow-xl sm:block">
            <div className="flex items-center justify-between border-b pb-1.5 font-bold text-slate-900"><span>상담 준비 리포트</span><span className="text-primary">HoLab</span></div>
            <div className="mt-2 grid gap-1.5">
              <div className="h-2 w-full rounded bg-slate-200" /><div className="h-2 w-5/6 rounded bg-slate-200" />
              <div className="mt-1 rounded bg-primary/10 px-2 py-1 font-bold text-primary">{calc ? `미지급 ${won(calc.total)}` : '미지급 금액'}</div>
              <div className="font-semibold text-slate-900">관련 법 조항</div>
              <div className="h-2 w-4/5 rounded bg-slate-200" /><div className="h-2 w-2/3 rounded bg-slate-200" />
              <div className="font-semibold text-slate-900">물어볼 질문</div>
              <div className="h-2 w-full rounded bg-slate-200" />
            </div>
          </div>
        </div>
      )}

      {/* 상담까지 진행 순서: ① 이메일 보내기 → ② 예약했어요 → ③ 상담 다녀왔어요. 앞 단계를 마쳐야 다음 단계 버튼이 나와요 (이 기기에만 저장) */}
      <div className="grid gap-4 rounded-xl border bg-background/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">상담까지 진행하기</h4>
          <span className="text-[13px] text-muted-foreground">진행 기록은 이 기기에만 저장돼요. 센터에 전달되지 않아요.</span>
        </div>
        <ol aria-label="상담 진행 순서" className="grid gap-2 sm:grid-cols-3">
          {([['메일', '이메일 보내기'], ['예약', '예약했어요'], ['상담', '상담 다녀왔어요']] as const).map(([k, label], i) => {
            const done = i < stage, cur = i === stage
            return (
              <li key={k} aria-current={cur ? 'step' : undefined}
                className={`flex items-center gap-2.5 rounded-xl border p-3 ${cur ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-emerald-600/50 bg-emerald-600/10' : 'text-muted-foreground'}`}>
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold ${cur ? 'border-white bg-white text-primary' : done ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-muted-foreground/40'}`}>{done ? <Check className="size-4" strokeWidth={3} /> : i + 1}</span>
                <span className="font-semibold">{label}</span>
              </li>
            )
          })}
        </ol>

        <div id="bring-list">
          <b className="text-sm">상담에 챙길 것</b> <span className="text-[13px] text-muted-foreground">· 내 사건(상담·계산·계약서 내용)에 맞춘 목록이에요</span>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {bring.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <Checkbox id={`bring-${b}`} checked={res.checks.includes(b)} onCheckedChange={(v) => update({ method, checks: v ? [...res.checks, b] : res.checks.filter((x) => x !== b) })} className="mt-0.5" />
                <label htmlFor={`bring-${b}`} className="cursor-pointer leading-snug">{b}</label>
              </li>
            ))}
          </ul>
        </div>

        {stage === 0 && (
          <div className={`grid gap-2 rounded-lg border p-3 ${res.checks.length ? 'border-primary/40 bg-primary/5' : 'border-dashed'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="size-4 text-primary" />
              <b className="text-sm">1. 노무사에게 이메일 보내기</b>
              <Badge variant={res.checks.length ? 'default' : 'outline'}>{res.checks.length ? `챙길 것 ${res.checks.length}개 체크됨` : '챙길 것을 체크하면 열려요'}</Badge>
            </div>
            <label className="grid gap-1 text-[13px] text-muted-foreground">받는 이메일 (노무사 이메일이 채워져 있어요. 직접 고칠 수 있어요)
              <Input type="email" value={mail.to} onChange={(e) => mail.setTo(e.target.value)} placeholder="name@example.com" aria-label="받는 이메일" disabled={!res.checks.length} aria-invalid={!!mail.to && !mail.valid} className="h-9 max-w-md text-foreground" />
            </label>
            {mail.to && !mail.valid && <p className="text-[13px] text-destructive">이메일 형식이 올바르지 않아요.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!res.checks.length || !mail.valid} onClick={() => mail.onSend(center)}><Send /> 메일 작성하고 보내기</Button>
              <span className="text-[13px] text-muted-foreground">체크한 자료와 AI 상담·계산·계약서 내용이 메일 초안에 들어가요. 보내기 전에 한 번 더 확인해요.</span>
            </div>
            <Button variant="ghost" size="sm" className="justify-self-start text-muted-foreground" onClick={() => update({ mailed: true, method })}>이메일 대신 전화로 연락했어요 → 다음 단계로</Button>
          </div>
        )}

        {stage === 1 && (
          <div className="pop-in grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Check className="size-4 text-emerald-700" strokeWidth={3} /> 연락을 마쳤어요. 센터와 상담 날짜를 정하셨나요?</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => { update({ status: 'booked', method }); setEditing(true) }}><CalendarPlus /> 2. 예약했어요</Button>
              <Button variant="ghost" size="sm" onClick={() => update({ mailed: false, method })}>이메일 다시 보내기</Button>
            </div>
            <p className="text-[13px] text-muted-foreground">답장이 없으면 센터 노동상담 전화로 예약할 수 있어요. 아래 “이 센터의 상담 정보”에서 번호를 확인하세요.</p>
          </div>
        )}

        {stage === 2 && (editing ? (
          <div className="pop-in grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <b className="text-sm">언제 상담을 예약하셨나요?</b>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-[13px] text-muted-foreground">날짜<Input id="res-date" type="date" value={res.date} onChange={(e) => update({ date: e.target.value, method })} className="h-9 w-44" /></label>
              <label className="grid gap-1 text-[13px] text-muted-foreground">시간<Input id="res-time" type="time" value={res.time} onChange={(e) => update({ time: e.target.value, method })} className="h-9 w-32" /></label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!res.date || !res.time} onClick={() => { setEditing(false); setThanks('booked') }}><Check /> 예약 기록 저장하기</Button>
              <Button variant="ghost" onClick={() => { setEditing(false); setThanks('booked') }}>날짜는 나중에 넣을게요</Button>
            </div>
          </div>
        ) : (
          <div className="pop-in grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarPlus className="size-4 text-primary" />
              <b>예약: {res.date && res.time ? `${res.date} ${res.time}` : '날짜 미정'}</b>
              <Button size="sm" variant="outline" disabled={!ics} onClick={() => ics && downloadIcs(`HoLab_상담_${res.date}`, ics)}>내 일정에 저장 (.ics)</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>날짜 고치기</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => { update({ status: 'done', method }); setThanks('done') }}><Check /> 3. 상담 다녀왔어요</Button>
              <Button variant="ghost" size="sm" onClick={() => update({ status: 'before', method })}>예약 취소(이전 단계로)</Button>
            </div>
          </div>
        ))}

        {stage === 3 && (
          <div className="pop-in flex flex-wrap items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-3 text-sm">
            <Check className="size-4 text-emerald-700" strokeWidth={3} />
            <b>상담까지 모두 마쳤어요. 고생 많으셨어요.</b>
            <Button size="sm" variant="ghost" onClick={() => setThanks('done')}><Sparkles /> 올랍이 인사 보기</Button>
            <Button size="sm" variant="ghost" onClick={() => update({ status: 'booked', method })}>이전 단계로</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span aria-live="polite" className="font-medium text-primary">{flash}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 px-2" onClick={() => { clearReservations(); setRes(loadReservation(center.name)); note('저장된 진행 기록을 지웠어요') }}><Trash2 /> 기록 지우기</Button>
        </div>
      </div>

      <Dialog open={!!thanks} onOpenChange={(o) => { if (!o) setThanks(null) }}>
        <DialogContent className="text-center sm:max-w-md">
          <div className="flex justify-center"><Mascot size={104} /></div>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl">{thanks === 'done' ? '상담을 다녀오셨네요' : '예약까지 잘 마치셨네요!'}</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {thanks === 'done'
                ? '정말 고생 많으셨어요. 상담이 앞으로의 일에 도움이 되길 응원합니다. HoLab을 이용해 주셔서 감사합니다.'
                : '정말 수고하셨어요. 상담 날에는 챙길 것을 한 번만 더 확인해 주세요. 혼자 고민하지 않고 한 걸음 내디딘 것만으로도 큰 용기예요. HoLab을 이용해 주셔서 감사합니다.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {thanks === 'booked' && (
              <>
                {ics
                  ? <Button onClick={() => { downloadIcs(`HoLab_상담_${res.date}`, ics); setThanks(null) }}><CalendarPlus /> 내 일정에 저장 (.ics)</Button>
                  : <Button onClick={() => { setThanks(null); setEditing(true) }}><CalendarPlus /> 날짜·시간 넣고 일정에 저장하기</Button>}
                <Button variant="outline" onClick={() => { setThanks(null); setTimeout(() => document.getElementById('bring-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150) }}><Check /> 챙길 것 확인하기</Button>
              </>
            )}
            <Button variant={thanks === 'booked' ? 'ghost' : 'default'} onClick={() => setThanks(null)}>닫기</Button>
            {thanks === 'done' ? (
              <Button variant="outline" onClick={() => { setThanks(null); resetAll() }}><Trash2 /> 처음으로 돌아가기 (입력한 내용 모두 지우기)</Button>
            ) : (
              <button type="button" onClick={() => { setThanks(null); setView('home'); window.scrollTo({ top: 0 }) }} className="text-[13px] text-muted-foreground underline underline-offset-2">처음 화면으로 가기</button>
            )}
          </div>
          {thanks === 'done' && <p className="text-[13px] text-muted-foreground">“처음으로 돌아가기”를 누르면 이 기기에 입력한 계산·계약서·진정서·상담 내용과 예약 기록이 모두 지워져요. 필요한 PDF는 미리 저장해 두세요.</p>}          <p className="text-[13px] text-muted-foreground">예약은 직접 하신 기록이에요. 센터에 전달되지 않으니, 상담 전에 전화로 한 번 더 확인해 주세요.</p>
        </DialogContent>
      </Dialog>

    </section>
  )
}
