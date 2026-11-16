import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'

// 어려운 노동법 용어를 누르면 한두 줄 쉬운 풀이가 뜨는 작은 말풍선
export const GLOSSARY: Record<string, string> = {
  주휴수당: '1주에 일하기로 한 날을 모두 나오면 받는 "하루치 쉬는 날 월급"이에요. 1주 15시간 이상 일하면 받을 수 있어요. (근로기준법 제55조)',
  소정근로시간: '근로계약서에 "일하기로 정한" 시간이에요. 쉬는 시간(휴게시간)과 더 일한 시간(연장근로)은 빼요.',
  가산수당: '연장·야간·휴일에 일하면 시급의 50%를 더 받는 돈이에요. 상시 근로자 5인 미만 사업장은 적용되지 않아요. (근로기준법 제56조)',
  연장근로: '하루 8시간이나 1주 40시간을 넘겨서 일한 시간이에요.',
  야간근로: '밤 10시부터 다음 날 아침 6시 사이에 일한 시간이에요.',
  휴일근로: '쉬기로 정한 날(주휴일 등)에 나와서 일한 시간이에요.',
  상시근로자: '사장님을 뺀, 그 사업장에서 일하는 사람 수(알바·단시간 근로자 포함)의 평균이에요. 5명이 안 되면 가산수당·연차휴가 등 일부 규정이 적용되지 않아요.',
  최저임금: '2026년 최저임금은 시급 10,320원이에요. 이보다 적게 주기로 한 계약은 그 부분이 무효예요. (최저임금법 제6조)',
  개근: '1주 동안 일하기로 한 날에 하루도 빠지지 않고 나온 것이에요. 주휴수당을 받으려면 개근해야 해요.',
  임금명세서: '월급을 줄 때 기본급·수당·공제 금액을 항목별로 적어 주는 서류예요. 사업주는 꼭 줘야 해요. (근로기준법 제48조)',
  소멸시효: '못 받은 임금은 3년이 지나면 청구하지 못할 수 있어요. 늦기 전에 진정이나 상담을 하세요.',
  진정서: '노동청(고용노동부)에 "법을 어겼는지 조사해 달라"고 내는 신청서예요. 비용은 없어요.',
  진정인: '진정을 내는 사람, 즉 나예요.',
  피진정인: '진정을 당하는 사람, 즉 사장님이나 회사예요.',
}

export default function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const open = !!pos
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  const text = GLOSSARY[k]
  // 말풍선은 화면 기준(fixed)으로 띄우고, 화면 밖으로 나가지 않게 좌우 위치를 맞춤
  const toggle = () => {
    if (pos) { setPos(null); return }
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(288, window.innerWidth - 16)
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width })
  }
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : e.type === 'scroll' || !ref.current?.contains(e.target as Node)) setPos(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); window.removeEventListener('scroll', close, true) }
  }, [open])
  if (!text) return <>{children ?? k}</>
  return (
    <span ref={ref} className="relative inline">
      <button
        type="button" aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle() }}
        className="inline-flex items-center gap-0.5 underline decoration-dotted decoration-primary/60 underline-offset-4 hover:text-primary"
      >
        {children ?? k}<Info className="size-3.5 shrink-0 text-primary" aria-label="뜻 보기" />
      </button>
      {pos && (
        <span id={id} role="tooltip" style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-50 block rounded-xl border bg-popover p-3 text-left text-sm font-normal leading-relaxed text-popover-foreground shadow-lg">
          <b className="mb-0.5 block text-foreground">{k}</b>{text}
        </span>
      )}
    </span>
  )
}
