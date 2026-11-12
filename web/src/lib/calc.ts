export const MIN_WAGE = 10320 // 2026년 최저임금
export const WEEKS_PER_MONTH = 4.345
export const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원'

export interface CalcInput {
  hourly: string
  weekly: string
  months: string
  ot: string
  night: string
  hol: string
  under5: boolean
  holidayPaid: boolean
  extraPaid: boolean
  received: string // 실제로 받은 급여(한 달 평균, 세전) — 받아야 할 급여와 비교용(선택)
  missedWeeks: string // 소정근로일을 하루라도 빠져 개근이 아니었던 주 수 (지각·조퇴는 세지 않음)
}

export const defaultCalcInput: CalcInput = {
  hourly: '', weekly: '', months: '', ot: '0', night: '0', hol: '0',
  under5: false, holidayPaid: false, extraPaid: false, missedWeeks: '0', received: '',
}

export interface CalcResult {
  hourly: number; legalHourly: number; weekly: number; months: number; weeks: number
  ot: number; night: number; hol: number
  under5: boolean; holidayPaid: boolean; extraPaid: boolean
  missedWeeks: number; holWeeks: number; monthlyHolPay: number
  eligible: boolean; holHours: number; weeklyHolPay: number; extraWeekly: number; basePay: number
  minWageGap: number; minWageUnpaid: number; holUnpaid: number; extraUnpaid: number
  total: number; monthlyDue: number; totalDue: number
}

export function calculate(i: CalcInput): CalcResult | null {
  const hourly = +i.hourly, weekly = +i.weekly, months = +i.months || 0
  if (!hourly || !weekly) return null
  const ot = +i.ot || 0, night = +i.night || 0, hol = +i.hol || 0
  const weeks = months * WEEKS_PER_MONTH
  // 계약 시급이 최저임금보다 낮으면 그 부분은 무효 → 법적으로는 최저임금이 시급. 주휴수당·가산수당·받아야 할 급여는 이 기준으로 계산
  const legalHourly = Math.max(hourly, MIN_WAGE)

  // 주휴수당은 "주 단위"로 판단: 소정근로일을 하루라도 빠진 주는 제외하고, 나머지 주만 계산
  const missedWeeks = Math.min(Math.max(+i.missedWeeks || 0, 0), weeks)
  const holWeeks = weeks - missedWeeks
  const holFrac = weeks > 0 ? holWeeks / weeks : 1 // 월 평균에 반영할 비율
  const eligible = weekly >= 15 && !(weeks > 0 && holWeeks <= 0)
  const holHours = weekly >= 15 ? (Math.min(weekly, 40) / 40) * 8 : 0
  const weeklyHolPay = holHours * legalHourly
  const extraWeekly = i.under5 ? 0 : legalHourly * 0.5 * (ot + night + hol) // 가산분(50%)
  const basePay = legalHourly * weekly

  const minWageGap = Math.max(0, MIN_WAGE - hourly)
  // 최저임금 차액: 계약 시급으로 이미 받은 시간(소정근로 + 연장·휴일 근로 기본급 + 받은 주휴수당)에 대해 최저임금과의 차이
  const minWageUnpaid = minWageGap * ((weekly + ot + hol) * weeks + (i.holidayPaid ? holHours * holWeeks : 0))
  const holUnpaid = i.holidayPaid ? 0 : weeklyHolPay * holWeeks
  const extraUnpaid = i.extraPaid ? 0 : extraWeekly * weeks
  const total = holUnpaid + extraUnpaid + minWageUnpaid
  const monthlyHolPay = weeklyHolPay * holFrac * WEEKS_PER_MONTH
  const monthlyDue = (basePay + weeklyHolPay * holFrac + extraWeekly + (ot + hol) * legalHourly) * WEEKS_PER_MONTH // 야간은 보통 계약된 근무시간 안의 시간이라 기본급을 또 더하지 않고 가산분만 반영

  // 일한 기간 전체 기준으로 받아야 할 임금 (월 평균인 monthlyDue와 구분해서 표시)
  const totalDue = basePay * weeks + weeklyHolPay * holWeeks + extraWeekly * weeks + (ot + hol) * legalHourly * weeks

  return {
    hourly, legalHourly, weekly, months, weeks, ot, night, hol,
    under5: i.under5, holidayPaid: i.holidayPaid, extraPaid: i.extraPaid,
    missedWeeks, holWeeks, monthlyHolPay, eligible, holHours, weeklyHolPay, extraWeekly, basePay,
    minWageGap, minWageUnpaid, holUnpaid, extraUnpaid, total, monthlyDue, totalDue,
  }
}
