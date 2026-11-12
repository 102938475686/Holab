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

// 기능은 순서대로 하는 단계가 아니라, 상황에 맞게 골라 쓰는 메뉴예요(번호 없이 아이콘으로 구분)
const FEATURES = [
  { n: 1, label: '못 받은 돈 확인', hint: '받아야 할 돈 계산', icon: Calculator },
  { n: 2, label: '계약서 분석', hint: '위험 조항 점검', icon: BookOpen },
  { n: 3, label: '진정서 작성', hint: '노동청 제출 서류', icon: FileText },
  { n: 4, label: '노무사 매칭', hint: '노무사 · 상담 준비 · 메일', icon: MapPin },
]

// 단계마다 "무엇을 하는 곳인지"와 그 단계에서 개인정보가 어떻게 다뤄지는지를 한 줄로 알려 줌
const ROLE = [
  { what: '못 받은 돈 확인: 받아야 할 돈과 못 받은 돈을 계산해요.', privacy: '입력한 숫자는 이 기기에서만 계산돼요.' },
  { what: '계약서 분석: 계약서에 불리한 조항이 있는지 점검해요.', privacy: '이름·연락처는 가린 글자만 AI에 전송돼요.' },
  { what: '진정서 작성: 노동청에 낼 진정서 초안을 만들어요.', privacy: '성명·주민번호는 AI에 보내지 않고, PDF에만 들어가요.' },
  { what: '노무사 매칭: 내 사건에 맞는 노무사를 매칭하고 준비물을 챙겨 메일로 보내요.', privacy: '위치와 예약 기록은 이 기기에만 저장돼요.' },
]

// 헤더·탭·본문·푸터가 같은 폭과 좌우 여백을 쓰도록 하나의 컨테이너 규격으로 통일
const WRAP = 'mx-auto w-full max-w-[76rem] px-4 2xl:max-w-[94rem] sm:px-6'

export default function Wizard() {
  const { step, go, done, setView, loadSample, ai, recommended, nextRec } = useStore()
  // 추천 표시: AI 상담이 정한 순위가 있으면 "추천 N순위", 없으면 판단 카드가 가리킨 "다음 추천"
  // 추천이 뜨면 추천 순서대로 앞에 놓고, 나머지는 원래 순서대로 뒤에 둠
  const rankOrder = [...recommended, ...(nextRec && !recommended.includes(nextRec.step) ? [nextRec.step] : [])]
  const ordered = [...FEATURES].sort((a, b) => { const ra = rankOrder.indexOf(a.n), rb = rankOrder.indexOf(b.n); return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || a.n - b.n })
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
          <TabsList aria-label="기능 선택" className="grid h-auto! w-full grid-cols-2 gap-2 rounded-none bg-transparent p-0 sm:grid-cols-4 group-data-horizontal/tabs:h-auto">
            {ordered.map((f) => {
              const rec = recLabel(f.n)
              const isDone = done.includes(f.n)
              return (
                <TabsTrigger
                  key={f.n}
                  value={String(f.n)}
                  aria-label={f.label}
                  className="group/tab h-auto min-w-0 flex-none flex-col items-start justify-start gap-1 rounded-xl border-transparent bg-accent px-4 py-3 text-left text-base font-bold text-foreground after:hidden hover:bg-primary/10 data-active:bg-primary data-active:text-primary-foreground"
                >
                  <span className="flex w-full items-center gap-2">
                    <f.icon className="size-5 shrink-0" />
                    <span className="truncate">{f.label}</span>
                    {isDone && <Check className="ml-auto size-4 shrink-0" strokeWidth={3} aria-label="해 봤어요" />}
                  </span>
                  <span className={`truncate text-sm font-medium ${rec ? 'text-primary group-data-active/tab:text-white' : 'text-foreground/70 group-data-active/tab:text-white/90'}`}>{rec || f.hint}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          <p className="text-base leading-relaxed">
            <b>{ROLE[step - 1]?.what}</b>
            <span className="mt-1 block text-sm text-muted-foreground">{ROLE[step - 1]?.privacy}</span>
          </p>          <TabsContent value="1"><StepCalc /></TabsContent>
          <TabsContent value="2"><StepContract /></TabsContent>
          <TabsContent value="3"><StepComplaint /></TabsContent>
          <TabsContent value="4"><StepLawyer /></TabsContent>
        </Tabs>
        </div>
        </div>
        <BriefingGuide mode="float" />
      </main>
      <footer className={`${WRAP} pb-8 text-center text-[13px] text-muted-foreground`}>HoLab · 1팀 김연우 · 김연호 · 노유승 · 차도현 · SDGs 8.8 노동권 보호</footer>
    </div>
  )
}


