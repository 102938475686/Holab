// 서울시 노동자종합지원기관(자치구 노동복지센터·노동자종합지원센터) 실제 연락처.
// 출처: 서울노동포털 "서울시 노동자종합지원기관 연락처" (공식 공개 자료, 2026-10-30 확인)
// https://www.seoullabor.or.kr/portal/cnts/selectContents.do?cntnts_id=A1000053
// 모두 공인노무사가 상주·배치되어 무료 노동상담을 제공하는 서울시 위탁/구립 기관입니다.
// ※ 공개 자료에는 센터별 전문 분야·평가가 구분돼 있지 않습니다. 그래서 HoLab은 센터마다 다른 "분야 태그"나 "적합도 %"를 만들지 않고,\n//   확인 가능한 사실(위치·거리, 기관 유형, 노무사 상주)만으로 순서를 정합니다.
//   진정서·리포트 전송은 시연을 위해 항상 테스트 주소로만 발송되고, 실제로 기관에 접수되지 않습니다.
export const CENTERS_SOURCE = {
  label: '서울노동포털 · 서울시 노동자종합지원기관 연락처',
  url: 'https://www.seoullabor.or.kr/portal/cnts/selectContents.do?cntnts_id=A1000053',
  checkedAt: '2026-10-30',
}

export interface Lawyer {
  name: string // 기관명
  office: string // 기관 유형
  region: string // 자치구/권역
  address: string
  phone: string
  email?: string
  website?: string
  resp: string
  lat: number // 주소 지오코딩 좌표 (OpenStreetMap Nominatim, 2026-10-30 확인) — 거리 계산 전용
  lon: number
}


export const LAWYERS: Lawyer[] = [
  { name: '서울노동권익센터(영등포)', office: '서울시 광역 노동권익센터', region: '영등포구', address: '서울 영등포구 국회대로44길 10, 서울시노동자복지관 4층', phone: '02-6925-4349', email: 'labors@labors.or.kr', website: 'www.labors.or.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5250995, lon: 126.9036308 },
  { name: '서울노동권익센터(아현)', office: '서울시 광역 노동권익센터', region: '마포구', address: '서울 마포구 환일길 13, 강북노동자복지관 4층', phone: '02-376-0001(법률상담)', email: undefined, website: 'www.labors.or.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.553982, lon: 126.9605475 },
  { name: '마포구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '마포구', address: '서울 마포구 매봉산로 18, 마포창업복지관 305호', phone: '02-306-2226(노동상담)', email: 'mapolabor@gmail.com', website: 'www.mapolabor.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5742242, lon: 126.8899599 },
  { name: '영등포구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '영등포구', address: '서울 영등포구 버드나루로23길 24, 3·4층', phone: '02-2633-7989(노동상담)', email: 'ydpnodong@gmail.com', website: 'www.ydpnodong.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.529693, lon: 126.9068315 },
  { name: '관악구노동복지센터', office: '자치구 노동복지센터', region: '관악구', address: '서울 관악구 남부순환로234길 37, 3층', phone: '02-886-7900', email: 'galwc@gwanaklabor.kr', website: 'gwanaklabor.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.4777029, lon: 126.9567957 },
  { name: '구로구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '구로구', address: '서울 구로구 디지털로 242, 한화비즈메트로 1차 213호', phone: '02-852-7341', email: 'gurond@daum.net', website: 'www.laborguro.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.4828967, lon: 126.8940058 },
  { name: '금천구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '금천구', address: '서울 금천구 디지털로 178, 퍼블릭가산 A동 5층', phone: '02-2627-2141(노동상담)', email: undefined, website: 'geumcheon.go.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.4764639, lon: 126.8873368 },
  { name: '노원노동복지센터', office: '자치구 노동복지센터', region: '노원구', address: '서울 노원구 동일로 1530-1, 지하철 7호선 마들역 지하 1층', phone: '070-4610-3462(노동상담)', email: undefined, website: 'nowonlwc.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.6215016, lon: 127.0742919 },
  { name: '성동근로자복지센터', office: '자치구 노동복지센터', region: '성동구', address: '서울 성동구 상원6나길 22-11, 성동지역경제혁신센터 2층', phone: '02-497-8573(노동상담)', email: 'sdlabor1@gmail.com', website: 'www.sdlabor.or.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5480676, lon: 127.0498644 },
  { name: '성북구 노동권익센터', office: '자치구 노동권익센터', region: '성북구', address: '서울 성북구 화랑로 211, 성북벤처창업지원센터 206호', phone: '02-909-3988', email: 'seongbuklabor@naver.com', website: 'www.sblabor.or.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.6115128, lon: 127.0595792 },
  { name: '용산구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '용산구', address: '서울 용산구 원효로97길 30, 2층', phone: '02-2199-7227(노동법률상담)', email: 'ysnodongcn@naver.com', website: 'www.ysnodong.or.kr', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5418566, lon: 126.969407 },
  { name: '서대문구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '서대문구', address: '서울 서대문구 통일로 484, 공유캠퍼스 331호', phone: '02-395-0025(노동상담)', email: 'sdmworker@sdmworker.org', website: 'sdmworker.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5915743, lon: 126.943076 },
  { name: '강서구노동복지센터', office: '자치구 노동복지센터', region: '강서구', address: '서울 양천로10길 38, 신마곡벽산블루밍 메트로 오피스텔 106동 2층', phone: '02-2665-4037(노동상담)', email: 'gangseolc@gmail.com', website: 'www.gangseolabor.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5711205, lon: 126.8084756 },
  { name: '강북구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '강북구', address: '서울 강북구 한천로139가길 14, 초이스빌딩 6층', phone: '02-901-2656(노동상담)', email: 'sumicpla@gangbuk.go.kr', website: undefined, resp: '무료 노동상담 (공인노무사 상주)', lat: 37.640123, lon: 127.025598 },
  { name: '광진구노동복지센터', office: '자치구 노동복지센터', region: '광진구', address: '서울 광진구 아차산로 212, 더포디엄830 302호', phone: '070-7730-5573(노동상담)', email: 'gjworker79@hanmail.net', website: 'www.gjworker.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.5387157, lon: 127.0743583 },
  { name: '도봉구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '도봉구', address: '서울 도봉구 도봉로170길 2, 도봉역 하부공간 4·5호', phone: '02-3494-4400', email: 'dobonglabor@dobonglabor.hanbiro.net', website: 'dobonglabor.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.6792077, lon: 127.0455468 },
  { name: '은평구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '은평구', address: '서울 은평구 통일로 1045', phone: '02-6952-1875(노동상담)', email: 'eplabors@naver.com', website: 'www.eplabor.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.6357834, lon: 126.9165398 },
  { name: '중랑구 노동자종합지원센터', office: '자치구 노동자종합지원센터', region: '중랑구', address: '서울 중랑구 양원역로 92, LH서울양원1단지 104동', phone: '02-496-8477(상담)', email: 'jnlabor@jnlabor.org', website: 'jnlabor.org', resp: '무료 노동상담 (공인노무사 상주)', lat: 37.6033016, lon: 127.1075172 },
]

// 공개 자료상 모든 센터가 공통으로 제공하는 상담 범위(센터별 구분 없음)
export const COMMON_SCOPE = '임금체불·주휴수당·최저임금·가산수당·근로계약·부당해고 등 일반 노동상담'
export const isWide = (l: Lawyer) => l.office.includes('광역')

// ── 노무사 DB (센터 단위) ─────────────────────────────────────────────
// 서울노동포털·각 센터 홈페이지를 확인한 결과, 상담 노무사의 "개인 명단·인원·전담 분야·센터별 상담 요일/시간"은 공개돼 있지 않습니다.
// 그래서 이름이나 전문 분야를 지어내지 않고, 확인된 사실만 채우고 공개되지 않은 칸은 null(= "공개 자료 없음")로 둡니다.
// 팀이 센터에 전화해 확인한 값이 생기면 아래 COUNSELOR_OVERRIDES에 센터명으로 넣으면 화면에 자동으로 "확인됨"으로 표시됩니다.
export interface CounselorRecord {
  qualification: '공인노무사'
  resident: boolean // 공인노무사 상주 여부 (서울노동포털 안내)
  headcount: number | null // 상담 노무사 인원 — 공개 자료 없음
  names: string[] | null // 노무사 개인 이름 — 공개 자료 없음(개인정보라 수집하지 않음)
  hours: string | null // 센터별 상담 요일·시간 — 공개 자료 없음
  specialties: string[] | null // 전담 분야 — 공개 자료 없음
  verifiedAt: string | null // 위 값을 사람이 확인한 날짜
  verifiedBy: string | null // 확인 방법(예: 센터 전화 문의)
}

// 직접 확인한 값이 있을 때만 여기에 추가하세요. 예) '마포구 노동자종합지원센터': { hours: '평일 14:00~17:00', verifiedAt: '2026-11-01', verifiedBy: '센터 전화 문의' }
export const COUNSELOR_OVERRIDES: Record<string, Partial<CounselorRecord>> = {}

// ── 임시 노무사 데이터 (시연용 가상 인물) ──────────────────────────────
// 실제 노무사 명단은 공개돼 있지 않아서, 매칭 기능을 보여 주려고 센터마다 가상의 노무사 1명을 넣었습니다.
// 이름·분야·이메일(example.com)은 모두 가짜이며, 실제 서비스에서는 센터 확인을 거친 값으로 교체합니다.
export interface LabLawyer { name: string; specialties: string[]; hours: string; email: string; intro: string }
export const LAB_LAWYERS: Record<string, LabLawyer[]> = {
  '서울노동권익센터(영등포)': [{ name: '김서연', specialties: ['임금체불', '퇴직금', '최저임금'], hours: '평일 10:00~17:00', email: 'nomusa01@example.com', intro: '체불임금·퇴직금 진정 경험이 많아요' }, { name: '이준호', specialties: ['부당해고', '직장 내 괴롭힘'], hours: '화·목 13:00~18:00', email: 'nomusa01b@example.com', intro: '해고와 괴롭힘이 함께 있는 사건을 봐요' }],
  '서울노동권익센터(아현)': [{ name: '박지훈', specialties: ['부당해고', '근로계약'], hours: '평일 10:00~16:00', email: 'nomusa02@example.com', intro: '해고·징계 구제신청을 주로 도와요' }, { name: '송미래', specialties: ['임금체불', '퇴직금', '청소년·아르바이트'], hours: '평일 13:00~18:00', email: 'nomusa02b@example.com', intro: '청년 근로자 체불·퇴직금 상담이 많아요' }],
  '마포구 노동자종합지원센터': [{ name: '이하은', specialties: ['직장 내 괴롭힘', '차별'], hours: '평일 13:00~18:00', email: 'nomusa03@example.com', intro: '괴롭힘·차별 사건을 주로 맡아요' }, { name: '유가온', specialties: ['임금체불', '최저임금', '주휴수당'], hours: '월·수 10:00~17:00', email: 'nomusa03b@example.com', intro: '수당 계산과 체불 진정을 도와요' }],
  '영등포구 노동자종합지원센터': [{ name: '최민재', specialties: ['산재', '임금체불'], hours: '화·목 10:00~17:00', email: 'nomusa04@example.com', intro: '산재 신청과 임금 문제를 함께 봐요' }, { name: '안서진', specialties: ['직장 내 괴롭힘', '차별'], hours: '평일 14:00~19:00', email: 'nomusa04b@example.com', intro: '괴롭힘·차별 구제를 주로 맡아요' }],
  '관악구노동복지센터': [{ name: '정유진', specialties: ['청소년·아르바이트', '최저임금', '주휴수당'], hours: '평일 14:00~19:00', email: 'nomusa05@example.com', intro: '아르바이트 근로자 상담이 많아요' }, { name: '임도현', specialties: ['임금체불', '퇴직금', '근로계약'], hours: '평일 10:00~16:00', email: 'nomusa05b@example.com', intro: '계약과 체불 문제를 함께 봐요' }],
  '구로구 노동자종합지원센터': [{ name: '한도윤', specialties: ['외국인근로자', '임금체불', '근로계약'], hours: '평일 10:00~17:00', email: 'nomusa06@example.com', intro: '외국인 근로자 사건 경험이 있어요' }, { name: '황지민', specialties: ['부당해고', '차별'], hours: '화·목 10:00~17:00', email: 'nomusa06b@example.com', intro: '해고·차별 구제신청 경험이 있어요' }],
  '금천구 노동자종합지원센터': [{ name: '오세린', specialties: ['퇴직금', '임금체불', '부당해고'], hours: '평일 09:30~16:30', email: 'nomusa07@example.com', intro: '퇴직금·해고 분쟁을 주로 도와요' }, { name: '전하윤', specialties: ['근로계약', '최저임금', '청소년·아르바이트'], hours: '평일 14:00~19:00', email: 'nomusa07b@example.com', intro: '알바 계약서 점검을 많이 해요' }],
  '노원노동복지센터': [{ name: '강태준', specialties: ['근로계약', '최저임금', '주휴수당'], hours: '월·수·금 10:00~17:00', email: 'nomusa08@example.com', intro: '계약서 점검과 수당 계산에 강해요' }, { name: '고은서', specialties: ['임금체불', '퇴직금'], hours: '평일 10:00~17:00', email: 'nomusa08b@example.com', intro: '체불·퇴직금 진정을 주로 도와요' }],
  '성동근로자복지센터': [{ name: '윤지아', specialties: ['직장 내 괴롭힘', '부당해고'], hours: '평일 10:00~17:00', email: 'nomusa09@example.com', intro: '괴롭힘 뒤 해고된 사건을 많이 봐요' }, { name: '차민석', specialties: ['임금체불', '근로계약', '최저임금'], hours: '월·수·금 13:00~18:00', email: 'nomusa09b@example.com', intro: '임금 전반 상담이 많아요' }],
  '성북구 노동권익센터': [{ name: '장현우', specialties: ['산재', '근로계약', '퇴직금'], hours: '평일 10:00~16:00', email: 'nomusa10@example.com', intro: '산재와 계약 문제를 같이 봐 드려요' }, { name: '백지우', specialties: ['직장 내 괴롭힘', '부당해고'], hours: '평일 10:00~16:00', email: 'nomusa10b@example.com', intro: '괴롭힘 뒤 해고 사건을 봐요' }],
  '용산구 노동자종합지원센터': [{ name: '신예린', specialties: ['청소년·아르바이트', '주휴수당', '임금체불'], hours: '평일 15:00~19:00', email: 'nomusa11@example.com', intro: '알바 주휴수당·체불 상담이 많아요' }, { name: '남기훈', specialties: ['산재', '임금체불', '퇴직금'], hours: '화·목 10:00~17:00', email: 'nomusa11b@example.com', intro: '산재와 체불이 겹친 사건을 봐요' }],
  '서대문구 노동자종합지원센터': [{ name: '문재원', specialties: ['차별', '직장 내 괴롭힘', '근로계약'], hours: '평일 10:00~17:00', email: 'nomusa12@example.com', intro: '차별 구제와 계약 문제를 도와요' }, { name: '심유나', specialties: ['임금체불', '최저임금', '주휴수당'], hours: '평일 13:00~18:00', email: 'nomusa12b@example.com', intro: '수당·최저임금 문제에 강해요' }],
  '강서구노동복지센터': [{ name: '배수민', specialties: ['외국인근로자', '산재', '임금체불'], hours: '화·목 10:00~18:00', email: 'nomusa13@example.com', intro: '이주 노동자 산재·체불 경험이 있어요' }, { name: '추성민', specialties: ['부당해고', '차별', '직장 내 괴롭힘'], hours: '평일 10:00~17:00', email: 'nomusa13b@example.com', intro: '이주 노동자 차별·해고 사건을 봐요' }],
  '강북구 노동자종합지원센터': [{ name: '조하준', specialties: ['부당해고', '임금체불'], hours: '평일 10:00~17:00', email: 'nomusa14@example.com', intro: '해고와 체불이 겹친 사건을 많이 봐요' }, { name: '민서아', specialties: ['청소년·아르바이트', '주휴수당', '최저임금'], hours: '평일 14:00~19:00', email: 'nomusa14b@example.com', intro: '알바 수당 상담이 많아요' }],
  '광진구노동복지센터': [{ name: '서다은', specialties: ['최저임금', '주휴수당', '근로계약'], hours: '평일 13:00~18:00', email: 'nomusa15@example.com', intro: '최저임금·수당 문제에 강해요' }, { name: '봉재현', specialties: ['임금체불', '부당해고', '퇴직금'], hours: '월·화·목 10:00~17:00', email: 'nomusa15b@example.com', intro: '해고 후 체불 사건을 봐요' }],
  '도봉구 노동자종합지원센터': [{ name: '노승현', specialties: ['퇴직금', '산재', '임금체불'], hours: '월·화·목 10:00~17:00', email: 'nomusa16@example.com', intro: '퇴직금과 산재를 주로 맡아요' }, { name: '곽다인', specialties: ['근로계약', '청소년·아르바이트', '주휴수당'], hours: '평일 13:00~18:00', email: 'nomusa16b@example.com', intro: '청년 근로계약 상담이 많아요' }],
  '은평구 노동자종합지원센터': [{ name: '권나연', specialties: ['직장 내 괴롭힘', '부당해고', '차별'], hours: '평일 10:00~17:00', email: 'nomusa17@example.com', intro: '괴롭힘·해고·차별 사건을 맡아요' }, { name: '맹현주', specialties: ['임금체불', '퇴직금', '근로계약'], hours: '평일 10:00~16:00', email: 'nomusa17b@example.com', intro: '체불·계약 문제를 도와요' }],
  '중랑구 노동자종합지원센터': [{ name: '홍지석', specialties: ['임금체불', '청소년·아르바이트'], hours: '평일 14:00~19:00', email: 'nomusa18@example.com', intro: '청년 근로자 체불 상담이 많아요' }, { name: '탁영우', specialties: ['산재', '부당해고'], hours: '화·목 10:00~17:00', email: 'nomusa18b@example.com', intro: '산재와 해고 사건을 맡아요' }],
}
export const lawyersOf = (l: Lawyer): LabLawyer[] => LAB_LAWYERS[l.name] ?? []

// 사용자의 사건에서 필요한 분야 태그를 뽑음 (노무사 전담 분야와 같은 이름을 씀)
export const needTags = (texts: string[], opts: { unpaid?: boolean; minWage?: boolean; holiday?: boolean; contract?: boolean }): string[] => {
  const t = texts.join(' ')
  const out: string[] = []
  const add = (tag: string, on: boolean) => { if (on && !out.includes(tag)) out.push(tag) }
  add('임금체불', !!opts.unpaid || /체불|미지급|못 ?받|임금/.test(t))
  add('최저임금', !!opts.minWage || /최저임금/.test(t))
  add('주휴수당', !!opts.holiday || /주휴/.test(t))
  add('퇴직금', /퇴직금/.test(t))
  add('근로계약', !!opts.contract || /계약서|근로계약/.test(t))
  add('부당해고', /해고|권고사직/.test(t))
  add('직장 내 괴롭힘', /괴롭힘|폭언|욕설|갑질/.test(t))
  add('차별', /차별|성희롱|국적/.test(t))
  add('산재', /산재|다쳤|업무상 ?(재해|사고)/.test(t))
  add('외국인근로자', /외국인|이주 ?노동|비자/.test(t))
  add('청소년·아르바이트', /알바|아르바이트|청소년|미성년/.test(t))
  return out
}

// 적합도: 전담 분야 일치(70점) + 거리(30점, 위치를 알 때만). 위치를 모르면 분야 일치만으로 100점 만점
export const matchScore = (lw: LabLawyer, need: string[], dist: number | null) => {
  const fit = lw.specialties.filter((s) => need.includes(s))
  if (need.length === 0) return { pct: null as number | null, fit }
  const ratio = fit.length / need.length
  const distPts = dist == null ? null : dist <= 3 ? 1 : dist <= 8 ? 0.66 : dist <= 15 ? 0.33 : 0
  const pct = Math.round(distPts == null ? ratio * 100 : ratio * 70 + distPts * 30)
  return { pct, fit }
}
// 센터 안 노무사를 적합도 순으로 (모르면 원래 순서)
export const rankLawyers = (l: Lawyer, need: string[], dist: number | null) =>
  lawyersOf(l).map((lw, i) => ({ lw, i, ...matchScore(lw, need, dist) })).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.fit.length - a.fit.length || a.i - b.i)

export const counselorOf = (l: Lawyer): CounselorRecord => {
  const ls = lawyersOf(l)
  return {
    qualification: '공인노무사', resident: l.resp.includes('노무사'),
    headcount: ls.length || null, names: ls.length ? ls.map((x) => x.name) : null, hours: null, specialties: ls.length ? [...new Set(ls.flatMap((x) => x.specialties))] : null,
    verifiedAt: null, verifiedBy: ls.length ? '임시 데이터(시연용 가상 인물)' : null,
    ...COUNSELOR_OVERRIDES[l.name],
  }
}
// 공개되지 않은 항목 → 화면에서 "전화로 확인하세요"로 안내
export const unknownFields = (c: CounselorRecord) => [
  c.hours == null && '상담 요일·시간', c.specialties == null && '전담 분야', c.headcount == null && '상담 노무사 인원',
].filter(Boolean) as string[]

// 서울시 공통 상담 안내 (서울노동포털 · 노동상담 안내)
export const SEOUL_COUNSEL = {
  hotline: '1661-2020',
  hotlineHours: '평일 10:00~17:00 (점심 12:00~13:00) · 센터마다 다를 수 있어요',
  who: '서울시민 또는 서울시 소재 직장 근무자',
  bring: ['근로계약서', '급여명세서(임금명세서)', '출퇴근 기록', '해고통지서(해당하는 경우)'],
  wide: [
    '방문상담: 서울노동포털 또는 전화로 미리 예약',
    '화상상담: 평일 10:00~17:00, 서울노동포털에서 신청 (02-6953-4596)',
  ],
  outreach: [
    '찾아가는 지하철 노동상담: 서울 25개 역에서 공인노무사 무료 상담 (2026년 3~12월)',
    '찾아가는 노동상담: 청소년·청년·특성화고 학생·졸업생 5명 이상이면 방문 상담 (02-6953-4596)',
  ],
  source: { label: '서울노동포털 · 노동상담 안내', url: 'https://www.seoullabor.or.kr/portal/cnts/selectContents.do?cntnts_id=A1000044', checkedAt: '2026-10-31' },
}

// 센터 대표번호 (서울노동포털 연락처 자료). 상담 전용 번호는 LAWYERS.phone에 있음
export const MAIN_PHONE: Record<string, string> = {
  '서울노동권익센터(영등포)': '02-6925-4349', '서울노동권익센터(아현)': '02-6953-4596(법률지원팀)', '강북구 노동자종합지원센터': '02-901-2657~9',
  '강서구노동복지센터': '02-2665-4038', '광진구노동복지센터': '02-458-5055', '금천구 노동자종합지원센터': '02-2627-2140',
  '노원노동복지센터': '1661-9275', '마포구 노동자종합지원센터': '02-306-2227', '서대문구 노동자종합지원센터': '02-395-0720',
  '성동근로자복지센터': '02-465-8573', '영등포구 노동자종합지원센터': '02-2633-7987', '용산구 노동자종합지원센터': '02-2199-7220',
  '은평구 노동자종합지원센터': '02-6952-1872', '중랑구 노동자종합지원센터': '02-496-8476',
}

// 전화할 때 물어볼 것: 공개 자료에 없는 항목을 사용자가 직접 확인할 수 있게
export const CALL_QUESTIONS = [
  '상담 가능한 요일·시간과 예약이 필요한지',
  '제 사건(임금·계약서·해고 등)을 맡아 줄 공인노무사가 있는지, 전담 분야가 있는지',
  '준비물과, 사업장에 가지 않고 서류만으로 접수할 수 있는지',
]

export const mapLink = (l: Lawyer) => `https://map.naver.com/p/search/${encodeURIComponent(l.address.replace(/,.*$/, ''))}`