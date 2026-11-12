import { useEffect, useState } from 'react'
import { ArrowRight, MessageCircle, Scale, X } from 'lucide-react'
import LegalIssues from '@/components/LegalIssues'
import Mascot from '@/components/Mascot'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { won } from '@/lib/calc'
import { calcIssues, clauseIssues, dedupeIssues } from '@/lib/legal'
import { useStore } from '@/store'

// "올랍이"가 지금까지 파악한 것과 다음에 쓰면 좋은 기능을 말풍선으로 안내해 줘요.
// 넓은 화면에서는 왼쪽 빈 곳에 붙어 있고, 좁은 화면에서는 왼쪽 아래 마스코트 버튼을 누르면 말풍선이 열려요.
const hasBatchim = (w: string) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 }
const eulReul = (w: string) => (hasBatchim(w) ? '을' : '를')
const iGa = (w: string) => (hasBatchim(w) ? '이' : '가')

function Bubble({ onLaw }: { onLaw: () => void }) {
  const { step, go, calc, analysis, legalConsult, masked, pasteText, nextRec, caseLabel, setConsultOpen } = useStore()
  const legal = dedupeIssues([...clauseIssues(analysis), ...(calc ? calcIssues(calc, masked || pasteText, analysis) : []), ...legalConsult])
  const docN = legal.filter((x) => x.basis === 'document').length
  const known = !!caseLabel || !!calc || !!analysis || legal.length > 0 || !!nextRec
  const here = nextRec?.step === step

  return (
    <div className="relative w-full rounded-2xl border border-primary/30 bg-card p-4 text-sm leading-relaxed shadow-sm">
      <span aria-hidden="true" className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-l border-t border-primary/30 bg-card" />
      {!known ? (
        <div className="grid gap-2.5">
          <p><b>안녕하세요, 저는 올랍이예요!</b> <span className="text-muted-foreground">HoLab 안에서 길을 안내하는 AI 도우미예요.</span></p>
          <p className="text-muted-foreground">어디서부터 해야 할지 모르겠다면 저에게 상황을 말해 주세요. 지금 쓰면 좋은 기능을 순서대로 알려 드릴게요.</p>
          <Button size="sm" onClick={() => setConsultOpen(true)}><MessageCircle /> 내 상황 이야기하기</Button>
        </div>
      ) : (
        <div className="grid gap-2.5">
          <p><b>지금까지 이렇게 정리했어요.</b></p>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {caseLabel && <li>말씀하신 상황은 <b className="text-foreground">{caseLabel}</b> 문제 같아요.</li>}
            {calc && <li>{calc.total > 0 ? <>못 받은 돈은 약 <b className="text-foreground">{won(calc.total)}</b>으로 계산됐어요.</> : '입력하신 조건으로는 못 받은 돈이 없어요.'}</li>}
            {analysis && <li>계약서에서 살펴볼 조항을 <b className="text-foreground">{analysis.clauses.length}건</b> 찾았어요.</li>}
            {legal.length > 0 && (
              <li>
                관련 법 조항이 <b className="text-foreground">{legal.length}건</b> 있어요{docN > 0 ? ` (위반 ${docN}건 포함)` : ''}.{' '}
                <button type="button" onClick={onLaw} className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2"><Scale className="size-3.5" /> 눌러서 보기</button>
              </li>
            )}
          </ul>
          {nextRec && (
            <>
              <p className="pt-1">{here
                ? <>지금 보고 계신 <b>{nextRec.label}</b>{iGa(nextRec.label)} 바로 추천이에요!</>
                : <>다음엔 <b>{nextRec.label}</b>{eulReul(nextRec.label)} 해 보면 좋겠어요.</>}</p>
              <p className="rounded-lg bg-primary/5 p-2.5 text-[13px]"><b>왜냐하면</b> {nextRec.reason} <span className="text-muted-foreground">({nextRec.from} 기준)</span></p>
              {!here && <Button size="sm" onClick={() => go(nextRec.step)}>{nextRec.label} 하러 가기 <ArrowRight /></Button>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function BriefingGuide({ mode }: { mode: 'rail' | 'float' }) {
  const { calc, analysis, legalConsult, masked, pasteText, nextRec } = useStore()
  const [lawOpen, setLawOpen] = useState(false)
  const [open, setOpen] = useState(false) // 좁은 화면의 말풍선 열림
  const [seen, setSeen] = useState('') // 마지막으로 본 추천 (새 추천이 오면 점으로 알려 줌)
  const [talk, setTalk] = useState(false)
  const key = nextRec ? `${nextRec.step}|${nextRec.reason}` : ''
  const legal = dedupeIssues([...clauseIssues(analysis), ...(calc ? calcIssues(calc, masked || pasteText, analysis) : []), ...legalConsult])

  // 새 추천이 오면 올랍이가 잠깐 말하는 모습
  useEffect(() => {
    if (!key) return
    setTalk(true)
    const t = setTimeout(() => setTalk(false), 2200)
    return () => clearTimeout(t)
  }, [key])

  const lawDialog = (
    <Dialog open={lawOpen} onOpenChange={setLawOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>관련 법 조항</DialogTitle>
          <DialogDescription>눌러서 자세히 볼 수 있어요. 계약서 같은 확실한 자료가 있으면 “위반이에요”, 말씀하신 내용만 있으면 “해당될 수 있어요”로 알려 드려요.</DialogDescription>
        </DialogHeader>
        <LegalIssues issues={legal} heading="관련 법 조항 · 눌러서 자세히 보기" openFirst />
      </DialogContent>
    </Dialog>
  )

  const unread = !!key && key !== seen
  useEffect(() => { if (open && key) setSeen(key) }, [open, key]) // 열려 있는 동안엔 새 내용도 바로 본 것으로

  if (mode === 'rail') {
    return (
      <div className="grid justify-items-center gap-2" aria-label="올랍이의 안내">
        <button
          type="button" aria-expanded={open} aria-label={open ? '올랍이의 안내 닫기' : unread ? '올랍이의 새 안내 열기' : '올랍이의 안내 열기'}
          onClick={() => setOpen((v) => !v)}
          className="relative rounded-3xl p-1 outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/40"
        >
          <Mascot size={112} talking={talk} />
          {unread && <span className="absolute right-3 top-1 size-4 rounded-full border-2 border-background bg-red-600 animate-pulse" aria-hidden="true" />}
        </button>
        {!open && (
          <p className="text-center text-[13px] text-muted-foreground">
            {unread ? <b className="text-red-600">새 안내가 있어요</b> : '올랍이를 눌러 보세요'}
          </p>
        )}
        {open && <Bubble onLaw={() => setLawOpen(true)} />}
        {lawDialog}
      </div>
    )
  }
  return (
    <div className="lg:hidden">
      {open && (
        <div className="fixed bottom-24 left-3 right-3 z-40 max-h-[70vh] overflow-y-auto rounded-2xl bg-background/95 p-1 shadow-2xl sm:right-auto sm:w-[22rem]" role="dialog" aria-label="올랍이의 안내">
          <div className="relative pt-2">
            <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="absolute right-2 top-3 z-10 rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            <Bubble onLaw={() => setLawOpen(true)} />
          </div>
        </div>
      )}
      <button
        type="button" aria-expanded={open} aria-label={open ? '올랍이의 안내 닫기' : '올랍이의 안내 열기'}
        onClick={() => { setOpen((v) => !v); setSeen(key) }}
        className="fixed bottom-4 left-3 z-40 flex size-16 items-center justify-center rounded-full border-2 border-primary/40 bg-card shadow-xl outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/40"
      >
        <Mascot size={46} talking={talk} />
        {unread && <span className="absolute -right-0.5 -top-0.5 size-4 rounded-full border-2 border-card bg-red-600" aria-label="새 안내가 있어요" />}
      </button>
      {lawDialog}
    </div>
  )
}
