// 개인정보 마스킹 (계약서 텍스트·상담 문장을 AI에 보내기 전에 사용)
const NAME = '[가-힣](?:[ \\t]?[가-힣]){1,2}(?![가-힣])'

const RULES: [RegExp, string][] = [
  [/\d{6}\s?[-–~]\s?[1-4]\d{6}/g, '[주민등록번호]'],
  [/01[016789]\s?[-–.]?\s?\d{3,4}\s?[-–.]?\s?\d{4}/g, '[연락처]'],
  [/0\d{1,2}\s?[-–]\s?\d{3,4}\s?[-–]\s?\d{4}/g, '[연락처]'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[이메일]'],
  [/\d{2,6}[-–]\d{2,6}[-–]\d{2,8}(?:[-–]\d{1,4})?/g, '[계좌/번호]'],
  [new RegExp('((?:사업주|근로자|대표자|대표|성명|이름)\\s*(?:성명)?\\s*[:：]\\s*)' + NAME, 'g'), '$1[이름]'],
  [/(?<![가-힣])[가-힣](?:[ \t]?[가-힣]){1,3}(?=\s*\(\s*이하\s*["“'‘]?\s*[갑을])/g, '[이름]'], // 예: 홍길동(이하 "갑")
  [/((?:사업장\s*)?주소\s*[:：]?\s*)[^\n]+/g, '$1[주소]'],
]

export function maskText(text: string): { out: string; count: number } {
  let count = 0
  let out = text
  for (const [re, rep] of RULES) {
    out = out.replace(re, (...a: unknown[]) => {
      count++
      return rep.replace(/\$1/g, typeof a[1] === 'string' ? a[1] : '')
    })
  }
  return { out, count }
}
