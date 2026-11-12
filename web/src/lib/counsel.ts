import type { Analysis } from '@/lib/api'
import { won, type CalcResult } from '@/lib/calc'
import type { Lawyer } from '@/lib/lawyers'
import { SEOUL_COUNSEL } from '@/lib/lawyers'
import { issueLine, type LegalIssue } from '@/lib/legal'

// ── 상담 방식 (서울노동포털 · 노동상담 안내에서 확인된 것만) ──
// 방식마다 상담 리포트가 필요한 정도가 달라서, 방식을 고르면 준비물도 함께 바뀝니다.
export type MethodKey = 'phone' | 'video' | 'visit' | 'subway'
export interface Method {
  key: MethodKey
  label: string
  summary: string // 한 줄 설명
  how: string[] // 하는 방법 (확인된 내용)
  report: 'must' | 'good' | 'optional' // 상담 리포트가 얼마나 필요한지
  reportNote: string
  bring: string[] // 이 방식에 챙길 것
}

export const METHODS: Method[] = [
  {
    key: 'phone', label: '전화로 상담', summary: '가장 빠르게 문의하고 예약할 수 있어요',
    how: [`서울 통합노동상담 ${SEOUL_COUNSEL.hotline} (${SEOUL_COUNSEL.hotlineHours})`, '센터의 노동상담 전화로 바로 문의해도 돼요', '상담 요일·시간과 예약 필요 여부는 센터마다 달라서 통화로 확인해야 해요'],
    report: 'optional', reportNote: '전화 상담에는 통화 대본이면 충분해요. 리포트는 나중에 방문·화상 상담을 하게 될 때 만들어 두세요.',
    bring: ['사건 날짜와 금액을 적은 메모', '급여 입금 내역(캡처)'],
  },
  {
    key: 'video', label: '온라인 화상 상담', summary: '집에서 노무사와 화면으로 만나요',
    how: ['서울노동포털에서 예약 신청 → 담당자 승인 후 리모트미팅으로 진행해요', '평일 10:00~17:00 (점심 12:00~13:00 제외)', '신청 문의: 서울노동권익센터 법률지원팀 02-6953-4596 / law2024@labors.or.kr'],
    report: 'good', reportNote: '화면으로 리포트를 보여 주면서 설명할 수 있어요. 신청서에 붙여 넣을 사건 요약도 함께 준비돼요.',
    bring: ['상담 준비 리포트 PDF(화면 공유용)', '근로계약서·급여명세서 사진', '조용히 이야기할 수 있는 장소와 인터넷'],
  },
  {
    key: 'visit', label: '센터에 방문', summary: '서류를 직접 보여 주며 자세히 상담해요',
    how: ['서울노동권익센터는 서울노동포털 또는 전화로 미리 예약해야 해요', '자치구 센터는 예약이 필요한지 전화로 먼저 확인하세요'],
    report: 'must', reportNote: '서류를 보여 주며 짧은 시간에 설명해야 해서 리포트와 증빙이 가장 중요해요.',
    bring: [...SEOUL_COUNSEL.bring, '상담 준비 리포트 PDF(출력하면 좋아요)', '진정서 초안 PDF(작성했다면)'],
  },
  {
    key: 'subway', label: '지하철역 찾아가는 상담', summary: '가까운 역에서 노무사를 만나요',
    how: ['서울 25개 지하철역사에서 공인노무사가 무료 법률상담을 해요 (2026년 3~12월)', '역별 요일·시간은 서울노동포털 “지하철 노동상담 공지사항”에서 확인하세요'],
    report: 'good', reportNote: '현장 상담은 시간이 짧아서 리포트를 보여 주면 본론부터 이야기할 수 있어요.',
    bring: ['상담 준비 리포트 PDF(휴대폰으로 보여 주기)', '근로계약서·급여 입금 내역(사진)'],
  },
]
export const methodOf = (k: MethodKey) => METHODS.find((m) => m.key === k)!

// 복잡하거나 민감한 사건: 서류를 놓고 자세히 이야기해야 해서 방문·화상이 어울림
const COMPLEX = new Set(['dismissal', 'harassment', 'discrimination', 'injury', 'forced', 'minor'])

// 규칙으로 추천: 사건 유형 + 센터까지 거리 (AI가 아니라 고정 규칙이라 이유를 그대로 보여 줄 수 있어요)
export function recommendMethod(opts: { caseKey: string; distKm: number | null }): { key: MethodKey; reason: string }[] {
  const near = opts.distKm != null && opts.distKm < 8
  const complex = COMPLEX.has(opts.caseKey)
  const out: { key: MethodKey; reason: string }[] = []
  if (complex) {
    out.push({ key: near ? 'visit' : 'video', reason: near ? '사건이 복잡하거나 민감해서 서류를 보여 주며 자세히 이야기하는 편이 좋아요. 센터도 가까워요.' : '사건이 복잡하거나 민감한데 센터가 멀거나 위치를 몰라서, 이동 없이 노무사와 자세히 이야기할 수 있는 화상 상담이 좋아요.' })
    out.push({ key: near ? 'video' : 'visit', reason: near ? '이동이 어렵다면 화상으로도 같은 상담을 받을 수 있어요.' : '센터에 갈 수 있다면 방문 상담도 좋아요.' })
    out.push({ key: 'phone', reason: '먼저 전화로 예약과 준비물만 확인해도 돼요.' })
  } else {
    out.push({ key: 'phone', reason: '임금·계약서 문의처럼 비교적 단순한 사건은 전화로 먼저 물어봐도 충분한 경우가 많아요.' })
    out.push({ key: near ? 'visit' : 'video', reason: near ? '서류를 직접 보여 주고 싶다면 방문 상담이 좋아요.' : '더 자세한 상담이 필요하면 화상으로 이어갈 수 있어요.' })
  }
  return out
}

// ── 사건 요약(복사용): 화상상담 신청서나 통화 메모에 붙여 넣는 글. AI 없이 입력된 내용만으로 만듭니다 ──
export function buildBrief(opts: { facts: string[]; calc: CalcResult | null; analysis: Analysis | null; legal: LegalIssue[]; caseLabel: string }) {
  const lines: string[] = []
  if (opts.caseLabel) lines.push(`사건 유형: ${opts.caseLabel}`)
  for (const f of opts.facts.slice(0, 6)) lines.push(`- ${f}`)
  if (opts.calc && opts.calc.total > 0) lines.push(`- 못 받은 돈 추정: ${won(opts.calc.total)} (시급 ${opts.calc.hourly.toLocaleString()}원, 주 ${opts.calc.weekly}시간${opts.calc.months ? `, ${opts.calc.months}개월` : ''} 기준)`)
  const risky = (opts.analysis?.clauses ?? []).filter((c) => c.severity !== 'low').slice(0, 3)
  if (risky.length) lines.push(`- 계약서에서 확인된 조항: ${risky.map((c) => c.title).join(', ')}`)
  if (opts.legal.length) lines.push(`- 관련 법 조항(자동 정리): ${opts.legal.slice(0, 4).map(issueLine).join(' / ')}`)
  lines.push('- 궁금한 점: 이 사건이 어떤 절차로 해결될 수 있는지, 지금 모아야 할 자료가 무엇인지')
  return lines.join('\n')
}

// ── 통화 대본 기본값(AI가 없을 때·실패할 때) ──
export function fallbackScript(opts: { center: string; caseLabel: string; facts: string[]; calc: CalcResult | null }) {
  const bits = [
    `안녕하세요. 노동 상담을 예약하고 싶어서 전화드렸습니다.`,
    opts.caseLabel ? `${opts.caseLabel} 문제로 상담받고 싶습니다.` : '근로 조건과 관련해 상담받고 싶습니다.',
    ...opts.facts.slice(0, 2).map((f) => f.replace(/[.。]$/, '') + '.'),
    opts.calc && opts.calc.total > 0 ? `못 받은 돈은 약 ${won(opts.calc.total)}으로 계산해 보았습니다.` : '',
    '상담이 가능한 요일과 시간, 예약이 필요한지 알려 주실 수 있을까요?',
    '제 사건을 맡아 주실 수 있는 공인노무사님이 계신지, 그리고 가져가야 할 서류도 알려 주세요.',
  ].filter(Boolean)
  return bits.join(' ')
}

// ── 예약 기록(이 기기에만 저장) ──
export interface Reservation {
  method: MethodKey | ''
  status: 'before' | 'booked' | 'done'
  date: string // YYYY-MM-DD
  time: string // HH:MM
  checks: string[] // 챙겼다고 체크한 준비물
  seen: string[] // 마무리 인사를 이미 보여 준 상태('booked'·'done') — 같은 센터에서 반복해 띄우지 않으려고
}
const KEY = 'holab-reservations-v1'
const blank = (): Reservation => ({ method: '', status: 'before', date: '', time: '', checks: [], seen: [] })
function readAll(): Record<string, Reservation> { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
export const loadReservation = (center: string): Reservation => ({ ...blank(), ...(readAll()[center] ?? {}) })
export function saveReservation(center: string, r: Reservation) { try { const all = readAll(); all[center] = r; localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* 저장이 막힌 환경은 무시 */ } }
export function clearReservations() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

// ── 캘린더 파일(.ics): 내 일정에만 저장돼요. 센터에 전달되지 않습니다 ──
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
export function icsFor(center: Lawyer, r: Reservation, bring: string[]): string | null {
  if (!r.date || !r.time) return null
  const [y, m, d] = r.date.split('-'), [hh, mm] = r.time.split(':')
  const start = `${y}${m}${d}T${hh}${mm}00`
  const endH = String((+hh + 1) % 24).padStart(2, '0')
  const end = `${y}${m}${d}T${endH}${mm}00`
  const method = r.method ? methodOf(r.method).label : '상담'
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HoLab//ko', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:holab-${start}-${center.name.replace(/\s/g, '')}@holab`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${esc(`[HoLab] 노동 상담 · ${center.name} (${method})`)}`,
    `LOCATION:${esc(center.address)}`,
    `DESCRIPTION:${esc(`전화 ${center.phone}\n챙길 것: ${bring.join(', ')}\n※ 센터에 전달되는 일정이 아니라 내 일정이에요.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:내일 노동 상담이 있어요', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}
export function downloadIcs(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${name}.ics`; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
