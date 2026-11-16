import { ArrowLeft, BookOpen, Calculator, Check, FileText, FlaskConical, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import BriefingGuide from '@/components/BriefingGuide'
import StepCalc from '@/components/StepCalc'
import StepComplaint from '@/components/StepComplaint'
import StepContract from '@/components/StepContract'
import StepLawyer from '@/components/StepLawyer'
import { SAMPLES } from '@/lib/sample'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'

// 기능은 ①→④ 번호가 붙은 진행 표시줄로 보여 주지만, 상황에 맞게 아무 단계나 골라 쓸 수 있어요
const FEATURES = [
  { n: 1, label: '못 받은 돈 확인', hint: '받아야 할 돈 계산', icon: Calculator },
  { n: 2, label: '계약서 분석', hint: '위험 조항 점검', icon: BookOpen },
  { n: 3, label: '진정서 작성', hint: '노동청 제출 서류', icon: FileText },
  { n: 4, label: '노무사 매칭', hint: '노무사 · 상담 준비 · 메일', icon: MapPin },
]

// 헤더·탭·본문·푸터가 같은 폭과 좌우 여백을 쓰도록 하나의 컨테이너 규격으로 통일
const WRAP = 'mx-auto w-full max-w-[76rem] px-4 2xl:max-w-[94rem] sm:px-6'

export default function Wizard() {
  const { step, go, done, setView, loadSample, ai, recommended, nextRec } = useStore()
  // 추천 표시: AI 상담이 정한 순위가 있으면 "추천 N순위", 없으면 판단 카드가 가리킨 "다음 추천"
  // 진행 표시줄: 순서는 ①→④로 고정하고, 해 본 단계는 ✓, 추천 단계는 "추천" 글자로 알려 줌 (순서대로 안 해도 됨)
  const doneN = FEATURES.filter((f) => done.includes(f.n)).length
  const recLabel = (n: number) => {
    const i = recommended.indexOf(n)
    if (i >= 0) return `추천 ${i + 1}순위`
    return nextRec?.step === n ? '다음 추천' : ''
  }
  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col">
      <header>
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4`}>
          <button className="flex items-center gap-3 text-left" onClick={() => setView('home')}>
            <span className="flex h-10 w-11 shrink-0 items-center justify-center">
              <img src={logo} alt="HoLab 로고" className="h-full w-full object-contain" />
            </span>
            <span className="text-2xl font-extrabold tracking-tight">HoLab</span>
            <span className="hidden text-sm text-muted-foreground md:inline">내가 놓쳤던, 내 노동 권리 찾기</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {ai ? (ai.hasKey ? `AI 연결됨 (${ai.model})` : 'AI 키 없음 · 대체 응답 모드') : '서버 확인 중…'}
            </span>
            {(["minsu", "jiwoo"] as const).map((id) => <Button key={id} variant="ghost" size="sm" className="h-8" onClick={() => loadSample(id)}><FlaskConical /> {SAMPLES[id].label} 샘플</Button>)}
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setView('home')}><ArrowLeft /> 처음으로</Button>
          </div>
        </div>
      </header>

      <main className={`${WRAP} flex-1 py-6 max-lg:pb-28 sm:py-8`}>
        <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,56rem)] lg:justify-center 2xl:grid-cols-[16.5rem_minmax(0,56rem)_16.5rem]"> {/* 아주 넓은 화면에서는 오른쪽에 같은 폭의 빈 칸을 둬서 본문이 화면 가운데에 오게 함 */}
        {/* 왼쪽: 올랍이의 안내(넓은 화면). 좁은 화면에서는 왼쪽 아래 마스코트 버튼으로 열려요 */}
        <aside className="hidden lg:block" aria-label="HoLab 안내"><div className="sticky top-14"><BriefingGuide mode="rail" /></div></aside>
        <div className="min-w-0">
        <Tabs value={String(step)} onValueChange={(v) => go(Number(v))} className="gap-5">
          <div className="grid gap-2" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">4단계 중 <b className="text-primary">{doneN}단계</b> 해 봤어요</span>
              <span className="text-muted-foreground">순서대로 안 해도 괜찮아요</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={doneN} aria-label="진행 상황">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(doneN / 4) * 100}%` }} />
            </div>
          </div>
          <TabsList aria-label="기능 선택" className="grid h-auto! w-full grid-cols-2 gap-2 rounded-none bg-transparent p-0 sm:grid-cols-4 group-data-horizontal/tabs:h-auto">
            {FEATURES.map((f) => {
              const rec = recLabel(f.n)
              const isDone = done.includes(f.n)
              return (
                <TabsTrigger
                  key={f.n}
                  value={String(f.n)}
                  aria-label={`${f.n}단계 ${f.label}${isDone ? ' (해 봤어요)' : ''}`}
                  className="group/tab h-auto min-w-0 flex-none flex-col items-start justify-start gap-1 rounded-xl border-transparent bg-accent px-4 py-3 text-left text-base font-bold text-foreground after:hidden hover:bg-primary/10 data-active:bg-primary data-active:text-primary-foreground"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${isDone ? 'bg-emerald-600 text-white' : 'bg-primary/15 text-primary group-data-active/tab:bg-white group-data-active/tab:text-primary'}`}>
                      {isDone ? <Check className="size-4" strokeWidth={3} /> : f.n}
                    </span>
                    <f.icon className="hidden size-5 shrink-0 2xl:block" />
                    <span className="min-w-0 leading-snug">{f.label}</span>
                  </span>
                  <span className={`truncate text-sm font-medium ${rec ? 'text-primary group-data-active/tab:text-white' : 'text-foreground/70 group-data-active/tab:text-white/90'}`}>{rec || f.hint}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {/* 기능 설명·개인정보 안내는 각 화면 카드 제목 아래에 한 번만 보여 줘요 */}
          <TabsContent value="1"><StepCalc /></TabsContent>
          <TabsContent value="2"><StepContract /></TabsContent>
          <TabsContent value="3"><StepComplaint /></TabsContent>
          <TabsContent value="4"><StepLawyer /></TabsContent>
        </Tabs>
        </div>
        </div>
        <BriefingGuide mode="float" />
      </main>
      <footer className={`${WRAP} pb-8 text-center text-sm text-muted-foreground`}>HoLab · 1팀 김연우 · 김연호 · 노유승 · 차도현 · SDGs 8.8 노동권 보호</footer>
    </div>
  )
}


