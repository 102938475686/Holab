import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { calculate, defaultCalcInput, type CalcInput, type CalcResult } from '@/lib/calc'
import { getStatus, type Analysis } from '@/lib/api'
import type { LegalIssue } from '@/lib/legal'
import { clearReservations } from '@/lib/counsel'
import { SAMPLES, type SampleId } from '@/lib/sample'

export type View = 'home' | 'help' | 'consult' | 'wizard'
export interface NextRec { from: string; step: number; label: string; reason: string }

export interface FormState {
  pName: string; pRrn: string; pAddr: string; pTel: string; pMobile: string; pEmail: string
  pRecv: string; pPortal: string
  rBoss: string; rTel: string; rAddr: string; rKind: string; rName: string; rBizAddr: string; rBizTel: string; rCount: string
  startDate: string; endDate: string; wageTotal: string; retired: string; retireAmt: string; etcAmt: string
  duty: string; payDay: string; contractType: string
  draft: string; attach: string; office: string; timeline: string
}
export const defaultForm: FormState = {
  pName: '', pRrn: '', pAddr: '', pTel: '', pMobile: '', pEmail: '', pRecv: '예', pPortal: '예',
  rBoss: '', rTel: '', rAddr: '', rKind: '사업장', rName: '', rBizAddr: '', rBizTel: '', rCount: '',
  startDate: '', endDate: '', wageTotal: '', retired: '재직', retireAmt: '', etcAmt: '',
  duty: '', payDay: '', contractType: '서면', draft: '', attach: '', office: '', timeline: '',
}

interface Store {
  view: View
  setView: (v: View) => void
  step: number
  go: (n: number) => void
  done: number[]
  markDone: (n: number) => void

  calcIn: CalcInput
  setCalcIn: (p: Partial<CalcInput>) => void
  calc: CalcResult | null
  runCalc: (input?: CalcInput) => CalcResult | null
  autoSrc: Record<string, string> // 이전 단계 내용으로 자동 입력된 칸 → 출처(예: '1단계 · 못 받은 돈 확인'). 사용자가 고치면 사라짐
  markAuto: (keys: string[], src: string) => void
  clearAuto: (key: string) => void
  nextRec: NextRec | null // HoLab 브리핑 바에 보여 줄 "다음 추천" (각 단계의 판단 카드가 갱신)
  setNextRec: (r: NextRec | null) => void
  caseKey: string // AI 상담이 분류한 사건 유형 키(wage·dismissal 등, 없으면 빈 문자열)
  setCaseKey: (s: string) => void
  caseLabel: string // AI 상담이 분류한 사건 유형(없으면 빈 문자열)
  setCaseLabel: (s: string) => void
  legalConsult: LegalIssue[] // AI 상담에서 나온 관련 법 조항 (리포트·진정서에도 반영)
  setLegalConsult: (l: LegalIssue[]) => void
  recommended: number[] // AI 상담이 추천한 단계 순서(1순위, 2순위). 상담을 거치지 않았으면 빈 배열
  setRecommended: (n: number[]) => void
  calcAuto: string[] // AI 상담에서 가져와 채운 입력 항목 이름 (사용자가 확인·수정할 수 있게 표시)
  setCalcAuto: (n: string[]) => void

  pasteText: string
  setPasteText: (s: string) => void
  masked: string
  setMasked: (s: string) => void
  analysis: Analysis | null
  setAnalysis: (a: Analysis | null) => void

  form: FormState
  setForm: (p: Partial<FormState>) => void
  askLawyer: boolean
  setAskLawyer: (b: boolean) => void
  consultNotes: string[]
  setConsultNotes: (n: string[]) => void
  report: { lawyerName: string; summary: string; questions: string[] } | null
  setReport: (r: Store['report']) => void
  consultOpen: boolean // 홈 "무슨 문제인지 잘 모르겠어요" AI 상담 창
  setConsultOpen: (b: boolean) => void

  ai: { hasKey: boolean; model: string; mailTo?: string | null } | null
  resetAll: () => void // 상담을 마친 뒤 처음으로 돌아갈 때 입력한 내용과 예약 기록을 모두 지움
  resetNonce: number // 값이 바뀌면 상담 대화 같은 화면 안의 상태도 비움
  loadSample: (id?: SampleId) => void
  sampleId: SampleId | null // 지금 불러온 시연용 샘플(OCR 시연 이미지에 쓰임)
}

const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

// 새로고침해도 진행 상황이 남도록 sessionStorage에 저장 (탭을 닫으면 사라지고, 주민등록번호는 저장하지 않음)
const KEY = 'holab-progress-v1'
function load(): Record<string, any> { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') } catch { return {} } } // eslint-disable-line @typescript-eslint/no-explicit-any

export function StoreProvider({ children }: { children: ReactNode }) {
  const [saved] = useState(load)
  const [view, setView] = useState<View>(saved.view && saved.view !== 'consult' ? saved.view : 'home') // 상담 화면은 대화 내용이 사라지므로 새로고침하면 홈으로
  const [step, setStep] = useState<number>(saved.step ?? 1)
  const [done, setDone] = useState<number[]>(saved.done ?? [])
  const [calcIn, setCalcInState] = useState<CalcInput>({ ...defaultCalcInput, ...(saved.calcIn ?? {}) })
  const [calc, setCalc] = useState<CalcResult | null>(() => (saved.calc ? calculate({ ...defaultCalcInput, ...(saved.calcIn ?? {}) }) : null)) // 저장된 결과가 아니라 입력값으로 다시 계산 (계산식이 바뀌어도 옛 결과가 남지 않게)
  const [pasteText, setPasteText] = useState<string>(saved.pasteText ?? '')
  const [masked, setMasked] = useState<string>(saved.masked ?? '')
  const [analysis, setAnalysis] = useState<Analysis | null>(saved.analysis ?? null)
  const [form, setFormState] = useState<FormState>({ ...defaultForm, ...(saved.form ?? {}) })
  const [askLawyer, setAskLawyer] = useState(false)
  const [consultNotes, setConsultNotes] = useState<string[]>(saved.consultNotes ?? [])
  const [report, setReport] = useState<Store['report']>(null)
  const consultOpen = view === 'consult' // AI 상담은 별도 화면으로 열림 (setConsultOpen(true/false)는 그대로 사용)
  const setConsultOpen = useCallback((b: boolean) => { setView((v) => (b ? 'consult' : v === 'consult' ? 'home' : v)); if (b) window.scrollTo({ top: 0 }) }, [])
  const [calcAuto, setCalcAuto] = useState<string[]>([])
  const [recommended, setRecommended] = useState<number[]>([])
  const [legalConsult, setLegalConsult] = useState<LegalIssue[]>([])
  const [nextRec, setNextRec] = useState<NextRec | null>(null)
  const [caseLabel, setCaseLabel] = useState('')
  const [caseKey, setCaseKey] = useState('')
  const [autoSrc, setAutoSrc] = useState<Record<string, string>>({})
  const markAuto = useCallback((keys: string[], src: string) => setAutoSrc((a) => ({ ...a, ...Object.fromEntries(keys.map((k) => [k, src])) })), [])
  const clearAuto = useCallback((key: string) => setAutoSrc((a) => { if (!(key in a)) return a; const n = { ...a }; delete n[key]; return n }), [])
  const [ai, setAi] = useState<Store['ai']>(null)

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ view, step, done, calcIn, calc, pasteText, masked, analysis, form: { ...form, pRrn: '' }, consultNotes })) } catch { /* 저장 불가 환경은 무시 */ }
  }, [view, step, done, calcIn, calc, pasteText, masked, analysis, form, consultNotes])
  useEffect(() => { getStatus().then(setAi).catch(() => setAi(null)) }, [])

  const markDone = useCallback((n: number) => setDone((d) => (d.includes(n) ? d : [...d, n])), [])
  const go = useCallback((n: number) => { setStep(n); setView('wizard'); window.scrollTo({ top: 0 }) }, [])
  const setCalcIn = useCallback((p: Partial<CalcInput>) => setCalcInState((c) => ({ ...c, ...p })), [])
  const setForm = useCallback((p: Partial<FormState>) => setFormState((f) => ({ ...f, ...p })), [])

  const runCalc = useCallback((input?: CalcInput) => {
    const r = calculate(input ?? calcIn)
    if (r) { setCalc(r); markDone(1) }
    return r
  }, [calcIn, markDone])

  const [sampleId, setSampleId] = useState<SampleId | null>(null)
  const [resetNonce, setResetNonce] = useState(0)
  const resetAll = useCallback(() => {
    setCalcInState(defaultCalcInput); setCalc(null); setPasteText(''); setMasked(''); setAnalysis(null)
    setFormState(defaultForm); setAskLawyer(false); setConsultNotes([]); setReport(null); setCalcAuto([])
    setNextRec(null); setCaseLabel(''); setCaseKey(''); setRecommended([]); setLegalConsult([]); setAutoSrc({})
    setDone([]); setStep(1); setSampleId(null); setResetNonce((n) => n + 1)
    clearReservations()
    try { sessionStorage.removeItem(KEY) } catch { /* 저장소가 막힌 환경은 무시 */ }
    setView('home'); window.scrollTo({ top: 0 })
  }, [])
  // 시연용 샘플 인물 불러오기: 다른 인물의 입력·분석·상담 결과가 섞이지 않게 모두 비우고 시작
  const loadSample = useCallback((id: SampleId = 'minsu') => {
    const sp = SAMPLES[id]
    const input = { ...defaultCalcInput, ...sp.calc }
    setSampleId(id)
    setCalcInState(input)
    setCalc(calculate(input))
    setDone([1])
    setAnalysis(null); setMasked(''); setConsultNotes([]); setLegalConsult([]); setNextRec(null)
    setCaseLabel(''); setCaseKey(''); setRecommended([]); setCalcAuto([]); setAutoSrc({}); setReport(null)
    setFormState({ ...defaultForm, ...sp.form })
    setPasteText(sp.text)
    go(1)  }, [go, markDone])

  const value: Store = {
    view, setView, step, go, done, markDone,
    calcIn, setCalcIn, calc, runCalc, calcAuto, setCalcAuto, recommended, setRecommended, legalConsult, setLegalConsult, nextRec, setNextRec, caseLabel, setCaseLabel, caseKey, setCaseKey, autoSrc, markAuto, clearAuto,
    pasteText, setPasteText, masked, setMasked, analysis, setAnalysis,
    form, setForm, askLawyer, setAskLawyer, consultNotes, setConsultNotes, report, setReport, consultOpen, setConsultOpen,
    ai, loadSample, sampleId, resetAll, resetNonce,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

