// 시연용 샘플 인물 (이름·회사·연락처는 모두 지어낸 것입니다)
export type SampleId = 'minsu' | 'jiwoo'

// ── 김민수: 카페 아르바이트 · 주휴수당 미지급 + 위약금 조항 ──
export const SAMPLE_TEXT = [
  '표준 근로계약서 (단시간근로자)',
  '',
  '사업주 성명 : 박서준 (대표자)',
  '사업장명 : 해온 카페',
  '사업장 주소 : 서울특별시 마포구 월드컵로 123',
  '근로자 성명 : 김민수',
  '연락처 : 010-1234-5678',
  '주민등록번호 : 040315-3123456',
  '',
  '1. 근로개시일 : 2026년 6월 1일',
  '2. 근무장소 : 해온 카페 홀 및 주방',
  '3. 업무내용 : 음료 제조 및 매장 관리',
  '4. 근로시간 : 월요일~금요일 16:00~20:00 (주 20시간)',
  '5. 시급 : 10,320원 (주휴수당은 시급에 포함하여 지급한 것으로 본다)',
  '6. 임금지급일 : 매월 10일',
  '7. 근로자가 사전 통보 없이 퇴사할 경우 손해배상금 30만원을 공제한다.',
  '8. 이 계약에 정함이 없는 사항은 근로기준법에 따른다.',
  '',
  '상시 근로자 수 : 7명',
].join('\n')

export const SAMPLE_CALC = {
  hourly: '10320', weekly: '20', months: '3', ot: '0', night: '0', hol: '0',
  under5: false, holidayPaid: false, extraPaid: true, missedWeeks: '0', received: '',
}

export const SAMPLE_FORM = {
  pName: '김민수', pRrn: '040315-3123456', pAddr: '서울특별시 서대문구 (예시 주소)',
  pMobile: '010-1234-5678', pEmail: 'minsu@example.com',
  rBoss: '박서준', rTel: '02-000-0000', rAddr: '서울특별시 마포구 월드컵로 123',
  rName: '해온 카페', rBizAddr: '서울특별시 마포구 월드컵로 123', rBizTel: '02-000-0000',
  rCount: '7명', startDate: '2026-06-01', duty: '음료 제조 및 매장 관리', payDay: '매월 10일',
  office: '서울서부', attach: '근로계약서 사본, 급여 입금 내역',
}

// ── 박지우: 편의점 야간 · 최저임금 미달 + 수습 감액 + 휴게시간 없음 + 지각 공제 (사장 포함 3명, 한 주 결근) ──
export const SAMPLE_TEXT_JIWOO = [
  '표준 근로계약서 (단시간근로자)',
  '',
  '사업주 성명 : 최도윤 (대표자)',
  '사업장명 : 새벽 편의점 합정점',
  '사업장 주소 : 서울특별시 마포구 양화로 45',
  '근로자 성명 : 박지우',
  '연락처 : 010-9876-5432',
  '주민등록번호 : 050722-4123456',
  '',
  '1. 근로개시일 : 2026년 7월 1일 (계약기간 6개월)',
  '2. 근무장소 : 새벽 편의점 합정점',
  '3. 업무내용 : 계산, 진열, 재고 관리',
  '4. 근로시간 : 화~일 22:00~03:00 (주 30시간), 휴게시간 없음',
  '5. 시급 : 9,500원 (수습 3개월 동안은 시급의 90% 지급)',
  '6. 임금지급일 : 매월 말일 (사정에 따라 최대 30일 지연될 수 있다)',
  '7. 퇴직 시 1개월 전에 통보하지 않으면 마지막 달 급여를 지급하지 않는다.',
  '8. 지각 1회당 5,000원을 급여에서 공제한다.',
  '9. 이 계약에 정함이 없는 사항은 사장의 지시에 따른다.',
  '',
  '상시 근로자 수 : 3명',
].join('\n')

export const SAMPLE_CALC_JIWOO = {
  hourly: '9500', weekly: '30', months: '4', ot: '0', night: '30', hol: '0',
  under5: true, holidayPaid: false, extraPaid: false, missedWeeks: '1', received: '1238325', // 계약 시급대로 받은 월 평균
}

// 사업장명·업무·입사일·지급일·근로자 수는 일부러 비워 두어, 계약서를 분석하면 자동으로 채워지는 모습을 보여 줘요
export const SAMPLE_FORM_JIWOO = {
  pName: '박지우', pRrn: '050722-4123456', pAddr: '서울특별시 마포구 (예시 주소)',
  pMobile: '010-9876-5432', pEmail: 'jiwoo@example.com',
  rBoss: '최도윤', rTel: '02-000-0000', rAddr: '서울특별시 마포구 양화로 45', rBizAddr: '서울특별시 마포구 양화로 45', rBizTel: '02-000-0000',
  office: '서울서부', attach: '근로계약서 사본, 급여 입금 내역',
}

export const SAMPLES: Record<SampleId, { label: string; profile: string; text: string; calc: typeof SAMPLE_CALC; form: Record<string, string> }> = {
  minsu: { label: '김민수', profile: '카페 · 주휴수당', text: SAMPLE_TEXT, calc: SAMPLE_CALC, form: SAMPLE_FORM },
  jiwoo: { label: '박지우', profile: '편의점 · 최저임금', text: SAMPLE_TEXT_JIWOO, calc: SAMPLE_CALC_JIWOO, form: SAMPLE_FORM_JIWOO },
}

// OCR 시연용: 계약서 글을 사진처럼 그려서 돌려 줌 (줄 수에 맞춰 높이를 늘림)
export function makeSampleImage(text: string = SAMPLE_TEXT): string {
  const lines = text.split('\n')
  const c = document.createElement('canvas')
  c.width = 1400
  c.height = 160 + lines.length * 46
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#000'
  g.font = 'bold 44px "Malgun Gothic", sans-serif'
  g.fillText(lines[0], 70, 90)
  g.font = '34px "Malgun Gothic", sans-serif'
  lines.slice(1).forEach((line, i) => g.fillText(line, 70, 150 + i * 46))
  return c.toDataURL('image/png')
}
