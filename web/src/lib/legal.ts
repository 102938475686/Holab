import type { Analysis } from '@/lib/api'
import { MIN_WAGE, won, type CalcResult } from '@/lib/calc'

// 법적 쟁점 표현 규칙
//  · 계약서에 적힌 문구처럼 확실한 자료가 근거면 → "위반이에요"
//  · 사용자가 말하거나 입력한 내용만 근거면(차별·괴롭힘 등) → "해당될 수 있어요" (직접 증거가 없으면 단정하지 않음)
export type Basis = 'document' | 'statement'

export interface LegalIssue {
  key: string
  title: string // "근로기준법 제6조 균등한 처우"
  basis: Basis
  plain?: string // 쉬운 풀이
  situation?: string // 내 상황과의 연결
  quote?: string // 계약서 원문 인용(document일 때)
  checks?: string[] // 먼저 확인할 사실·자료
  from: '상담' | '계산' | '계약서'
}

export const verdictOf = (b: Basis) => (b === 'document' ? '위반이에요' : '해당될 수 있어요')

// "근로기준법 제28조 부당해고등의 구제신청" → 조회·링크용 참조
export function refOf(title: string): { name: string; art: string } | null {
  const name = title.match(/^(.+?)\s*제\d/)?.[1]?.trim()
  const art = title.match(/제\d+조(?:의\d+)?/)?.[0]
  return name && art ? { name, art } : null
}
export const lawUrl = (title: string) => {
  const r = refOf(title)
  return r ? `https://www.law.go.kr/법령/${encodeURIComponent(r.name)}/${r.art}` : 'https://www.law.go.kr'
}

export const contractHourlyOf = (text: string) => {
  const m = text.replace(/\s+/g, ' ').match(/시급[^0-9]{0,6}([0-9,]{4,7})\s*원/)
  const v = m ? Number(m[1].replace(/,/g, '')) : 0
  return v >= 1000 && v <= 100000 ? v : 0
}

// 1단계 계산 결과에서 나온 쟁점 (규칙으로 만든 고정 문장 — AI가 쓰지 않음)
export function calcIssues(calc: CalcResult, contractText: string, analysis: Analysis | null): LegalIssue[] {
  const out: LegalIssue[] = []
  const ch = contractHourlyOf(contractText)
  if (calc.minWageGap > 0) {
    const doc = ch > 0 && ch === calc.hourly // 계약서에 적힌 시급과 같을 때만 "확실한 자료"
    out.push({
      key: 'min', title: '최저임금법 제6조 최저임금의 효력', basis: doc ? 'document' : 'statement', from: '계산',
      plain: '사용자는 최저임금 이상을 줘야 해요. 최저임금보다 낮게 정한 계약은 그 부분이 무효이고, 최저임금을 주기로 한 것으로 봐요.',
      situation: doc
        ? `계약서에 적힌 시급 ${calc.hourly.toLocaleString()}원은 2026년 최저임금 ${MIN_WAGE.toLocaleString()}원보다 ${calc.minWageGap.toLocaleString()}원 낮아서 최저임금법에 어긋나요.`
        : `입력하신 시급 ${calc.hourly.toLocaleString()}원이 2026년 최저임금 ${MIN_WAGE.toLocaleString()}원보다 낮다면 이 조항에 해당할 수 있어요.`,
      checks: doc ? [] : ['계약서나 급여명세서에 적힌 시급', '실제 입금 내역'],
    })
  }
  if (calc.holUnpaid > 0) {
    const clause = analysis?.clauses.find((c) => !!c.quote && /주휴|시급에\s*포함/.test(c.quote)) // 계약서 인용문에 실제로 그 문구가 있을 때만 "확실한 자료"
    out.push({
      key: 'hol', title: '근로기준법 제55조 휴일 (주휴수당)', basis: clause ? 'document' : 'statement', from: '계산', quote: clause?.quote,
      plain: '1주에 15시간 이상 일하고 정해진 날을 개근했다면 주휴수당을 따로 줘야 해요. 시급에 포함했다는 약속만으로는 이 의무가 사라지지 않아요.',
      situation: clause
        ? `계약서에 “주휴수당을 시급에 포함”한다는 문구가 있어도 주휴수당을 줘야 하는 의무는 사라지지 않아요. 별도로 지급하지 않았다면 위반이에요.`
        : `입력하신 조건(주 ${calc.weekly}시간, 개근)이라면 주휴수당이 지급돼야 해요. 받지 못했다면 이 조항에 해당할 수 있어요.`,
      checks: clause ? [] : ['급여명세서에 “주휴수당” 항목이 있는지', '출퇴근 기록(개근 확인)'],
    })
  }
  if (calc.extraUnpaid > 0) {
    out.push({
      key: 'extra', title: '근로기준법 제56조 연장·야간 및 휴일 근로 (가산수당)', basis: 'statement', from: '계산',
      plain: '연장·야간(밤 10시~아침 6시)·휴일 근로에는 통상임금의 50% 이상을 더해서 줘야 해요. 상시 5명 미만 사업장에는 이 규정이 적용되지 않아요.',
      situation: '입력하신 연장·야간·휴일 근로가 있었는데 가산수당을 받지 못했다면 이 조항에 해당할 수 있어요.',
      checks: ['출퇴근 기록', '급여명세서의 수당 항목'],
    })
  }
  return out
}

// 2단계 계약서 분석 결과에서 나온 쟁점: 계약서 문구(인용)와 검색된 조문 근거가 있으면 "위반이에요"
export function clauseIssues(analysis: Analysis | null): LegalIssue[] {
  const out: LegalIssue[] = []
  for (const [i, c] of (analysis?.clauses ?? []).entries()) {
    if (c.severity === 'low' || !c.law) continue
    const lt = c.lawText
    const title = lt ? `${lt.name} ${lt.article}${lt.title ? ' ' + lt.title : ''}` : c.law
    // 계약서 인용문이 그 조항을 뒷받침할 때만 "위반이에요"(AI가 엉뚱한 줄을 인용한 경우는 "해당될 수 있어요"로 낮춤)
    const doc = c.severity === 'high' && !!(c.evidence || lt) && !!c.quote && quoteSupports(title + ' ' + c.law, c.quote)
    out.push({
      key: 'cl' + i, title, basis: doc ? 'document' : 'statement', from: '계약서', quote: c.quote,
      situation: doc ? `계약서의 이 문구는 ${c.law}를 위반한 약정이에요.` : `계약서의 이 문구가 ${c.law}에 어긋날 수 있어요. 실제 근무 방식을 함께 확인해야 해요.`,
    })
  }
  return out
}

// 조항별로 인용문에 꼭 있어야 하는 단서 (규칙으로 검증). 목록에 없는 조항은 단서 검사를 하지 않아요.
const QUOTE_NEEDS: [RegExp, RegExp][] = [
  [/제55조/, /주휴|휴일|시급에\s*포함|포함하여/],
  [/제54조/, /휴게/],
  [/제20조/, /위약|손해배상|배상|벌금|변상|공제/],
  [/제43조/, /공제|지연|지급일|지급하지|상계|전액|월급|급여/],
  [/제26조/, /해지|해고|통보|예고/],
  [/제6조.*최저임금|최저임금법/, /시급|임금|최저|월급|수습|\d{1,3}(,\d{3})+\s*원|\d{4,}\s*원/],
  [/제70조/, /야간|밤|\d{1,2}:\d{2}/],
  [/제6[47]조|제66조/, /친권|동의|가족관계|연소|미성년|\d{2}\s*세/],
]
export const quoteSupports = (lawText: string, quote: string) => {
  const need = QUOTE_NEEDS.find(([law]) => law.test(lawText))
  return !need || need[1].test(quote)
}
export const dedupeIssues = (list: LegalIssue[]) => {
  const seen = new Map<string, LegalIssue>()
  for (const x of list) {
    const k = (refOf(x.title)?.name ?? '') + (refOf(x.title)?.art ?? x.title)
    const prev = seen.get(k)
    if (!prev || (x.basis === 'document' && prev.basis !== 'document')) seen.set(k, x) // 확실한 자료가 있는 쪽을 남김
  }
  return [...seen.values()]
}

export const issueLine = (x: LegalIssue) => `${x.title} — ${verdictOf(x.basis)}`
export { won }
