// 사건 유형별 핵심 조문을 법제처 원문으로 내려받아 knowledge/사건유형_핵심조문.md 를 만듭니다.
// 조문 "본문"은 법제처(k-skill-proxy) 원문 그대로이고, 검색용 [키워드] 줄만 사람이 붙인 것입니다. (AI가 쓴 내용 없음)
// 실행: node scripts/build-knowledge.js
const fs = require('fs');
const path = require('path');

const BASE = (process.env.KSKILL_PROXY_BASE_URL || 'https://k-skill-proxy.nomadamas.org').replace(/\/$/, '') + '/v1/korean-law';
const get = async (p, ms = 15000) => {
  const r = await fetch(BASE + p, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('proxy ' + r.status);
  return r.json();
};
const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const flat = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? Object.values(x).map(flat).join(' ') : '');

// [법령명, 조 번호(문자열, 가지번호는 "76의2"), 검색 키워드]
const ARTICLES = [
  ['근로기준법', '2', '근로자 정의 프리랜서 3.3% 사업소득 도급 위탁 지휘 감독 출퇴근 임금을 목적으로 근로 제공 근로자성'],
  ['근로기준법', '6', '차별 균등한 처우 국적 외국인 이주노동자 신앙 사회적 신분 성별 인종 차별적 대우 시급 차이 욕설'],
  ['근로기준법', '7', '강제 근로 금지 감금 폭행 협박 여권 보관 못 그만두게 강요'],
  ['근로기준법', '8', '폭행 금지 때림 구타 폭행 신체 폭력'],
  ['근로기준법', '27', '해고 서면 통지 해고사유 구두 해고 문자 해고 통보 이유 안 알려줌 서면'],
  ['근로기준법', '28', '부당해고 구제신청 노동위원회 3개월 이내 부당해고 부당정직 구제 해고 당함 나오지 말라'],
  ['근로기준법', '30', '구제명령 원직 복직 임금 상당액 노동위원회 판정 부당해고 인정'],
  ['근로기준법', '70', '야간근로 휴일근로 제한 18세 미만 미성년 청소년 밤 10시 오후 10시 동의 인가 임산부'],
  ['근로기준법', '76의2', '직장 내 괴롭힘 금지 지위 관계 우위 신체적 정신적 고통 폭언 따돌림 외모 놀림 일 안 알려줌'],
  ['근로기준법', '76의3', '직장 내 괴롭힘 발생 시 조치 신고 조사 피해근로자 보호 불리한 처우 금지 사용자 신고'],
  ['근로기준법', '104', '신고 근로감독관 노동청 진정 위반 사실 신고 불리한 처우 금지 고용노동부장관'],
  ['산업재해보상보험법', '37', '산재 업무상 재해 업무상 사고 다쳤다 부상 질병 출퇴근 재해 인정 기준 사업주 산재 처리 안 해줌'],
  ['산업재해보상보험법', '10', '근로복지공단 설립 산재보험 신청 산재 신청 요양급여 신청 접수 공단 보험사업 관장 산재 처리 사업주 동의 없이'],
  ['산업재해보상보험법', '36', '보험급여 요양급여 휴업급여 장해급여 치료비 산재보험 급여의 종류 근로복지공단'],
  ['출입국관리법', '33의3', '외국인등록증 여권 보관 금지 사업주 보관 압수 외국인 신분증 여권 빼앗김'],
  ['남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', '12', '직장 내 성희롱 금지 성적 언동 성희롱 사업주 종업원 성적 굴욕감'],
  ['남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', '14', '직장 내 성희롱 발생 시 조치 신고 조사 피해자 보호 사업주 조치 불이익 금지'],
  ['외국인근로자의 고용 등에 관한 법률', '22', '외국인근로자 외국인 노동자 이주노동자 외국인이라는 이유 차별 처우 시급 차이 부당한 차별 금지 사용자 고용허가'],
];

async function lookup(name, num) {
  const [n, branch] = num.split('의');
  const jo = String(n).padStart(4, '0') + String(branch || 0).padStart(2, '0');
  const s = await get('/search?target=law&query=' + encodeURIComponent(name));
  const list = arr(s?.LawSearch?.law);
  const hit = list.find((x) => x['법령명한글'] === name && x['현행연혁코드'] === '현행') || list.find((x) => x['법령명한글'] === name);
  if (!hit) throw new Error('법령을 찾지 못함: ' + name);
  const d = await get(`/detail?target=law&MST=${encodeURIComponent(hit['법령일련번호'])}&JO=${jo}`);
  const units = arr(d?.법령?.조문?.조문단위);
  const unit = units.find((x) => x['조문여부'] === '조문') || units[0];
  if (!unit) throw new Error('조문을 찾지 못함');
  const head = typeof unit['조문내용'] === 'string' ? unit['조문내용'] : '';
  const sub = (h) => arr(h['호']).map((o) => [flat(o['호내용']), ...arr(o['목']).map((m) => flat(m['목내용']))].filter(Boolean).join(' ')).filter(Boolean);
  const paras = arr(unit['항']).map((h) => [flat(h['항내용'] ?? h), ...sub(h)].join(' ')).filter(Boolean);
  const text = [head, ...paras].join('\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').trim();
  return { title: unit['조문제목'] || '', text, efYd: hit['시행일자'] };
}

(async () => {
  const chunks = [];
  const failed = [];
  for (const [name, num, kw] of ARTICLES) {
    try {
      const r = await lookup(name, num);
      if (!r.text) throw new Error('본문 없음');
      chunks.push(`## ${name} 제${num.replace('의', '조의')}${num.includes('의') ? '' : '조'} ${r.title}\n[키워드: ${kw}]\n${r.text.slice(0, 900)}\n`);
      console.log('OK  ', name, num, r.title);
    } catch (e) { failed.push(`${name} 제${num}조: ${e.message}`); console.log('FAIL', name, num, e.message); }
  }
  const out = path.join(__dirname, '..', 'knowledge', '사건유형_핵심조문.md');
  fs.writeFileSync(out, chunks.join('\n'), 'utf8');
  console.log(`\n저장: ${out} (${chunks.length}개 조문, 실패 ${failed.length}개)`);
  if (failed.length) console.log(failed.join('\n'));
})();
