import type { ReactNode } from 'react'
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// 모든 "HoLab의 판단"이 같은 모양으로 보이게 하는 카드:
// 결론(추천 기능 + 버튼) → 한 줄 이유 → 핵심 숫자 칩 → (접힌) 자세한 근거
export type JudgmentChip = { label: string; value: string; tone?: 'bad' | 'ok' | 'warn' }

const TONE = {
  bad: 'border-destructive/30 bg-destructive/5 text-destructive',
  warn: 'border-amber-400/40 bg-amber-500/10 text-amber-800',
  ok: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-800',
} as const

export default function JudgmentCard({
  title = 'HoLab의 판단', loading, ai, headline, action, onAction, reason, chips = [], children, extra,
}: {
  title?: string
  loading?: boolean
  ai?: boolean
  headline: string
  action?: string
  onAction?: () => void
  reason?: string
  chips?: JudgmentChip[]
  children?: ReactNode // 접힌 "판단 근거 자세히 보기" 안에 들어갈 내용
  extra?: ReactNode // 결론 아래 보조 버튼들
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm" aria-busy={loading}>
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-primary">
        {title}
        {loading ? <Badge variant="secondary"><Sparkles className="animate-pulse" /> AI가 살펴보는 중…</Badge>
          : ai ? <Badge variant="secondary"><Sparkles /> AI 판단</Badge>
          : <Badge variant="outline">자동 판단</Badge>}
      </div>
      {loading ? (
        <div className="mt-3 grid gap-2" aria-hidden="true">
          {[60, 85].map((w) => <div key={w} className="h-4 animate-pulse rounded bg-primary/15" style={{ width: `${w}%` }} />)}
        </div>
      ) : (
        <div className="pop-in">
          <p className="mt-2 text-lg font-extrabold leading-snug tracking-tight">{headline}</p>
          {reason && <p className="mt-1 leading-relaxed text-muted-foreground">{reason}</p>}
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span key={c.label} className={`rounded-lg border px-2.5 py-1 text-[13px] ${TONE[c.tone ?? 'ok'] ?? ''}`}>
                  {c.label} <b>{c.value}</b>
                </span>
              ))}
            </div>
          )}
          {(action || extra) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {action && <Button size="sm" onClick={onAction}>{action} <ArrowRight /></Button>}
              {extra}
            </div>
          )}
          {children && (
            <details className="group mt-3 rounded-lg bg-background/70 p-3">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-muted-foreground">
                판단 근거 자세히 보기 <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 grid gap-2 leading-relaxed">{children}</div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
