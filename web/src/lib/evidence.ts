import type { Analysis } from '@/lib/api'
import type { CalcResult } from '@/lib/calc'

// 사건(상담 내용·계산·계약서 분석)에 맞춰 노무사 상담·진정서에 필요한 증빙자료 목록을 만듭니다.
// proves: 이 자료가 내 사건의 어떤 쟁점을 보여주는지 (진정서·리포트에서 "자료 ↔ 쟁점" 연결 표시에 사용)
export interface Evidence { id: string; label: string; why: string; proves: string }

// 그 자료가 없을 때 대신 할 수 있는 것
export const EVIDENCE_ALT: Record<string, string> = {
  contract: '사업장에 사본을 요청하거나, 조건이 적힌 문자·카톡·채용 공고를 모아 두세요.',
  payslip: '사업장에 요청할 수 있어요. 못 받았다면 통장 입금 내역으로 대신해요.',
  bank: '은행 앱에서 입금 내역을 캡처하거나 거래내역서를 발급받으세요.',
  attend: '메신저 근무표, 교통카드 내역, 직접 적은 근무 메모도 도움이 돼요.',
  msg: '앞으로는 요청한 내용을 문자나 카톡으로 남겨 두세요.',
  harass: '지금부터라도 날짜·시간·한 말을 메모해 두세요. 메모도 증거가 돼요.',
  fire: '해고 통보를 말로만 들었다면 날짜·장소·한 말을 바로 적어 두세요.',
  insure: '4대보험 가입내역은 정부24·국민연금공단 사이트에서 무료로 뽑을 수 있어요.',
  injury: '다친 날 진료받은 병원에서 진료기록 사본을 발급받을 수 있어요.',
}

export type Topic = 'wage' | 'dismissal' | 'harassment' | 'discrimination' | 'injury' | 'minor' | 'severance' | 'misclassified' | 'forced' | 'contract'

const TOPIC_RE: [Topic, RegExp][] = [
  ['wage', /임금|월급|급여|수당|체불|최저임금|시급/],
  ['dismissal', /해고|나오지 말|그만 나오/],
  ['harassment', /괴롭힘|폭언|욕설|욕을|모욕|성희롱|폭행|따돌/],
  ['discrimination', /차별|외국인|국적|이주/],
  ['injury', /산재|다쳤|부상|재해|사고/],
  ['minor', /미성년|18세|고등학생|청소년|연소/],
  ['severance', /퇴직금|퇴직급여|연차/],
  ['misclassified', /프리랜서|3\.3|사업소득|근로자성|위촉/],
  ['forced', /여권|외국인등록증|신분증.{0,6}(보관|맡|가져)|강제\s*근로/],
]

// 사건 유형 판단: AI 상담 분류(caseKey) + 상담·법 조항·계약서에 나온 말 + 계산 결과
export function topicsOf(opts: { calc: CalcResult | null; analysis: Analysis | null; caseKey: string; text: string }): Topic[] {
  const s = new Set<Topic>()
  if (opts.caseKey && opts.caseKey !== 'other') s.add(opts.caseKey as Topic)
  for (const [k, re] of TOPIC_RE) if (re.test(opts.text)) s.add(k)
  if (opts.calc && opts.calc.total > 0) s.add('wage')
  if (opts.analysis?.clauses?.length) s.add('contract')
  if (!s.size) s.add('wage') // 아무 정보가 없으면 가장 흔한 임금 문제 기준
  return [...s]
}

export function evidenceList(opts: { calc: CalcResult | null; analysis: Analysis | null; caseKey: string; text: string }): Evidence[] {
  const { calc, analysis } = opts
  const topics = topicsOf(opts)
  const has = (t: Topic) => topics.includes(t)
  const out: Evidence[] = []
  const add = (e: Evidence) => { if (!out.some((x) => x.id === e.id)) out.push(e) }

  add({ id: 'contract', label: '근로계약서 (원본 또는 사진)', proves: '근로 조건',
    why: analysis ? '분석한 조항을 노무사가 직접 확인해요' : '없다면 "계약서를 받지 못했다"는 것도 상담 내용이에요' })

  if (has('wage') || has('severance') || has('misclassified')) {
    const unpaid = calc && calc.total > 0 ? `못 받은 돈 (약 ${Math.round(calc.total).toLocaleString()}원)` : '임금 지급'
    add({ id: 'payslip', label: '급여명세서', proves: unpaid, why: '어떤 항목이 얼마나 지급됐는지 확인해요' })
    add({ id: 'bank', label: '월급이 들어온 통장 거래내역', proves: unpaid, why: '실제로 받은 금액의 가장 확실한 증거예요' })
    const wk = calc && (calc.holUnpaid > 0 || calc.extraUnpaid > 0)
    add({ id: 'attend', label: '출퇴근 기록 (근무표, 메신저 근무 공지, 교통카드 내역 등)', proves: wk ? '주휴·가산수당 (실제 근무시간)' : '실제 근무시간',
      why: wk ? '주휴·가산수당은 실제로 일한 시간이 핵심 근거예요' : '실제로 일한 시간을 보여줘요' })
    if (calc && calc.minWageUnpaid > 0) add({ id: 'wage', label: '시급이 적힌 자료 (채용 공고, 계약서, 대화 캡처)', proves: '최저임금 미달', why: '최저임금보다 낮게 약속된 사실을 보여줘요' })
  }
  if (has('dismissal')) {
    add({ id: 'fire', label: '해고 통보 내용 (문자·카톡·서면·녹음)', proves: '해고', why: '언제, 어떤 방식으로 해고됐는지가 핵심이에요 (서면 통지가 없었는지도 중요)' })
    add({ id: 'attend', label: '출퇴근 기록 (근무표, 메신저 근무 공지, 교통카드 내역 등)', proves: '해고 전까지 근무한 사실', why: '해고 직전까지 일했다는 걸 보여줘요' })
  }
  if (has('harassment')) {
    add({ id: 'harass', label: '폭언·괴롭힘 기록 (녹음, 메시지, 날짜별 메모)', proves: '직장 내 괴롭힘', why: '언제, 누가, 어떤 말·행동을 했는지가 중요해요' })
    add({ id: 'witness', label: '목격한 동료의 이름·연락처', proves: '직장 내 괴롭힘', why: '내 말을 뒷받침해 줄 수 있어요' })
    add({ id: 'medical', label: '병원·상담 기록 (정신건강의학과 진료, 심리상담 등이 있다면)', proves: '괴롭힘으로 인한 피해', why: '피해 정도를 보여줘요' })
  }
  if (has('discrimination')) {
    add({ id: 'discrim', label: '차별 대우를 받은 기록 (날짜별 메모, 메시지, 녹음)', proves: '차별', why: '어떤 차별을 받았는지 구체적으로 보여줘요' })
    add({ id: 'compare', label: '같은 일을 하는 다른 직원과 조건이 다르다는 자료 (급여, 근무 배치 등)', proves: '차별', why: '나만 다르게 대우받았다는 근거가 돼요' })
    if (/외국인|국적|이주|베트남|필리핀|네팔/.test(opts.text)) add({ id: 'alien', label: '외국인등록증 (외국인 근로자인 경우)', proves: '체류·고용 자격', why: '상담 접수 때 필요해요' })
  }
  if (has('injury')) {
    add({ id: 'injury', label: '병원 진료기록·진단서·치료비 영수증', proves: '업무상 재해', why: '일하다 다친 사실과 치료 내용을 보여줘요' })
    add({ id: 'accident', label: '사고 경위 메모·사진, 목격자 연락처', proves: '업무상 재해', why: '일하던 중에 다쳤다는 걸 보여줘요' })
  }
  if (has('minor')) {
    add({ id: 'guardian', label: '친권자(부모님) 동의서·가족관계증명서', proves: '연소근로자 보호', why: '18세 미만은 부모님 동의서를 사업장에 두어야 해요' })
    add({ id: 'attend', label: '출퇴근 기록 (근무표, 메신저 근무 공지, 교통카드 내역 등)', proves: '야간·연장 근로 여부', why: '18세 미만 야간 근로는 원칙적으로 금지예요' })
  }
  if (has('severance')) {
    add({ id: 'insure', label: '입사·퇴사일을 알 수 있는 자료 (4대보험 가입내역, 재직증명서)', proves: '퇴직금 (1년 이상 근무)', why: '1년 이상 일했는지가 퇴직금의 조건이에요' })
    add({ id: 'leave', label: '연차 사용 기록 (휴가 신청 메시지 등)', proves: '연차수당', why: '쓰지 못한 연차를 계산할 때 필요해요' })
  }
  if (has('misclassified')) {
    add({ id: 'order', label: '업무 지시 기록 (카톡 지시, 근무표, 정해진 출퇴근 시간)', proves: '근로자성', why: '프리랜서 계약이어도 지시를 받으며 일했다면 근로자로 인정될 수 있어요' })
    add({ id: 'tax', label: '3.3% 세금이 떼인 입금 내역', proves: '근로자성', why: '사업소득으로 처리된 사실을 보여줘요' })
  }
  if (has('forced')) add({ id: 'keep', label: '여권·신분증을 회사가 가져간 사실 (대화, 사진, 보관 확인서)', proves: '강제근로·신분증 보관', why: '본인 의사에 반한 보관은 금지돼 있어요' })

  add({ id: 'msg', label: '사장님·관리자와 나눈 문자·카톡', proves: '사건 경위', why: '지시, 약속, 거절한 내용을 보여줘요' })
  add({ id: 'id', label: '신분증', proves: '본인 확인', why: '상담 접수 때 필요할 수 있어요' })
  return out
}
