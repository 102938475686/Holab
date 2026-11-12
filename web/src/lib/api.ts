export interface LawText { name: string; article: string; title?: string; text: string }
export interface Clause {
  title: string
  quote?: string
  severity: 'high' | 'medium' | 'low'
  issue: string
  law?: string
  lawText?: LawText
  evidence?: { title: string; text: string } | null // RAG로 찾은 근거 조문 (null이면 근거 부족)
}
export interface Analysis { summary?: string; clauses: Clause[]; missing?: string[]; demo?: boolean; rag?: { used: boolean; sources: string[] } }
export interface DraftReply { text: string; demo?: boolean }
export interface ComplaintChatReply { reply: string; ready: boolean; notes: string[]; suggestions: string[]; demo?: boolean }

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as { error?: string }).error || '요청에 실패했습니다.')
  return d as T
}

export const analyzeContract = (maskedText: string, useRag = true) => post<Analysis>('/api/analyze-contract', { maskedText, useRag })
export const draftComplaint = (facts: unknown) => post<DraftReply>('/api/draft-complaint', facts)
export const complaintChat = (messages: { role: string; content: string }[], facts: unknown) =>
  post<ComplaintChatReply>('/api/complaint-chat', { messages, facts })
export type FeatureKey = 'calc' | 'contract' | 'complaint' | 'lawyer'
export interface TriageReply {
  reply: string; facts: string[]; issues: string[]
  recommend: { key: FeatureKey | null; reason: string }
  ranking?: { key: FeatureKey; reason: string }[] // HoLab의 판단: 다음 기능 추천 순위
  caseType?: string; caseLabel?: string
  rankingTentative?: boolean; citationsTentative?: boolean // 정보가 적어 AI가 비워 둔 부분을 서버가 잠정으로 채웠는지
  citations?: string[]; procedure?: string // 근거 조문 / 기능 밖 공식 절차 (RAG 사용 시 검색된 조문 안에서만)
  rag?: { used: boolean; sources: { title: string; text: string; score: number; used: boolean }[] }
  suggestions: string[]; demo: boolean
}
export const triageChat = (messages: { role: string; content: string }[], rag = true) => post<TriageReply>('/api/triage-chat', { messages, rag })
export interface LegalExplain { items: { title: string; plain: string; situation: string; checks: string[] }[]; demo: boolean }
export const explainLegal = (titles: string[], facts: string[]) => post<LegalExplain>('/api/explain-legal', { titles, facts })
export const getStatus =() => fetch('/api/status').then((r) => r.json() as Promise<{ hasKey: boolean; model: string; mailTo?: string | null }>)

export interface MailPayload {
  lawyer: { name: string; office: string }
  receipt: string
  fields: Record<string, string>
  body: string
  pdfBase64: string
  filename: string
  subject?: string
  mailText?: string
  to?: string // 받는 주소(사용자가 고친 노무사 이메일). 없으면 서버 기본 주소
}
export interface MailSummaryInput {
  lawyerName: string
  facts: unknown
  notes: string[]
  clauses: { title: string; issue: string }[]
  missing: string[]
}
export const draftMailSummary = (p: MailSummaryInput) => post<{ summary: string; demo?: boolean }>('/api/draft-mail', p)

export interface ReportInput {
  facts: unknown
  notes: string[]
  clauses: { title: string; issue: string }[]
  missing: string[]
}
export const draftReport = (p: ReportInput) => post<{ summary: string; questions: string[]; demo?: boolean }>('/api/draft-report', p)
export const sendComplaintMail = (p: MailPayload) => post<{ ok: boolean; to: string }>('/api/send-complaint-mail', p)
export interface JudgeReply { summary?: string; recommend?: { key: 'contract' | 'complaint' | 'lawyer'; reason: string }; demo: boolean }
export const judgeCalc = (c: Record<string, unknown>) => post<JudgeReply>('/api/judge-calc', c)

export interface JudgeContractReply { summary?: string; recommend?: { key: 'complaint' | 'lawyer'; reason: string }; demo: boolean }
export const judgeContract = (c: Record<string, unknown>) => post<JudgeContractReply>('/api/judge-contract', c)

export interface JudgeComplaintReply { summary?: string; recommend?: { key: 'fix' | 'lawyer'; reason: string }; demo: boolean }
export const judgeComplaint = (c: Record<string, unknown>) => post<JudgeComplaintReply>('/api/judge-complaint', c)

export interface CallScriptReply { script?: string; demo: boolean }
export const callScript = (c: Record<string, unknown>) => post<CallScriptReply>('/api/call-script', c)
