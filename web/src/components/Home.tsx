import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight, FlaskConical, ListChecks, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Mascot from '@/components/Mascot'
import { SAMPLES } from '@/lib/sample'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'

// 기존 AI와의 차이: 정보 제공에서 그치는 AI vs 행동까지 하는 HoLab
function ComparisonSection() {
  return (
    <section className="px-5 py-20">
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-3xl font-bold sm:text-4xl">정보를 주는 걸 넘어,<br />행동까지 합니다</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div className="grid gap-3">
            <span className="text-[13px] font-semibold tracking-wide text-muted-foreground">기존 AI (ChatGPT 등)</span>
            <p className="text-lg leading-relaxed text-muted-foreground">"주휴수당 계산법은 이렇습니다."</p>
            <p className="text-sm text-muted-foreground">정보 제공에서 끝나고, 청년은 다시 혼자 계산기를 두드립니다.</p>
          </div>
          <div className="grid gap-3 border-l-2 border-primary/50 pl-8">
            <span className="text-[13px] font-semibold tracking-wide text-primary">HoLab 에이전트</span>
            <p className="text-lg leading-relaxed">"미지급액 538,085원 확인했어요. 노동청 진정서 작성을 도와드릴게요. 무료 노무사 연결도 가능해요."</p>
            <p className="text-sm text-muted-foreground">계산 → 분석 → 작성 → 연결까지, 실제 행동으로 이어집니다.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// AI 판단 방식: 결론을 먼저 말하고 근거를 보여주며, 빠진 항목은 바로 표시 (근거 중심 설계를 그대로 보여줌)
function ExplainabilitySection() {
  return (
    <section className="px-5 py-20">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-3xl font-bold sm:text-4xl">판단은 사람이,<br />근거는 AI가 먼저 보여드려요</h2>
        <p className="mt-4 max-w-xl text-muted-foreground">결론부터 말하고 근거를 그 아래에 답니다. 법이 요구하는 항목이 빠져 있으면 바로 표시돼요. 전부 다시 읽지 않아도 돼요.</p>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div data-ui className="lift rounded-xl border bg-card p-6">
            <span className="text-[13px] font-semibold text-muted-foreground">결론부터 · 근거는 그 아래에</span>
            <div className="mt-3 flex items-center gap-2"><Badge variant="destructive">위험</Badge><b>주휴수당 포함</b></div>
            <p className="mt-2 text-sm italic text-muted-foreground">"주휴수당은 시급에 포함하여 지급한 것으로 본다"</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">주휴수당은 별도로 지급해야 하며, 시급에 포함할 수 없습니다.</p>
            <p className="mt-2 text-[13px] font-medium text-primary">근로기준법 제55조</p>
          </div>
          <div data-ui className="lift rounded-xl border bg-card p-6">
            <span className="text-[13px] font-semibold text-muted-foreground">법이 요구하는 항목이 빠지면 바로 표시</span>
            <p className="mt-3 text-sm text-muted-foreground">계약서에서 확인되지 않은 항목</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">휴게시간</Badge><Badge variant="secondary">연차휴가</Badge><Badge variant="secondary">사회보험 적용</Badge>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">근로계약서에는 임금, 소정근로시간, 휴일, 연차휴가 등이 명시되어야 합니다.</p>
            <p className="mt-2 text-[13px] font-medium text-primary">근로기준법 제17조</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// 등장 모션: 한 가지 동작(살짝 떠오르며 나타남)을 읽는 순서대로 요소마다 조금씩 늦춰서 적용합니다.
const STEP = 70 // ms
const riseIn = (i: number, extra = '') => ({ className: `rise-in ${extra}`.trim(), style: { animationDelay: `${i * STEP}ms` } })

// 신뢰: 개인정보·AI 한계·근거를 숨기지 않고 먼저 알립니다.
const TRUST = [
  { t: '개인정보는 가려서 처리해요', d: '계약서의 이름·주민번호·연락처는 AI에 보내기 전에 이 기기에서 먼저 가립니다.' },
  { t: '사진 속 글자는 내 기기에서 읽어요', d: '계약서 사진의 글자 인식(OCR)은 서버에 올리지 않고 브라우저 안에서 처리합니다.' },
  { t: '위치는 거리 계산에만 써요', d: '가까운 센터를 찾을 때 쓰는 위치는 기기 밖으로 전송하거나 저장하지 않아요.' },
  { t: '법령 근거를 함께 보여줘요', d: '문제가 있다고 한 조항에는 근로기준법 등 근거 조문을 함께 표시합니다.' },
  { t: 'AI는 틀릴 수 있어요', d: '결과는 참고용이에요. 법률 자문이 아니니 중요한 결정은 노무사·노동청과 확인하세요.' },
]

function TrustSection() {
  return (
    <section className="px-5 py-20">
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-3xl font-bold sm:text-4xl">내 정보는 안전한가요?</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">민감한 이야기를 맡기는 서비스라서, 어떻게 다루는지 먼저 알려 드려요.</p>
        <dl className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {TRUST.map((x) => (
            <div key={x.t}>
              <dt className="font-semibold">{x.t}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{x.d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// 검색 후 판단(RAG) vs 검색 없이 판단: 같은 사건 14건으로 돌려 본 평가 결과 (eval/run.js가 만든 eval-results.json을 읽음)
interface EvalMode { cases: number; caseTypeAcc: number; top1Acc: number; citationRecall: number; citationPrecision: number | null; unsupportedCitations: number; totalCitations: number; procedureCoverage: number | null; retrievalRecall: number | null }
interface EvalData { runAt: string; model: string; summary: { rag: EvalMode; plain: EvalMode } }
function EvalSection() {
  const [d, setD] = useState<EvalData | null>(null)
  useEffect(() => { fetch('/eval-results.json').then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null)) }, [])
  if (!d) return null
  const { rag, plain } = d.summary
  const pct = (v: number | null) => (v == null ? '-' : `${Math.round(v * 100)}%`)
  const rows: { label: string; hint: string; a: string; b: string; ragBetter: boolean | null }[] = [
    { label: '인용한 조문이 실제 관련 조문인 비율', hint: '높을수록 좋아요', a: pct(rag.citationPrecision), b: pct(plain.citationPrecision), ragBetter: (rag.citationPrecision ?? 0) > (plain.citationPrecision ?? 0) },
    { label: '근거 없이 인용한 조문 수', hint: '적을수록 좋아요', a: `${rag.unsupportedCitations}건`, b: `${plain.unsupportedCitations}건`, ragBetter: rag.unsupportedCitations < plain.unsupportedCitations },
    { label: '꼭 필요한 조문을 찾아 인용한 비율', hint: '높을수록 좋아요', a: pct(rag.citationRecall), b: pct(plain.citationRecall), ragBetter: rag.citationRecall > plain.citationRecall },
    { label: '사건 유형 분류 정확도', hint: '', a: pct(rag.caseTypeAcc), b: pct(plain.caseTypeAcc), ragBetter: null },
    { label: '1순위 기능 추천 정확도', hint: '', a: pct(rag.top1Acc), b: pct(plain.top1Acc), ragBetter: rag.top1Acc > plain.top1Acc ? true : rag.top1Acc < plain.top1Acc ? false : null },
    { label: '기능 밖 공식 절차 안내 정확도', hint: '아직 낮아요', a: pct(rag.procedureCoverage), b: pct(plain.procedureCoverage), ragBetter: (rag.procedureCoverage ?? 0) > (plain.procedureCoverage ?? 0) ? true : (rag.procedureCoverage ?? 0) < (plain.procedureCoverage ?? 0) ? false : null },
  ]
  return (
    <section className="px-5 py-20">
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-3xl font-bold sm:text-4xl">AI가 법령을 먼저 찾아보고<br />판단하면 달라지는 점</h2>
        <p className="mt-4 max-w-2xl text-muted-foreground">HoLab은 AI가 판단하기 전에 법제처 원문 조문을 먼저 검색하고, 그 안에서만 근거를 쓰게 해요. 같은 사건 {rag.cases}건을 두 방식으로 돌려 정답과 비교했어요.</p>
        <div data-ui className="mt-8 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3 font-semibold">평가 항목</th>
                <th className="p-3 text-right font-semibold text-primary">법령 검색 후 판단 (HoLab)</th>
                <th className="p-3 text-right font-semibold text-muted-foreground">검색 없이 AI 단독</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="p-3">{r.label}{r.hint && <span className="ml-2 text-[13px] text-muted-foreground">{r.hint}</span>}</td>
                  <td className={`p-3 text-right text-base ${r.ragBetter ? 'font-extrabold text-primary' : 'font-semibold'}`}>{r.a}</td>
                  <td className={`p-3 text-right text-base ${r.ragBetter === false ? 'font-extrabold text-primary' : 'text-muted-foreground'}`}>{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          평가 방법: 임금·해고·괴롭힘·산재·외국인·연소근로 등 {rag.cases}개 사건, 같은 AI 모델({d.model}), 정답은 팀이 법제처 원문 기준으로 작성(전문가 검수 전). 사건 수가 적고 AI 답은 실행할 때마다 조금씩 달라질 수 있어 <b className="text-foreground">참고 수치</b>로 봐 주세요. 기능 밖 공식 절차 안내는 두 방식 모두 낮아서, 지금은 조문에 적힌 내용만 안내하고 나머지는 노무사·센터 확인을 권해요.
        </p>
      </div>
    </section>
  )
}
// 마무리: 큰 한 문장 + 시작하기 버튼으로 다시 한번 행동을 유도
function ClosingSection() {
  const { setConsultOpen, setView } = useStore()
  return (
    <section className="px-5 py-20 text-center">
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="text-3xl font-bold leading-snug sm:text-4xl">모든 노동이<br />정당한 대가를 받는 그날까지</h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">HoLab은 노동자의 권리를 기술로 지키겠다는 약속입니다. 지금 바로 내 상황을 확인해 보세요.</p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="h-12 px-8 text-base font-semibold" onClick={() => setConsultOpen(true)}>
            <MessageCircle className="size-5" /> 내 상황 이야기하기
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => { setView('help'); window.scrollTo({ top: 0 }) }}>
            이미 필요한 도움을 알고 있어요 <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>
    </section>
  )
}
function HomeFooter() {
  return (
    <footer className="border-t px-5 py-10 text-center text-[13px] text-muted-foreground"> {/* taste-skill-ignore: 본문과 푸터를 구분하는 실질적 경계선 */}
      <p>이 서비스는 참고용 정보이며 법률 자문이 아닙니다. 중요한 결정은 노무사·노동청과 상담하세요.</p>
      <p className="mt-2">HoLab · 1팀 김연우 · 김연호 · 노유승 · 차도현 · SDGs 8.8 노동권 보호</p>
    </footer>
  )
}

export default function Home() {
  const { loadSample, setConsultOpen, setView } = useStore()

  // 첫 화면 아래 요소는 스크롤해서 보일 때 등장 모션을 재생 (그 전에는 멈춰 둠)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const hero = document.querySelector('#home-hero')
    // 모션이 없던 아래쪽 섹션에도 제목·카드에 등장 모션을 입힘 (카드는 순서대로 조금씩 늦게)
    document.querySelectorAll<HTMLElement>('section:not(#home-hero) h2, section:not(#home-hero) h2 + p, section:not(#home-hero) .grid > *, footer').forEach((el, i) => {
      if (el.classList.contains('rise-in')) return
      el.classList.add('rise-in')
      if (el.parentElement?.classList.contains('grid')) el.style.animationDelay = `${(Array.prototype.indexOf.call(el.parentElement.children, el) % 6) * STEP}ms`
    })
    const targets = [...document.querySelectorAll<HTMLElement>('.rise-in')].filter((el) => !hero?.contains(el))
    targets.forEach((el) => el.classList.add('pending'))
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('pending'); io.unobserve(e.target) } })
    }, { threshold: 0.15 })
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <>
      {/* 첫 화면: 위에는 로고·소개, 아래는 화면을 반으로 나눈 두 갈래 선택 (왼쪽 AI 상담 / 오른쪽 기능 바로가기) */}
      <section id="home-hero" className="relative flex min-h-[calc(100dvh-2.5rem)] flex-col">
        <div className="px-5 pb-6 pt-8 text-center">
          <div {...riseIn(0)} className={`${riseIn(0).className} flex items-center justify-center gap-3`}>
            <span className="float-slow flex h-16 w-[4.5rem] shrink-0 items-center justify-center sm:h-24 sm:w-28">
              <img src={logo} alt="HoLab 로고" className="h-full w-full object-contain" />
            </span>
            <h1 className="text-6xl font-extrabold tracking-tight sm:text-8xl">HoLab</h1>
          </div>
          <p {...riseIn(2)} className={`${riseIn(2).className} mt-3 text-lg font-medium text-primary sm:text-xl`}>청년 노동권 도우미 에이전트</p>
          <p {...riseIn(3)} className={`${riseIn(3).className} mx-auto mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground`}>
            임금 계산부터 계약서 분석, 진정서 작성, 노무사 매칭까지 — 받아야 할 돈을 놓치지 않도록 한 곳에서 도와드려요.
          </p>
          {/* HoLab(서비스)과 올랍이(그 안의 AI 안내 도우미) 역할 구분 */}
          <div {...riseIn(3)} className={`${riseIn(3).className} mx-auto mt-4 grid max-w-xl gap-2 text-left text-sm sm:grid-cols-2`}>
            <div className="flex items-start gap-2.5 rounded-xl border bg-background/70 p-3">
              <img src={logo} alt="" className="mt-0.5 h-7 w-8 shrink-0 object-contain" />
              <span><b>HoLab</b> <span className="text-muted-foreground">— 서비스 이름이에요. 못 받은 돈 계산, 계약서 분석, 진정서 작성, 노무사 매칭 기능을 모두 담고 있어요.</span></span>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border bg-background/70 p-3">
              <Mascot size={30} className="shrink-0" />
              <span><b>올랍이</b> <span className="text-muted-foreground">— HoLab 안의 AI 안내 도우미예요. 상황을 듣고 정리해서, 다음에 쓸 기능을 알려 줘요.</span></span>
            </div>
          </div>
        </div>

        <div className="grid flex-1 md:grid-cols-2">
          <button
            type="button" {...riseIn(4)} onClick={() => setConsultOpen(true)}
            className={`${riseIn(4).className} group flex min-h-[16rem] flex-col items-center justify-center gap-4 bg-primary px-8 py-10 text-center text-primary-foreground outline-none transition-[filter] hover:brightness-110 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/70`}
          >
            <Mascot size={96} />
            <span className="rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold">무슨 문제인지 모를 때</span>
            <span className="text-3xl font-extrabold leading-snug sm:text-4xl">내 상황 이야기하기</span>
            <span className="max-w-sm text-base leading-relaxed">법률 용어를 몰라도 괜찮아요. 올랍이가 듣고 정리해서, 지금 쓰면 좋은 기능을 순서대로 알려 드려요.</span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 font-bold text-primary">올랍이와 이야기하기 <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
          </button>
          <button
            type="button" {...riseIn(5)} onClick={() => { setView('help'); window.scrollTo({ top: 0 }) }}
            className={`${riseIn(5).className} group flex min-h-[16rem] flex-col items-center justify-center gap-4 bg-accent px-8 py-10 text-center text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/50`}
          >
            <span className="flex size-24 items-center justify-center rounded-3xl bg-primary/10 text-primary"><ListChecks className="size-12" /></span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[13px] font-semibold text-primary">필요한 기능을 알고 있을 때</span>
            <span className="text-3xl font-extrabold leading-snug sm:text-4xl">이미 필요한 도움을 알고 있어요</span>
            <span className="max-w-sm text-base leading-relaxed text-muted-foreground">못 받은 돈 확인, 계약서 분석, 진정서 작성, 노무사 매칭 중 필요한 기능으로 바로 들어가요.</span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground">기능 보러 가기 <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
          </button>
        </div>

        <div {...riseIn(6)} className={`${riseIn(6).className} flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-5 py-3 text-sm text-muted-foreground`}>
          <span className="inline-flex flex-wrap items-center gap-x-1">
            <FlaskConical className="size-4" /> 시연용 샘플
            {(['minsu', 'jiwoo'] as const).map((id) => (
              <Button key={id} variant="link" size="sm" className="text-muted-foreground" onClick={() => loadSample(id)}>{SAMPLES[id].label} <span className="text-[13px] opacity-80">({SAMPLES[id].profile})</span></Button>
            ))}
          </span>
          <button
            type="button"
            onClick={() => document.getElementById('home-hero')?.nextElementSibling?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-1 text-[13px] hover:text-foreground"
          >
            아래로 내려보세요 <ArrowDown className="size-4 motion-safe:animate-bounce" />
          </button>
        </div>
      </section>
      <ComparisonSection />
      <ExplainabilitySection />
      <EvalSection />
      <TrustSection />
      <ClosingSection />
      <HomeFooter />
    </>
  )
}



