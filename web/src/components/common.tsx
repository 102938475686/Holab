import type { ReactNode } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStore, type FormState } from '@/store'
import { cn } from '@/lib/utils'

// auto: 이전 단계 내용으로 자동 작성된 칸이면 출처를 배지로 보여 줌 (사용자가 고치면 사라짐)
export function Field({ label, children, className, auto }: { label: ReactNode; children: ReactNode; className?: string; auto?: string }) {
  return (
    <div className={cn('grid gap-1.5', auto && 'auto-field', className)}>
      <Label className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {label}
        {auto && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary"><Sparkles className="size-3" />자동 작성 · {auto}</span>}
      </Label>
      {children}
    </div>
  )
}

type StrKeys = { [K in keyof FormState]: FormState[K] extends string ? K : never }[keyof FormState]

export function TextField({ k, label, className, placeholder, type }: { k: StrKeys; label: string; className?: string; placeholder?: string; type?: string }) {
  const { form, setForm, autoSrc, clearAuto } = useStore()
  return (
    <Field label={label} className={className} auto={autoSrc[k]}>
      <Input type={type} value={form[k]} placeholder={placeholder} onChange={(e) => { clearAuto(k); setForm({ [k]: e.target.value } as Partial<FormState>) }} />
    </Field>
  )
}

export function ChoiceField({ k, label, options, className }: { k: StrKeys; label: string; options: string[]; className?: string }) {
  const { form, setForm } = useStore()
  return (
    <Field label={label} className={className}>
      <Select value={form[k]} onValueChange={(v) => v && setForm({ [k]: v } as Partial<FormState>)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  )
}

// 접기 상자: 상자 전체를 누르면 펼쳐지고, 굵은 제목 + 작은 설명 + 오른쪽 화살표로 통일
export function Fold({ title, sub, open, size = 'lg', className, bodyClassName, onToggle, children }: { title: ReactNode; sub?: ReactNode; open?: boolean; size?: 'lg' | 'md'; className?: string; bodyClassName?: string; onToggle?: (open: boolean) => void; children: ReactNode }) {
  const lg = size === 'lg'
  return (
    <details open={open} onToggle={onToggle ? (e) => onToggle((e.currentTarget as HTMLDetailsElement).open) : undefined} className={cn('group/fold rounded-xl border bg-background transition-colors hover:border-primary/40', className)}>
      <summary className={cn('flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden', lg ? 'px-5 py-4' : 'px-4 py-3')}>
        <span className="min-w-0 flex-1">
          <span className={cn('block font-bold', lg ? 'text-lg' : 'text-base')}>{title}</span>
          {sub && <span className="block text-sm font-normal text-muted-foreground">{sub}</span>}
        </span>
        <ChevronDown className={cn('shrink-0 text-primary transition-transform group-open/fold:rotate-180', lg ? 'size-6' : 'size-5')} />
      </summary>
      <div className={cn(lg ? 'px-5 pb-5' : 'px-4 pb-4', bodyClassName)}>{children}</div>
    </details>
  )
}
