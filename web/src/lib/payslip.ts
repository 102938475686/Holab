// 급여명세서 텍스트에서 "실제 받은 금액"을 뽑아내는 간단한 규칙 기반 추출기.
// AI나 서버를 거치지 않고 브라우저 안에서만 처리합니다 (OCR도 로컬 실행).
export interface PayslipMatch {
  amount: number
  kind: 'net' | 'gross'
  label: string
  matchedText: string
}

const NET_KEYWORDS = ['차인지급액', '실지급액', '실수령액', '차감지급액']
const GROSS_KEYWORDS = ['지급총액', '지급액계', '지급액 합계', '총지급액', '지급액 소계']

function findAmount(text: string, keywords: string[]): { amount: number; matchedText: string } | null {
  for (const kw of keywords) {
    const re = new RegExp(kw.replace(/\s/g, '\\s*') + '[^0-9]{0,12}([0-9][0-9,]{4,})')
    const m = text.match(re)
    if (m) {
      const n = Number(m[1].replace(/,/g, ''))
      if (n >= 1000 && n <= 50000000) return { amount: n, matchedText: m[0].slice(0, 40) }
    }
  }
  return null
}

export function extractPayAmount(text: string): PayslipMatch | null {
  const t = text.replace(/\s+/g, ' ')
  const net = findAmount(t, NET_KEYWORDS)
  if (net) return { amount: net.amount, kind: 'net', label: '차인지급액 (세후 실수령액)', matchedText: net.matchedText }
  const gross = findAmount(t, GROSS_KEYWORDS)
  if (gross) return { amount: gross.amount, kind: 'gross', label: '지급총액 (세전)', matchedText: gross.matchedText }
  return null
}
