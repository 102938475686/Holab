import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardFooter } from '@/components/ui/card'

interface Action { label: string; onClick: () => void; disabled?: boolean; icon?: ReactNode }

// 모든 단계 하단에 똑같은 모양으로 "다음에 뭘 해야 하는지"를 보여주는 안내 바.
// 추천 행동 하나(파란 버튼)만 눈에 띄게 하고, 나머지 선택지는 옅게 보조로 둡니다.
export function StepFooter({ hint, primary, secondary }: { hint?: string; primary: Action; secondary?: Action[] }) {
  return (
    <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      {hint && <p className="text-[13px] text-muted-foreground sm:max-w-sm">{hint}</p>}
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {secondary?.map((s) => (
          <Button key={s.label} variant="outline" size="sm" onClick={s.onClick} disabled={s.disabled}>{s.icon}{s.label}</Button>
        ))}
        <Button onClick={primary.onClick} disabled={primary.disabled}>{primary.icon}{primary.label} {!primary.icon && <ArrowRight />}</Button>
      </div>
    </CardFooter>
  )
}

