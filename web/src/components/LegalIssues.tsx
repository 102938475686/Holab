import { useState } from 'react'
import { ChevronDown, ExternalLink, Scale } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { lawUrl, refOf, verdictOf, type LegalIssue } from '@/lib/legal'

// 법적 쟁점 카드: 어떤 조항에 해당하는지 + 쉬운 풀이 + 내 상황과의 연결 + 먼저 확인할 자료 + 조문 원문(법제처)
// 표현: 계약서처럼 확실한 자료가 있으면 "위반이에요", 말한 내용만 있으면 "해당될 수 있어요"
function Law({ title }: { title: string }) {
  const [text, setText] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'err'>('idle')
  const open = async (o: boolean) => {
    if (!o || text || state === 'busy') return
    const ref = refOf(title)
    if (!ref) { setState('err'); return }
    setState('busy')
    try {
      const r = await fetch('/api/law?ref=' + encodeURIComponent(`${ref.name} ${ref.art}`))
      if (!r.ok) throw new Error('x')
      const d = await r.json()
      setText(String(d.text))
      setState('idle')
    } catch { setState('err') }
  }
  return (
    <details className="text-[13px]" onToggle={(e) => open((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-medium text-primary">조문 원문 보기 (법제처)</summary>
      <div className="mt-1.5 rounded-md bg-muted/50 p-2.5 leading-relaxed">
        {state === 'busy' && <span className="text-muted-foreground">불러오는 중…</span>}
        {state === 'err' && <span className="text-muted-foreground">원문을 불러오지 못했어요. 아래 링크에서 확인해 주세요.</span>}
        {text && <p className="whitespace-pre-wrap">{text}</p>}
        <a className="mt-1.5 inline-flex items-center gap-1 text-primary underline underline-offset-2" href={lawUrl(title)} target="_blank" rel="noreferrer">국가법령정보센터에서 보기 <ExternalLink className="size-3" /></a>
      </div>
    </details>
  )
}

export default function LegalIssues({ issues, heading = '관련 법 조항', loading = false, openFirst = false }: { issues: LegalIssue[]; heading?: string; loading?: boolean; openFirst?: boolean }) {
  if (!issues.length && !loading) return null
  return (
    <div className="grid gap-2.5 rounded-xl border p-4 text-sm" aria-busy={loading}>
      <div className="flex flex-wrap items-center gap-2 font-semibold"><Scale className="size-4 text-primary" /> {heading}</div>
      {loading && <div className="grid gap-2" aria-hidden="true">{[85, 70].map((w) => <div key={w} className="h-3.5 animate-pulse rounded bg-primary/15" style={{ width: `${w}%` }} />)}</div>}
      {issues.map((x, i) => (
        <details key={x.key} open={openFirst && i === 0} className="pop-in group rounded-lg bg-muted/30">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 [&::-webkit-details-marker]:hidden">
            <b className="flex-1 basis-56">{x.title}</b>
            <Badge variant={x.basis === 'document' ? 'destructive' : 'secondary'}>{verdictOf(x.basis)}</Badge>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-1.5 px-3 pb-3">
            <span className="text-[13px] text-muted-foreground">{x.basis === 'document' ? '계약서 등 확실한 자료가 근거예요' : '직접 확인할 자료가 아직 없어 단정하지 않아요'}</span>
            {x.quote && <p className="text-[13px] italic text-muted-foreground">“{x.quote}”</p>}
            {x.plain && <p className="leading-relaxed">{x.plain}</p>}
            {x.situation && <p className="leading-relaxed"><b>내 상황</b> · {x.situation}</p>}
            {x.checks && x.checks.length > 0 && (
              <div className="text-[13px]">
                <b>먼저 확인·준비해 두면 좋은 것</b>
                <ul className="mt-0.5 list-disc pl-5 text-muted-foreground">{x.checks.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            )}
            <Law title={x.title} />
          </div>
        </details>
      ))}
    </div>
  )
}
