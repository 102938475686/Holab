import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'

// "이미 필요한 도움을 알고 있어요"를 누르면 열리는 페이지: 내 상황에 맞는 기능으로 바로 들어갑니다.
const HELP = [
  { title: '받아야 할 돈이 궁금해요', desc: '시급과 근무시간만 넣으면 받아야 할 돈과 못 받은 돈을 계산해 드려요.', cta: '못 받은 돈 확인하기', step: 1 },
  { title: '계약서가 괜찮은지 모르겠어요', desc: '계약서 사진을 올리면 개인정보는 가리고, 확인이 필요한 조항을 짚어 드려요.', cta: '계약서 분석하기', step: 2 },
  { title: '노동청에 신고하고 싶어요', desc: '상황을 말씀해 주시면 공식 진정서 초안을 만들고 PDF로 저장해 드려요.', cta: '진정서 작성하기', step: 3 },
  { title: '전문가에게 상담받고 싶어요', desc: '내 사건 분야에 맞는 노무사를 매칭하고, 전화·화상·방문 중 알맞은 방식과 준비물을 안내해 드려요.', cta: '노무사 매칭', step: 4 },
] as const

export default function HelpPage() {
  const { go, setView, setConsultOpen } = useStore()
  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col">
      <header>
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <button className="flex items-center gap-3 text-left" onClick={() => setView('home')} aria-label="처음 화면으로">
            <span className="flex h-10 w-11 shrink-0 items-center justify-center"><img src={logo} alt="HoLab 로고" className="h-full w-full object-contain" /></span>
            <span className="text-2xl font-extrabold tracking-tight">HoLab</span>
          </button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setView('home')}><ArrowLeft /> 처음으로</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12">
        <h1 className="rise-in text-3xl font-bold sm:text-4xl">이미 필요한 도움을 알고 있나요?</h1>
        <p className="rise-in mt-3 max-w-xl text-muted-foreground" style={{ animationDelay: '70ms' }}>순서대로 하지 않아도 괜찮아요. 내 상황에 맞는 기능으로 바로 들어가세요.</p>
        <ul className="mt-10 grid max-w-3xl gap-3">
          {HELP.map((h, i) => (
            <li key={h.title} className="rise-in" style={{ animationDelay: `${(i + 2) * 70}ms` }}>
              <button type="button" onClick={() => go(h.step)} className="group flex w-full items-center gap-5 rounded-2xl bg-accent px-6 py-5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
                <span className="grid flex-1 gap-1">
                  <span className="text-xl font-bold">{h.title}</span>
                  <span className="text-base leading-relaxed text-foreground/75">{h.desc}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-2 font-semibold text-primary">{h.cta} <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
              </button>
            </li>
          ))}
        </ul>
        <div className="rise-in mt-10 flex flex-wrap items-center gap-3 max-w-3xl rounded-2xl p-1 text-base" style={{ animationDelay: '420ms' }}>
          <span className="flex-1 text-foreground/80">어떤 기능이 필요한지 잘 모르겠다면, 상황을 말해 주세요. 쓰면 좋은 기능을 순서대로 알려 드려요.</span>
          <Button onClick={() => setConsultOpen(true)}><MessageCircle /> 내 상황 이야기하기</Button>
        </div>
      </main>
    </div>
  )
}