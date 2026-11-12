import type { CalcInput } from '@/lib/calc'

// 사용자가 AI 상담에서 직접 말한 숫자만 급여 계산 입력으로 옮깁니다. (AI의 해석이 아니라 사용자의 문장에서 규칙으로 뽑음 → 지어내지 않음)
// 못 찾은 항목은 건드리지 않습니다.
export interface Extracted { values: Partial<CalcInput>; labels: string[] }

const num = (s: string) => Number(s.replace(/,/g, ''))

export function extractCalcInput(messages: string[]): Extracted {
  const text = messages.join('\n')
  const values: Partial<CalcInput> = {}
  const labels: string[] = []

  const h = text.match(/시급\s*(?:이|은|는|가|을|를)?\s*(?:약\s*)?([\d,]{4,7})\s*원?/)
  if (h) { const v = num(h[1]); if (v >= 1000 && v <= 100000) { values.hourly = String(v); labels.push('시급') } }

  const w = text.match(/(?:주|일주일(?:에)?|한\s*주(?:에)?)\s*(?:약\s*)?(\d{1,2}(?:\.\d)?)\s*시간/)
  if (w) { const v = Number(w[1]); if (v > 0 && v <= 80) { values.weekly = String(v); labels.push('주 근로시간') } }

  const m = text.match(/(\d{1,2})\s*개월/)
  if (m) { const v = Number(m[1]); if (v > 0 && v <= 120) { values.months = String(v); labels.push('일한 기간') } }

  if (/5\s*인\s*미만|5\s*명\s*미만|(?:사장(?:님)?\s*포함|직원\s*포함|전체)\s*(?:[1-4])\s*명/.test(text)) { values.under5 = true; labels.push('5인 미만 사업장') }

  return { values, labels }
}
