// HoLab! 노동권 구제 에이전트 - 의존성 없는 Node 서버
const http = require('http');
const fs = require('fs');
const path = require('path');

// .env 수동 로드 (의존성 없음)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (e) { /* ignore */ }

const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const hasKey = () => !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('여기에');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.map': 'application/json' };
// 새 화면(React + shadcn)은 web/dist, 없으면 기존 public 화면을 사용
const WEB_DIST = path.join(__dirname, 'web', 'dist');
const staticRoot = () => (fs.existsSync(path.join(WEB_DIST, 'index.html')) ? WEB_DIST : path.join(__dirname, 'public'));

// 링크 공개 시 키 남용 방지: 시간당 AI 호출 횟수 제한 (초과 시 대체 응답)
let aiWindowStart = Date.now(), aiCount = 0;
const AI_LIMIT_PER_HOUR = +process.env.AI_LIMIT_PER_HOUR || 60;
function aiBudgetOk() {
  if (Date.now() - aiWindowStart > 3600e3) { aiWindowStart = Date.now(); aiCount = 0; }
  return ++aiCount <= AI_LIMIT_PER_HOUR;
}

async function callOpenAI(system, user, json) {
  if (!aiBudgetOk()) throw new Error('AI hourly limit reached');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 40000);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    signal: ctl.signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  clearTimeout(timer);
  if (!res.ok) throw new Error('OpenAI ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  return data.choices[0].message.content;
}

// ---------- 규칙 기반 대체 분석 (키 없음/호출 실패 시) ----------
function fallbackAnalyze(text) {
  const t = text.replace(/\s+/g, ' ');
  const clauses = [];
  const missing = [];
  const wageM = t.match(/시급[^0-9]{0,6}([0-9,]{4,7})\s*원/);
  if (wageM) {
    const w = parseInt(wageM[1].replace(/,/g, ''), 10);
    if (w < 10320) clauses.push({ title: '시급이 최저임금 미달', quote: wageM[0], severity: 'high', issue: `2026년 최저임금은 시급 10,320원입니다. 계약서의 ${w.toLocaleString()}원은 이보다 낮습니다.`, law: '최저임금법 제6조' });
  }
  const incl = t.match(/[^.]{0,20}주휴[^.]{0,12}(포함|별도로 지급하지|지급하지 않)[^.]{0,20}/);
  if (incl) clauses.push({ title: '주휴수당 포함 약정', quote: incl[0].trim(), severity: 'high', issue: '주휴수당은 법정 수당으로, 시급에 포함시키는 약정만으로 지급 의무가 사라지지 않습니다. 실제 시급이 최저임금 이상이면서 주휴수당이 별도로 산정되어야 합니다.', law: '근로기준법 제55조' });
  const pen = t.match(/[^.]{0,20}(손해배상|위약금|벌금)[^.]{0,30}/);
  if (pen) clauses.push({ title: '위약금·손해배상 예정 조항', quote: pen[0].trim(), severity: 'high', issue: '근로계약 불이행에 대한 위약금이나 손해배상액을 미리 정하는 것은 금지됩니다.', law: '근로기준법 제20조' });
  const checks = [
    [/휴게/, '휴게시간'], [/휴일|주휴/, '휴일'], [/업무|담당/, '업무 내용'], [/근무장소|근무 장소|사업장/, '근무 장소'],
    [/임금.*(지급일|매월|말일|일)/, '임금 지급일'], [/연차/, '연차휴가'], [/4대\s?보험|고용보험|산재/, '사회보험 적용'],
  ];
  for (const [re, name] of checks) if (!re.test(t)) missing.push(name);
  const summary = `계약서에서 문제 소지가 있는 조항 ${clauses.length}건과 누락 가능 항목 ${missing.length}건을 찾았습니다. (규칙 기반 점검 결과)`;
  return { summary, clauses, missing, demo: true };
}

function fallbackDraft(f) {
  const won = (n) => (n ? Number(n).toLocaleString('ko-KR') + '원' : '-');
  const issues = (f.issues || []).filter((x) => !/^주휴수당 미지급/.test(x));
  const notes = (f.userNotes || []).map((x) => String(x).trim()).filter(Boolean);
  return {
    demo: true,
    text:
`저는 ${f.workedPeriod || '일정 기간'} 동안 주 ${f.weeklyHours || '-'}시간, 시급 ${won(f.hourly)}으로 근무하였으나, 근로기준법상 법정 수당을 지급받지 못하여 진정을 제기합니다.

피진정인은 근로기준법 제55조에 따라 주 15시간 이상 근로한 저에게 유급 주휴수당(주당 ${won(f.weeklyHolidayPay)})을 지급하여야 함에도 이를 지급하지 아니하였습니다.${issues.length ? '\n\n그 밖에 다음 사항도 확인됩니다.\n' + issues.map((x, i) => `${i + 1}. ${x}`).join('\n') : ''}${notes.length ? '\n\n제가 겪은 사정은 다음과 같습니다.\n' + notes.map((x, i) => `${i + 1}. ${x}`).join('\n') : ''}

이에 따라 미지급된 임금은 총 ${won(f.totalUnpaid)}입니다.

위 사실을 조사하여 미지급 임금이 지급되도록 조치해 주시기 바랍니다.`,
  };
}
// ---------- 라우팅 ----------
async function readBody(req, max = 2e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
  });
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

// ---------- 계약서 분석 참고 자료 (knowledge/*.md) ----------
const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const KNOWLEDGE_MAX = 12000;
function loadKnowledge() {
  try {
    let out = '';
    for (const f of fs.readdirSync(KNOWLEDGE_DIR).filter((n) => /\.md$/i.test(n) && !/^readme\.md$/i.test(n)).sort()) {
      if (out.length >= KNOWLEDGE_MAX) break;
      const body = fs.readFileSync(path.join(KNOWLEDGE_DIR, f), 'utf8').trim();
      out += `\n\n### ${f}\n${body}`;
    }
    return out.slice(0, KNOWLEDGE_MAX);
  } catch (e) { return ''; }
}
// ---------- 간이 RAG: knowledge/*.md 를 "## 제목 [키워드: …]" 단위로 쪼개 검색 ----------
// 벡터 DB 없이 글자 2-gram 겹침으로 점수를 매깁니다(키워드 줄은 가중치 2배). 검색 결과만 AI 프롬프트에 넣습니다.
function loadChunks() {
  const out = [];
  try {
    for (const f of fs.readdirSync(KNOWLEDGE_DIR).filter((n) => /\.md$/i.test(n) && !/^readme\.md$/i.test(n)).sort()) {
      const body = fs.readFileSync(path.join(KNOWLEDGE_DIR, f), 'utf8');
      for (const part of body.split(/^## /m).slice(1)) {
        const [title, ...rest] = part.split('\n');
        const text = rest.join('\n').trim();
        const kw = (text.match(/^\[키워드:([^\]]*)\]/) || [])[1] || '';
        out.push({ title: title.trim(), text: text.replace(/^\[키워드:[^\]]*\]\s*/, ''), kw, source: f });
      }
    }
  } catch (e) { /* 폴더 없음 */ }
  return out;
}
const grams = (s) => { const t = String(s).replace(/[^가-힣0-9a-zA-Z]/g, ''); const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
function scoreChunk(qg, c) {
  const kg = grams(c.kw), bg = grams(c.title + c.text);
  let s = 0;
  for (const g of qg) { if (kg.has(g)) s += 2; else if (bg.has(g)) s += 1; }
  return s / Math.sqrt(kg.size + bg.size + 1);
}
// 질의(계약서 전체 또는 조항 하나)에 가장 가까운 조문 k개
function retrieve(query, k = 8, min = 0.2) {
  const qg = grams(query);
  return loadChunks().map((c) => ({ c, s: scoreChunk(qg, c) })).filter((x) => x.s >= min).sort((a, b) => b.s - a.s).slice(0, k);
}
// 각 조항에 가장 알맞은 근거 조문을 붙이고, 근거가 약하면 "근거 부족"으로 표시
function attachEvidence(result, hits) {
  for (const cl of result.clauses || []) {
    const q = [cl.title, cl.issue, cl.quote, cl.law].filter(Boolean).join(' ');
    const qg = grams(q);
    const best = hits.map((h) => ({ h, s: scoreChunk(qg, h.c) })).sort((a, b) => b.s - a.s)[0];
    // 조항이 인용한 조문(예: 근로기준법 제20조)과 같은 조문 원문이 지식에 있으면 그것을 근거로 보여 줌 (엉뚱한 조문이 붙지 않게)
    const lawKey = String(cl.law || '').replace(/\s/g, '').match(/^(.+?제\d+조(?:의\d+)?)/)?.[1];
    const exact = lawKey && loadChunks().find((c) => c.title.replace(/\s/g, '').startsWith(lawKey));
    if (exact) { cl.evidence = { title: exact.title, text: exact.text.slice(0, 220) }; continue; }
    if (lawKey && best && !best.h.c.title.replace(/\s/g, '').startsWith(lawKey)) { cl.evidence = null; continue; } // 인용 조문과 다른 조문이면 붙이지 않음
    if (best && best.s >= 0.5) cl.evidence = { title: best.h.c.title, text: best.h.c.text.slice(0, 220) };
    else { cl.evidence = null; if (cl.severity === 'high') cl.severity = 'medium'; } // 근거 자료에 없으면 단정하지 않음
  }
  result.rag = { used: true, sources: hits.map((h) => h.c.title) };
  return result;
}
// ---------- 법제처 조문 원문 조회 (k-skill-proxy) ----------
// 프록시에는 "법령 이름 + 조 번호"만 보냅니다. 계약서 내용·개인정보는 보내지 않습니다.
const LAW_BASE = (process.env.KSKILL_PROXY_BASE_URL || 'https://k-skill-proxy.nomadamas.org').replace(/\/$/, '') + '/v1/korean-law';
const lawCache = new Map(); // "법령명|JO" -> {name, article, title, text} | null
const lawMstCache = new Map(); // 법령명 -> MST

async function lawGet(pathAndQuery, ms = 4000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(LAW_BASE + pathAndQuery, { signal: ctl.signal });
    if (!r.ok) throw new Error('law proxy ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
function parseLawRef(str) {
  const m = String(str || '').match(/([가-힣·]{2,15}(?:\s?시행령)?)\s*제\s*(\d{1,4})\s*조(?:\s*의\s*(\d{1,2}))?/);
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ').trim();
  if (!/(법|령|규칙)( 시행령)?$/.test(name) && !/법 시행령$/.test(name)) return null;
  const jo = String(m[2]).padStart(4, '0') + String(m[3] || 0).padStart(2, '0');
  return { name, num: m[2] + (m[3] ? '의' + m[3] : ''), jo };
}
const toArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const flat = (x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? Object.values(x).map(flat).join(' ') : '');
async function lookupLaw(ref) {
  const key = ref.name + '|' + ref.jo;
  if (lawCache.has(key)) return lawCache.get(key);
  let result = null;
  try {
    let mst = lawMstCache.get(ref.name);
    if (!mst) {
      const s = await lawGet('/search?target=law&query=' + encodeURIComponent(ref.name));
      const list = toArr(s?.LawSearch?.law);
      const hit = list.find((x) => x['법령명한글'] === ref.name && x['현행연혁코드'] === '현행') || list.find((x) => x['법령명한글'] === ref.name);
      mst = hit && hit['법령일련번호'];
      if (mst) lawMstCache.set(ref.name, mst);
    }
    if (mst) {
      const dtl = await lawGet(`/detail?target=law&MST=${encodeURIComponent(mst)}&JO=${ref.jo}`, 6000);
      const unit = toArr(dtl?.법령?.조문?.조문단위)[0];
      if (unit) {
        const head = typeof unit['조문내용'] === 'string' ? unit['조문내용'] : '';
        const paras = toArr(unit['항']).map((h) => flat(h['항내용'] ?? h)).filter(Boolean);
        let text = [head, ...paras].join('\n').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').trim();
        if (text.length > 700) text = text.slice(0, 700).trimEnd() + ' …';
        if (text) result = { name: ref.name, article: '제' + ref.num + '조', title: unit['조문제목'] || '', text };
      }
    }
  } catch (e) { console.error('[law]', ref.name, ref.jo, e.message); }
  if (result) lawCache.set(key, result); // 실패는 저장하지 않아 다음에 다시 시도
  return result;
}
// 분석 결과의 각 조항에 조문 원문(lawText) 붙이기. 실패해도 분석 결과는 그대로 반환.
async function attachLawText(result) {
  try {
    const tasks = (result.clauses || []).map(async (c) => {
      const ref = parseLawRef(c.law);
      if (!ref) return;
      const found = await Promise.race([lookupLaw(ref), new Promise((r) => setTimeout(() => r(null), 9000))]);
      if (found) c.lawText = found;
    });
    await Promise.allSettled(tasks);
  } catch (e) { /* ignore */ }
  return result;
}
// ---------- 규칙 점검 (AI 점검 뒤에 보태는 안전망) ----------
// 계약서에 적힌 문구와 숫자만으로 판별되는 신호를 규칙으로 잡습니다. AI가 이미 같은 주제를 짚었으면 중복해서 넣지 않아요.
// 숫자는 계약서에서 읽은 값과 2026년 최저임금(10,320원)만 씁니다. 조문 풀이는 knowledge의 법제처 원문에 있는 내용만 써요.
function ruleFlags(text, existing) {
  const t = String(text).replace(/\r/g, '');
  const have = (words) => existing.some((c) => words.some((w) => `${c.title} ${c.issue}`.includes(w))); // 제목·설명에 있을 때만 "이미 짚었다"고 봄(인용문에 단어가 스쳐도 중복으로 보지 않음)
  const out = [];
  const lineOf = (re) => (t.split('\n').find((l) => re.test(l)) || '').trim();
  const dailyHours = (() => { const m = t.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/); if (!m) return null; let h = (+m[3] * 60 + +m[4] - (+m[1] * 60 + +m[2])) / 60; if (h <= 0) h += 24; return h; })();
  const wage = (() => { const m = t.match(/시급[^0-9]{0,6}([0-9,]{4,7})\s*원/); return m ? +m[1].replace(/,/g, '') : 0; })();
  // 휴게시간 없음 (제54조): 하루 4시간 이상 일하면 30분 이상 줘야 함
  if (/휴게(\s*시간)?\s*(은\s*)?(없음|없이|없다|미부여|제공하지)/.test(t) && !have(['휴게'])) {
    out.push({ title: '휴게시간 없음', quote: lineOf(/휴게/), severity: dailyHours && dailyHours >= 4 ? 'high' : 'medium', issue: `근무가 하루 ${dailyHours ? dailyHours + '시간' : '4시간 이상'}이면 휴게시간을 줘야 하는데 “휴게시간 없음”으로 정해져 있어요. 4시간이면 30분, 8시간이면 1시간 이상이에요.`, law: '근로기준법 제54조', rule: true });
  }
  // 수습 감액 후 시급이 최저임금 미만 (최저임금법 제6조)
  const sp = t.match(/수습[^\n.]{0,30}?(\d{2,3})\s*%/);
  if (sp && wage && !have(['수습', '감액'])) {
    const cut = Math.round(wage * (+sp[1] / 100));
    if (cut < 10320) out.push({ title: '수습 기간 감액으로 최저임금 미달', quote: lineOf(/수습/), severity: 'high', issue: `수습 기간 시급을 ${sp[1]}%로 줄이면 ${cut.toLocaleString()}원인데, 이는 2026년 최저임금 10,320원보다 낮아요. 최저임금에 미달하는 부분은 무효예요.`, law: '최저임금법 제6조', rule: true });
  }
  // 지각 시 정액 공제 (제43조: 법령·단체협약에 따른 경우가 아니면 임금 일부 공제 불가)
  if (/지각[^\n.]{0,25}(건당|회당|1회당|한\s*번당)?[^\n.]{0,12}[0-9,]+\s*(만\s*)?원[^\n.]{0,12}(공제|차감|감액)/.test(t) && !have(['지각'])) {
    out.push({ title: '지각 시 일정 금액 공제', quote: lineOf(/지각/), severity: 'medium', issue: '지각했다고 정해진 금액을 급여에서 빼는 약정은 임금의 일부를 공제하는 것이라 문제가 될 수 있어요. 일한 시간만큼의 임금은 전액 줘야 해요.', law: '근로기준법 제43조', rule: true });
  }
  // 18세 미만의 밤 10시~아침 6시 근로 (제70조)
  if (/만\s*1[0-7]\s*세|연소|미성년|고등학교\s*재학|청소년/.test(t)) {
    const m = t.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/);
    if (m && !have(['야간', '밤'])) {
      const end = +m[3] + +m[4] / 60, start = +m[1] + +m[2] / 60;
      if (end > 22 || end <= 6 && end > 0 && start > end || start < 6) out.push({ title: '18세 미만 근로자의 야간근로', quote: lineOf(/\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2}/), severity: 'high', issue: '18세 미만은 오후 10시부터 오전 6시까지 일하게 할 수 없어요(고용노동부장관 인가를 받은 경우 등 예외). 계약서의 근무 시간이 이 시간대에 걸쳐 있어요.', law: '근로기준법 제70조', rule: true });
    }
  }
  // 프리랜서·위탁·도급 계약인데 출근 시간·업무 지시가 정해져 있으면 근로자인지 따져 볼 신호 (제2조)
  if (/프리랜서|업무\s*위탁|위탁\s*계약|도급|3\.3\s*%/.test(t) && /(출근|지시|지정|지각|\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2})/.test(t) && !have(['근로자성', '프리랜서', '근로자로'])) {
    out.push({ title: '프리랜서 계약이지만 근로자로 볼 신호', quote: lineOf(/출근|지시|지정|지각|\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2}/), severity: 'medium', issue: '근로자는 “임금을 목적으로 사업장에 근로를 제공하는 사람”이에요. 계약서 이름이 프리랜서여도 출근 시간이 정해져 있고 업무 지시를 받는다면 근로자에 해당하는지 따져 봐야 해요.', law: '근로기준법 제2조', rule: true });
  }
  return out;
}
const SYS_ANALYZE =`당신은 한국 근로기준법에 밝은 노동법 안내 도우미입니다. 법률 자문이 아니라 참고용 정보를 제공합니다.
사용자가 준 근로계약서 텍스트(개인정보는 [이름], [연락처] 같은 표식으로 마스킹됨)를 점검하세요.
2026년 최저임금은 시급 10,320원입니다. 근로기준법상 주휴수당(제55조), 가산수당(제56조, 5인 미만 사업장 미적용), 위약금 예정 금지(제20조), 근로조건 명시(제17조) 등을 기준으로 하세요.
반드시 아래 JSON만 출력하세요:
{"summary":"한두 문장 요약","clauses":[{"title":"","quote":"계약서 원문 인용","severity":"high|medium|low","issue":"무엇이 왜 문제인지 쉬운 말로","law":"관련 조문"}],"missing":["누락된 필수 항목"]}
확실하지 않은 것은 단정하지 말고 severity를 낮추세요.\n[이름], [주소], [연락처], [주민등록번호]는 개인정보 마스킹 표식이므로 해당 항목이 없다고 판단하거나 누락 항목(missing)에 넣지 마세요.`;

const SYS_MAIL = `당신은 근로자가 노무사에게 보내는 상담 요청 메일의 "사건 요약" 부분만 작성하는 도우미입니다.
입력 JSON(facts=계산 결과, consultNotes=근로자가 AI 상담에서 말한 내용, contractIssues=계약서 점검 결과, missingItems=계약서 누락 항목)을 바탕으로 한국어 불릿(- 로 시작) 4~8줄로 정리하세요.
규칙: 입력에 있는 사실만 쓰고 추측·과장 금지. 금액은 입력값만 사용. 이름·주민번호·연락처 등 개인정보는 쓰지 말 것. 법적 결론을 단정하지 말고 "~로 보입니다", "확인이 필요합니다"처럼 쓸 것. 노무사가 근로자에게 같은 질문을 다시 하지 않도록 사업주에게 요구한 경위·보유 증거·원하는 결과가 있으면 반드시 포함. 인사말·맺음말 없이 불릿만 출력.`;
// 계산·계약서 점검·상담 메모를 불릿으로 정리 (AI 실패 시에도 동일한 형식으로 대체)
function summaryFallbackBullets(facts, clauses, notes) {
  const L = [];
  const f = facts || {};
  if (f.totalUnpaid > 0) L.push(`- 미지급 추정액 약 ${Number(f.totalUnpaid).toLocaleString()}원 (시급 ${Number(f.hourly || 0).toLocaleString()}원, 주 ${f.weeklyHours ?? '?'}시간${f.workedPeriod ? ', ' + f.workedPeriod + ' 근무' : ''})`);
  if (f.under5) L.push('- 상시 5인 미만 사업장');
  for (const c of clauses) L.push(`- ${c.title}: ${c.issue}`);
  for (const n of notes) L.push(`- ${n}`);
  return L.length ? L.join('\n') : '- 별첨 자료를 참고해 주세요.';
}
// 상담 시간이 짧은 노무사 대면 상담 전에 미리 들고 갈 "1장 리포트"용 질문 보조 문구
function reportQuestionsFallback(facts, clauses) {
  const q = [];
  const f = facts || {};
  if (f.totalUnpaid > 0) q.push('제가 계산한 미지급 금액이 맞는지 함께 확인해 주실 수 있나요?');
  if (clauses.length) q.push('계약서에서 발견된 문제들이 실제로 위법인지, 어떻게 대응해야 하는지 알려 주세요.');
  q.push('지금 바로 진정서를 접수해도 될까요, 보완할 부분이 있을까요?');
  q.push('사장님께는 어떻게 이야기를 꺼내는 게 안전할까요?');
  q.push('진정 외에 제가 고려할 수 있는 다른 방법도 있을까요?');
  return q.slice(0, 5);
}
const SYS_REPORT = `당신은 노동 상담을 앞둔 청년 근로자를 돕는 도우미입니다. 노무사를 짧은 시간 동안 만나기 때문에, 미리 준비할 "상황 요약"과 "상담에서 꼭 물어볼 질문"을 만듭니다.
입력 JSON(facts=계산 결과, consultNotes=근로자가 AI 상담에서 말한 내용, contractIssues=계약서 점검 결과, missingItems=계약서 누락 항목)을 바탕으로 아래 JSON 형식으로만 답하세요.
{"summary": "한국어 불릿(- 로 시작) 4~6줄 문자열", "questions": ["상담에서 바로 물어볼 수 있는 구체적인 질문 3~5개"]}
규칙: 입력에 있는 사실만 쓰고 추측·과장 금지. 금액은 입력값만 사용. 이름·주민번호·연락처 등 개인정보는 쓰지 말 것. 법적 결론을 단정하지 말 것. 질문은 짧고 구체적으로, 청소년도 그 자리에서 바로 물어볼 수 있는 수준으로 쓸 것.`;
const SYS_DRAFT = `당신은 노동청 진정서 작성을 돕는 도우미입니다. 고용노동부 진정서 양식의 "내용" 란에 들어갈 본문만 한국어로 작성하세요.
(성명·주소·입퇴사일·체불금액 표 항목은 양식의 다른 칸에 따로 적히므로 본문에 인적사항 표를 만들지 마세요.)
- 주어진 사실관계(JSON)만 사용하고 없는 사실은 지어내지 마세요. 마크다운 기호 없이 일반 텍스트로 쓰세요.
- 사실관계에 "계약한 시급을 받지 못했다"는 내용이 없으면 "계약 조건을 이행하지 않았다", "약속한 임금을 주지 않았다"고 쓰지 마세요. 시급이 최저임금에 미달하면 "계약서에 정해진 시급 자체가 최저임금보다 낮다"로, 주휴수당은 "주휴수당이 지급되지 않았다"로 구체적으로 쓰세요.
- 구성: 진정 취지 → 근로 사실(근로시간·시급·기간) → 위반 사실 → 미지급 금액 → 요청 사항. 번호 제목 없이 자연스러운 문단 4~5개로, 문단 사이는 빈 줄로 구분하세요.
- 같은 금액이나 문장을 반복하지 마세요. 미지급 금액은 한 번만 쓰고, unpaidBreakdown 항목이 하나뿐이면 "항목별 내역"을 따로 나열하지 마세요.
- weeklyHolidayPay는 "주당 주휴수당"이며 주급(전체 임금)이 아닙니다. totalUnpaid는 미지급 임금 합계입니다.
- 첫 문장에 조문을 인용하지 마세요. 조문은 해당하는 것만 쓰되 주휴수당은 근로기준법 제55조, 위약금 예정 금지는 제20조, 임금 미지급은 제43조만 사용하세요. issues에 없는 위반은 쓰지 마세요.
- 어조는 진정인의 1인칭("저는")으로 정중하게 쓰고, 마지막 문단은 "위 사실을 조사하여 미지급 임금이 지급되도록 조치해 주시기 바랍니다"와 같은 요청으로 끝내세요.
- userNotes는 진정인이 직접 말한 사정(경위, 사업주 반응, 증거, 원하는 결과)입니다. 있으면 "근로 사실"과 "위반 사실" 문단에 자연스럽게 녹이고, 표현은 다듬되 내용을 부풀리거나 없는 사실을 덧붙이지 마세요. 증거가 언급되면 "제출할 증거"로 한 문장 언급하세요. userNotes가 비어 있으면 무시하세요.
- 개인정보 마스킹 표식([이름], [주소], [연락처] 등)이 보이면 "피진정인", "사업주" 같은 일반 표현으로 바꾸세요.
- 진정인이 "사장님", "알바생" 같은 구어체로 말했더라도 문서에서는 "피진정인(사업주)", "저"처럼 공문서에 맞는 표현으로 바꿔 쓰세요.`;
// ---------- 홈 "무슨 문제인지 잘 모르겠어요" 상황 정리 상담 ----------
const TRIAGE_KEYS = ['calc', 'contract', 'complaint', 'lawyer'];
const SYS_JUDGE = `당신은 HoLab의 판단 도우미입니다. 아래 JSON은 사용자가 입력한 근무 조건으로 HoLab이 규칙에 따라 이미 계산한 결과(숫자)입니다. 이 숫자만 근거로 판단하세요.
필드 뜻: 계약시급 / 법정최저시급 / 주당_소정근로시간 / 일한기간_개월 / 개근못한_주수(일하기로 한 날을 하루라도 빠진 주, 주휴수당 계산에서 뺀 주) / 받아야할_급여_전체기간(법 기준으로 받아야 하는 총액) / 그중_못받은_돈_합계(실제 미지급 추정액. "미지급 금액"이라고 부를 때는 반드시 이 값) / 못받은_주휴수당 / 못받은_가산수당 / 최저임금_차액 / 5인미만_사업장. 주휴수당을 "휴일 수당"이라 부르지 마세요. 받아야할_급여_전체기간을 미지급액으로 착각하지 마세요.
규칙:
- 주어진 숫자 외의 새 숫자, 법 조항 번호, 판례를 지어내지 마세요. 금액은 원 단위로 쉽게 풀어 쓰세요.
- 법률 결론을 확정하지 말고 "~일 수 있어요", "~로 보여요"처럼 쓰세요. 법률 자문이 아닙니다.
- 청소년·사회초년생이 이해할 쉬운 말로 쓰세요.
출력(JSON만):
{"summary":"계산 결과를 종합한 판단 2문장 이내(어떤 문제가 가장 커 보이는지)","recommend":{"key":"contract|complaint|lawyer","reason":"왜 지금 이것을 권하는지 2문장 이내"}}
key 기준: 이 판단은 급여 계산 직후라 계약서는 아직 점검되지 않은 상태입니다. 따라서 key는 항상 "contract"로 하고, reason에는 위 숫자에서 드러난 문제(예: 시급이 최저임금보다 낮음, 주휴수당 미지급)와 연결해서 계약서의 어떤 조항(시급, 주휴수당 포함 문구, 수습·공제, 근로시간)을 확인하면 도움이 되는지 설명하세요. 개근못한_주수는 "N주"라고만 쓰고 몇 번째 주인지는 말하지 마세요. 어색한 조사 중복(예: "미지급이에요" 앞에 "이")을 피하고 자연스러운 문장으로 쓰세요. "이예요" 대신 "이에요/예요"를 바르게 쓰세요.`;
const SYS_JUDGE_CONTRACT = `당신은 HoLab의 판단 도우미입니다. 아래 JSON은 사용자의 근로계약서 점검 결과와, 계약서 금액·실제 받은 금액·법적으로 받아야 할 금액을 HoLab이 이미 계산한 값입니다. 이 정보만 근거로 판단하세요.
필드 뜻: 계약서_시급 / 법정최저시급 / 계약서_기준_월금액(계약서대로 받으면 되는 한 달 금액) / 실제_받은_월금액(0이면 사용자가 입력하지 않은 것) / 법적으로_받아야할_월금액 / 부족액_계약서기준(계약서 기준에서 실제를 뺀 값, 양수면 계약서보다 적게 받은 것) / 부족액_법적기준(법적 기준에서 실제를 뺀 값) / 위험·주의·참고_조항수 / 위험조항_제목들 / 누락항목들.
규칙:
- 주어진 숫자 외의 새 숫자, 법 조항 번호, 판례를 지어내지 마세요. 법률 결론을 확정하지 말고 "~일 수 있어요", "~로 보여요"처럼 쓰세요. 법률 자문이 아닙니다.
- 청소년·사회초년생이 이해할 쉬운 말, 자연스러운 문장으로 쓰세요.
- 실제_받은_월금액이 0보다 크면 summary에 "계약서 금액과 실제 받은 금액이 다른지"와 "법적 기준에는 맞는지"를 주어진 부족액 숫자로 반드시 설명하세요. 0이면 비교 이야기는 하지 말고 조항 점검 결과만 요약하세요.
출력(JSON만): {"summary":"종합 판단 2~3문장","recommend":{"key":"complaint|lawyer","reason":"왜 그것을 권하는지 2문장 이내"}}
key 기준: 위험 조항이 있거나 법적 기준보다 적게 받았다면 complaint(진정서 작성), 판단이 복잡하거나 조항이 많고 전문가 확인이 필요해 보이면 lawyer(무료 노무사·상담기관). 문제가 거의 없으면 lawyer로 확인을 권하세요.`;
// 사건 유형(화면에 칩으로 보여 줌)과 HoLab 기능 4가지
const CASE_TYPES = { wage: '임금체불·수당', dismissal: '해고', harassment: '괴롭힘·성희롱', discrimination: '차별', injury: '산재', minor: '연소근로(18세 미만)', severance: '퇴직금·연차', misclassified: '근로자성(프리랜서)', forced: '강제근로·신분증 보관', contract: '계약서 문제', other: '기타' };
const FEATURE_KEYS = ['calc', 'contract', 'complaint', 'lawyer'];
const SYS_EXPLAIN_LEGAL = `당신은 HoLab의 법 조문 설명 도우미입니다. [조문] 각각을 청소년·외국인 노동자도 이해할 쉬운 말로 풀고, 사용자가 말한 사실과 연결합니다. 법률 자문이 아니며, 사용자가 직접 증거를 보여 준 것이 아니라 "말한 내용"만 있으므로 위반을 단정하지 않습니다.
규칙:
- 법 조문의 "사용자"는 고용주(사장님)를 뜻합니다. 쉬운 말로 쓸 때는 "사장님(사용자)"처럼 쓰고, 말하는 사람을 "사용자"라고 부르지 마세요(혼동 방지).
- plain: 조문에 적힌 내용만 1~2문장으로 쉽게 풀어 쓰세요. 조문에 없는 내용·숫자는 쓰지 마세요.
- situation: 사용자가 말한 사실과 이 조문을 연결하는 1문장. 반드시 "~에 해당할 수 있어요" 또는 "~일 수 있어요"로 끝내세요. "위반했어요", "불법이에요" 같은 단정은 금지.
- checks: 이 조문에 해당하는지 가리려면 먼저 확인할 사실이나 모아 둘 자료 2~3개(예: "같은 일을 하는 다른 직원의 시급 자료"). 짧은 명사구로.
- applies: 사용자가 말한 사실에 이 조문이 실제로 적용될 가능성이 있으면 true, 아니면 false. (예: 지금 일하고 있다면 "퇴직 후 14일 이내 지급" 조문은 false, 외국인이라는 말이 없으면 외국인 차별 조문은 false, 해고 이야기가 없으면 해고 조문은 false)
출력(JSON만): {"items":[{"title":"[조문]의 제목을 그대로","applies":true,"plain":"","situation":"","checks":[""]}]}`;

const SYS_JUDGE_COMPLAINT = `당신은 HoLab의 판단 도우미입니다. 아래 JSON은 사용자가 진정서를 작성한 뒤 "제출 전 점검" 상태를 HoLab이 이미 정리한 값입니다. 이 정보만 근거로 판단하세요.
필드 뜻: 못받은돈_합계(1단계 미지급 추정액, 0이면 금액 계산 없음) / 비어있는_항목들(아직 채우지 않은 진정서 항목) / 갖고있는_증빙수 / 전체_필요_증빙수 / 부족한_증빙수(0이면 필요한 증빙을 모두 갖춘 것이니 부족하다고 쓰지 마세요) / 추천(fix 또는 lawyer — HoLab이 이미 정한 값이니 바꾸지 말고 그 이유만 설명하세요) / 위반_조항수(계약서 등 확실한 자료가 근거) / 해당될수있는_조항수(말한 내용만 근거) / 자동작성_항목수(앞 단계 내용으로 자동 입력된 칸) / 초안_작성됨 / 관련_법_조항들.
규칙:
- 주어진 숫자 외의 새 숫자·조문 번호·판례를 지어내지 마세요. 법률 결론을 확정하지 말고 "~로 보여요", "~일 수 있어요"처럼 쓰세요. 법률 자문이 아닙니다.
- 추천이 fix이면 "이 단계에서 먼저 보완", lawyer이면 "PDF를 저장하고 상담 센터 찾기"를 권하는 이유를 쓰세요. 상담 상대는 "변호사"가 아니라 "상담 센터의 공인노무사"라고 쓰세요. 추천과 어긋나는 말을 쓰지 마세요. 해당될수있는_조항수를 구분해서 말하세요(확실한 자료가 있는 것과 아직 확인이 필요한 것).
출력(JSON만): {"summary":"제출 전 점검 결과 2~3문장","recommend":{"key":"fix|lawyer","reason":"왜 그것을 권하는지 2문장 이내"}}
출력의 key는 반드시 입력의 추천 값과 같아야 합니다.`;
// 사건 유형별로 사용자가 바로 눌러 답할 수 있는 1인칭 문장 (AI가 요청문을 주거나 비웠을 때 대신 사용)
const FOLLOWUP = {
  wage: ['월급날이 지났는데 아직 못 받았어요', '사장님께 말했는데 곧 준다고만 해요', '근로계약서가 있어요'],
  dismissal: ['오늘 갑자기 나오지 말라고 했어요', '해고 이유를 말해 주지 않았어요', '문자나 카톡으로 통보받았어요'],
  harassment: ['여러 사람 앞에서 자주 그래요', '증거(문자·녹음·목격자)가 있어요', '회사에 신고한 적은 없어요'],
  discrimination: ['같은 일을 하는 다른 직원은 시급이 더 높아요', '외국인이라서 그렇다고 직접 말했어요', '아직 증거는 없어요'],
  injury: ['일하다가 다쳐서 병원에 다녀왔어요', '사장님이 산재 처리를 거부했어요', '진단서가 있어요'],
  minor: ['저는 18세 미만이에요', '밤 10시 이후에도 일해요', '부모님 동의서는 쓴 적 없어요'],
  severance: ['1년 넘게 일하고 그만뒀어요', '퇴직금 이야기를 하면 피해요', '아직 재직 중이에요'],
  misclassified: ['출퇴근 시간이 정해져 있어요', '사장님 지시대로만 일해요', '3.3%를 떼고 받아요'],
  forced: ['여권을 사장님이 보관해요', '그만두겠다고 하면 못 나가게 해요', '숙소비를 공제당해요'],
  contract: ['계약서에 위약금 조항이 있어요', '계약서를 받지 못했어요', '수습 기간 급여가 달라요'],
  other: ['월급이 생각보다 적게 들어왔어요', '계약서가 이상한 것 같아요', '갑자기 그만두라는 말을 들었어요'],
};
// 정보가 적어 AI가 기능 추천을 비웠을 때의 기본 추천 (화면에 "잠정"으로 표시)
const DEFAULT_RANK = { wage: ['calc', 'complaint'], dismissal: ['lawyer'], harassment: ['lawyer'], discrimination: ['lawyer'], injury: ['lawyer'], minor: ['lawyer', 'contract'], severance: ['complaint', 'lawyer'], misclassified: ['contract', 'lawyer'], forced: ['lawyer'], contract: ['contract'] };
// 검색어 보강: 사용자의 일상적인 말("욕을 해요", "나오지 말래요")을 조문에 쓰이는 말로 풀어 검색에 함께 넣음 (규칙 기반, AI 호출 없음)
const QUERY_HINTS = [
  [/(외국인|베트남|필리핀|이주|국적|비자|외노자)/, '외국인 외국인근로자 이주노동자 국적 차별 균등한 처우 차별적 처우 여권 외국인등록증 보관'],
  [/(욕|욕설|폭언|따돌|괴롭|무시|놀림|모욕)/, '직장 내 괴롭힘 폭언 신체적 정신적 고통 괴롭힘 조치 신고'],
  [/(성희롱|성적|만지|몸을)/, '직장 내 성희롱 성적 언동 조치 신고'],
  [/(해고|잘렸|나오지 ?말|그만두라|짤렸)/, '해고 부당해고 해고예고 서면통지 구제신청 노동위원회'],
  [/(다쳤|산재|부상|병원|치료)/, '산재 업무상 재해 요양급여 근로복지공단 산재보험'],
  [/(퇴직금|연차)/, '퇴직금 퇴직급여 연차 유급휴가 금품 청산'],
  [/(체불|안 ?줘|못 ?받|안 ?들어|밀렸|안 ?줬)/, '임금 지급 체불 금품 청산 노동청 신고'],
  [/(주휴)/, '주휴수당 유급휴일 개근'],
  [/(최저임금|시급)/, '최저임금 시급 최저임금의 효력'],
  [/(17살|18세|미성년|청소년|부모님 동의)/, '연소근로자 18세 미만 야간근로 동의 인가 친권자'],
  [/(3\.3|프리랜서|사업소득|도급)/, '근로자 정의 프리랜서 3.3% 근로자성 지휘 감독'],
  [/(계약서|위약금|물어내)/, '근로계약 위약 예정 금지 근로조건 명시'],
];
const expandQuery = (text) => text + ' ' + QUERY_HINTS.filter(([re]) => re.test(text)).map(([, kw]) => kw).join(' ');
// AI가 사건 유형을 정했는데 근거 조문을 못 골랐을 때, 그 유형의 대표 조문을 검색해 "잠정"으로 보여 줌
const CASE_QUERY = { discrimination: '외국인 국적 차별 균등한 처우 차별적 처우', harassment: '직장 내 괴롭힘 금지 조치 신고', dismissal: '해고 부당해고 서면통지 구제신청', injury: '산재 업무상 재해 근로복지공단', minor: '연소근로자 18세 미만 야간근로', severance: '퇴직금 연차 금품 청산', misclassified: '근로자 정의 프리랜서 근로자성', forced: '강제 근로 여권 외국인등록증 보관 금지', wage: '임금 지급 체불 금품 청산', contract: '근로계약 위약 예정 금지' };
const SYS_CALL_SCRIPT = `당신은 HoLab의 통화 도우미입니다. 사용자가 노동상담 센터에 전화를 걸어 상담을 예약할 때 소리 내어 읽을 짧은 대본을 씁니다. 아래 JSON(사건 유형·말한 사실·계산된 금액)만 근거로 하세요.
규칙:
- 이 대본은 전화를 거는 사용자 본인이 센터 직원에게 말하는 1인칭 글입니다("저는 ~했습니다"). 센터 직원이나 제3자처럼 말하지 마세요("센터입니다", "~하셨는데", "~필요하신 것 같습니다" 금지).
- 존댓말, 구어체로 5~7문장. 이름·주소·연락처 같은 개인정보는 말하지 않습니다.
- 구성: 인사 → 상담 예약 용건 → 상황 한두 줄 → 상담 가능한 요일·시간과 예약 필요 여부 문의 → 맡아 줄 공인노무사 유무와 가져갈 서류 문의.
- 주어진 숫자 외의 새 숫자·조문 번호는 쓰지 마세요. 법률 결론을 단정하지 말고("~인 것 같습니다", "~로 알고 있습니다") 사실만 말하세요.
형식 예) "안녕하세요. 노동 상담을 예약하고 싶어서 전화드렸습니다. 저는 [말한_사실을 1인칭으로 한두 문장]. 상담이 가능한 요일과 시간, 예약이 필요한지 알려 주실 수 있을까요? 제 사건을 맡아 주실 공인노무사님이 계신지, 그리고 가져가야 할 서류도 알려 주세요."
출력(JSON만): {"script":"대본 전체"}`;
const SYS_TRIAGE_BASE = `당신은 HoLab의 상황 정리 도우미입니다. 노동법을 잘 모르는 청소년 알바생·사회초년생·외국인 노동자가 겪은 일을 말하면, 문제를 정리하고 "다음에 쓰면 좋은 HoLab 기능"을 순위로 추천합니다. 법률 결론을 확정하거나 법률 자문을 하지 않습니다.
사용자 말의 개인정보는 [이름] 같은 표식으로 가려져 있을 수 있습니다.

지침:
- 친근한 존댓말, 짧게. 한 번에 질문은 1개만 합니다. 어려운 법률 용어는 쉬운 말로 풀어 쓰세요. 사용자가 다른 언어로 쓰면 그 언어로 답하세요.
- facts: 사용자가 실제로 말한 사실만 한 줄씩 누적 정리 (추측·없는 사실·금액 계산 금지).
- issues: 지금까지 말한 내용으로 "확인해 볼 만한 문제 유형"을 쉬운 말로 최대 3개. "~일 수 있어요/~가능성"처럼 단정하지 마세요.
- caseType: wage(임금체불·수당) / dismissal(해고) / harassment(괴롭힘·성희롱) / discrimination(차별) / injury(산재) / minor(18세 미만 연소근로) / severance(퇴직금·연차) / misclassified(프리랜서·근로자성) / forced(강제근로·여권 등 보관) / contract(계약서 문제) / other 중 가장 가까운 하나.
- ranking: 다음에 쓰면 좋은 HoLab 기능을 추천 순서대로 최대 3개 ({key, reason}). key는 서로 달라야 합니다.
  · calc = 못 받은 돈 확인(월급·주휴수당·수당·최저임금 계산) — 돈 계산이 필요 없는 사건(해고·산재·괴롭힘·차별 등)에는 넣지 마세요.
  · contract = 계약서 분석(계약서 내용이 걱정되거나 계약서가 문제의 원인일 때).
  · complaint = 진정서 작성(임금·수당 미지급처럼 노동청에 신고할 수 있는 근로기준법 위반을 신고하려는 경우). 해고 구제신청이나 산재 신청처럼 진정서가 맞는 절차가 아닌 사건에는 넣지 마세요.
  · lawyer = 상담 센터 찾기(해고·괴롭힘·산재·차별·외국인·연소근로처럼 사건에 맞는 절차를 전문가와 확인해야 할 때).
  reason은 "왜 이 기능이 이 순서인지" 한 문장. 사건 유형(caseType)이 어느 정도 분명하면 첫 답변부터 ranking·citations·procedure를 채우고(질문은 reply에서 이어서 해도 됩니다), 무슨 일인지 전혀 알 수 없을 때만 ranking을 빈 배열로 두고 질문 1개를 하세요.
- procedure: HoLab 기능 밖에서 밟아야 하는 공식 절차(신청 기관, 기한 등)가 있을 때만 1~2문장. 없으면 빈 문자열.
- 사용자가 법 조항·위반 여부·처벌을 직접 물으면 되묻지 말고 먼저 답하세요. 말씀만으로는 위반이라고 확정할 수 없다고 밝히되 해당될 수 있는 조항을 알려 주고, 확인 질문은 마지막에 1개만 하세요.
- 같은 질문을 두 번 하지 마세요. 이미 물어본 내용이면 다른 각도로 묻거나 보기를 주세요.
- facts에는 사용자가 한 말을 한 가지뿐이어도 빠짐없이 적으세요. 정보가 적어도 caseType이 other가 아니면 ranking에 최소 1개를 넣으세요.
- 국적·인종·외국인이라는 이유가 언급되면 caseType은 discrimination을 우선하세요.
- suggestions: 사용자가 직접 보낼 1인칭 문장(예: "같은 일을 하는 다른 직원은 시급이 더 높아요") 최대 3개. "~해 주세요"처럼 사용자에게 요청하는 문장은 금지.

반드시 아래 JSON만 출력하세요:
{"reply":"사용자에게 건네는 말을 자연스러운 문장으로(공감 + 필요하면 확인 질문 1개)","facts":["..."],"issues":["..."],"caseType":"wage","ranking":[{"key":"calc","reason":"..."}],"citations":[],"procedure":"","suggestions":["..."]}`;
const SYS_TRIAGE_RAG = SYS_TRIAGE_BASE + `
- [근거 자료]는 법제처 원문 조문입니다. caseType이 other가 아니면 citations에 실제로 근거로 삼은 자료 번호를 1개 이상 적으세요(예: ["E1","E3"]). procedure는 근거 자료에 적힌 내용(신청 기관·기한 등)만으로 1~2문장 쓰고, 근거 자료에 없는 조문 번호·기간·기관은 절대 쓰지 마세요. 사용자가 말한 사실에 직접 해당하지 않는 조문(예: 재직 중인데 퇴직 후 지급 조문, 외국인이 아닌데 외국인 차별 조문)은 citations에 넣지 마세요. 관련 자료가 정말 없으면 citations와 procedure를 비우세요.
예) 해고 사건에서 [E1]이 구제신청 조문이라면: "citations":["E1"],"procedure":"근거 자료에 따르면 부당해고는 노동위원회에 구제를 신청할 수 있고, 해고가 있었던 날부터 3개월 이내에 해야 해요."`;
const SYS_TRIAGE_PLAIN = SYS_TRIAGE_BASE + `
- caseType이 other가 아니면 citations에 관련 법 조문을 "법령명 제N조" 형식으로 1~3개 적고, procedure에 HoLab 기능 밖에서 밟아야 할 공식 절차(신청 기관·기한)를 1~2문장 쓰세요. 정말 모르면 비우세요.`;const SYS_TRIAGE = SYS_TRIAGE_PLAIN; // 기존 이름 호환
function fallbackTriage(messages) {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content.trim()).filter(Boolean);
  const all = users.join(' ');
  const facts = users.map((u) => u.slice(0, 200));
  let key = null, reason = '', issues = [];
  if (/해고|잘렸|그만두라|괴롭|폭언|폭행|산재|다쳤/.test(all)) { key = 'lawyer'; reason = '해고·괴롭힘·사고는 전문가와 직접 상담하는 게 가장 안전해요.'; issues = ['부당한 대우나 해고 문제일 가능성']; }
  else if (/계약서|계약/.test(all)) { key = 'contract'; reason = '계약서에 확인이 필요한 조항이 있는지 먼저 살펴보면 좋아요.'; issues = ['계약서 조건에 확인이 필요한 부분이 있을 가능성']; }
  else if (/신고|노동청|진정|체불|못 ?받|안 ?줬|안 ?줘|밀렸/.test(all)) { key = 'complaint'; reason = '받지 못한 돈이 있다면 노동청에 진정서를 내는 방법을 도와드릴 수 있어요.'; issues = ['임금을 받지 못했을 가능성']; }
  else if (/월급|급여|시급|주휴|수당|적게|덜|입금/.test(all)) { key = 'calc'; reason = '받은 금액과 법적으로 받아야 할 금액을 먼저 비교해 보면 좋아요.'; issues = ['주휴수당 등 일부 수당을 못 받았을 가능성', '실제 지급액과 비교가 필요해요'];  }
  if (key) return { reply: `말씀해 주셔서 고마워요. 지금 말씀하신 내용으로는 "${key === 'calc' ? '급여 계산' : key === 'contract' ? '계약서 분석' : key === 'complaint' ? '진정서 작성' : '노무사 상담'}"부터 해 보시길 추천드려요.`, facts, issues, recommend: { key, reason }, ranking: [{ key, reason }], caseType: 'other', citations: [], procedure: '', rag: { used: false, sources: [] }, suggestions: [], demo: true };
  return { reply: '말씀해 주셔서 고마워요. 어떤 일이 있었는지 조금만 더 알려 주세요. 예를 들어 월급, 계약서, 사장님의 말이나 행동 중 어느 쪽이 마음에 걸리세요?', facts, issues: [], recommend: { key: null, reason: '' }, suggestions: ['월급이 생각보다 적게 들어왔어요', '계약서가 이상한 것 같아요', '갑자기 그만두라는 말을 들었어요'], demo: true };
}
// ---------- 진정서 "내용" 작성 상담 ----------
const SYS_COMPLAINT_CHAT = `당신은 HoLab!의 진정서 작성 도우미입니다. 청년 노동자(진정인)가 노동청 진정서의 "내용" 란에 넣고 싶은 이야기를 듣고 정리합니다.
이미 확인된 사실(facts: 시급, 근무시간, 근무기간, 미지급 추정액, 문제 항목)은 초안에 자동으로 들어가니 다시 묻지 마세요. 사용자 말의 개인정보는 [이름] 같은 표식으로 가려져 있을 수 있습니다.

지침:
- 친근한 존댓말로 짧게, 한 번에 질문은 1개만 하세요.
- 알아 두면 좋은 것: ① 어떤 일이 있었는지(경위·기간) ② 사업주에게 말하거나 요구한 적이 있는지와 그 반응 ③ 가지고 있는 증거(계약서, 급여 입금 내역, 문자·카톡, 출퇴근 기록 등) ④ 진정으로 원하는 결과.
- notes에는 사용자가 실제로 말한 사실만 한 줄씩 정리해 누적해서 담으세요. 추측·과장·없는 사실 추가 금지, 금액 계산 금지, 법적 결론 단정 금지.
- ready: ①~④ 중 두 가지 이상이 모였거나, 사용자가 "다 됐어요", "그만", "작성해 줘"처럼 마무리 의사를 밝히면 true. true이면 reply에서 "이 내용으로 초안을 만들어 드릴까요?"라고 묻고 추가 질문은 하지 마세요.
- 사용자가 아무것도 넣고 싶지 않다고 하면 ready를 true로 하고 notes는 비워 두세요.

반드시 아래 JSON만 출력하세요:
{"reply":"상담사가 사용자에게 건네는 말(공감 한 문장 + 질문 1개). 사용자의 말을 대신 써 주지 마세요","ready":false,"notes":["사용자가 말한 사실 (누적)"],"suggestions":["사용자가 바로 눌러 보낼 수 있는, 사용자 입장에서 쓴 답변 문장 최대 3개"]}
suggestions는 질문 형태가 아니라 사용자가 하는 말로 쓰세요. (예: "사장님께 말했더니 나중에 주겠다고 했어요")

예시)
사용자: "사장님께 두 번 말했는데 안 줬어요"
→ {"reply":"두 번이나 말씀하셨는데도 지급이 안 되셨군요, 속상하셨겠어요. 가지고 계신 증거가 있나요? (계약서, 급여 입금 내역, 문자·카톡 등)","ready":false,"notes":["사장님께 두 번 요구했으나 지급받지 못함"],"suggestions":["계약서와 급여 입금 내역이 있어요","카톡 대화 내용이 있어요","따로 없어요"]}`;

function fallbackComplaintChat(messages) {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content.trim()).filter(Boolean);
  const last = users[users.length - 1] || '';
  const done = /다 ?됐|그만|없어요|없습니다|작성해|만들어/.test(last);
  const notes = users.filter((u) => !/^(다 ?됐|그만|없어요|없습니다|작성해|만들어)/.test(u)).map((u) => u.slice(0, 200));
  const ready = users.length >= 3 || done;
  let reply, suggestions = [];
  if (ready) reply = '말씀해 주신 내용으로 초안을 만들어 드릴까요?';
  else if (users.length === 1) { reply = '말씀해 주셔서 고마워요. 사장님께 말하거나 요구하신 적이 있나요? 있다면 어떤 반응이었는지 알려 주세요.'; suggestions = ['말했더니 나중에 주겠다고만 했어요', '무서워서 말은 못 했어요']; }
  else { reply = '가지고 계신 증거가 있나요? (계약서, 급여 입금 내역, 문자·카톡 등)'; suggestions = ['계약서와 급여 입금 내역이 있어요', '카톡 대화 내용이 있어요', '따로 없어요']; }
  return { reply, ready, notes, suggestions, demo: true };
}
// ---------- 진정서 테스트 메일 (FormSubmit) ----------
// 받는 주소는 서버(.env의 MAIL_TEST_TO)에만 있고 클라이언트가 바꿀 수 없습니다. 설정이 없으면 기능이 꺼집니다.
const mailTo = () => (process.env.MAIL_TEST_TO || '').trim();
const maskEmail = (a) => { const [u, d] = String(a).split('@'); return (u || '').slice(0, 2) + '***@' + (d || ''); };
let mailWindowStart = Date.now(), mailCount = 0;
const MAIL_LIMIT_PER_HOUR = +process.env.MAIL_LIMIT_PER_HOUR || 6;

async function sendComplaintMail({ lawyer = {}, receipt = '', fields = {}, body = '', pdfBase64 = '', filename = '진정서.pdf', subject = '', mailText = '', to: toReq = '' }) {
  // 사용자가 입력한 받는 주소(노무사 이메일)가 형식에 맞으면 그 주소로, 아니면 서버 기본 주소로 보냄. 주소는 1개만 허용
  const asked = String(toReq || '').trim();
  const to = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']{2,}$/.test(asked) && asked.length <= 120 ? asked : mailTo();
  if (!to) throw new Error('받는 이메일 주소가 올바르지 않습니다.');
  if (Date.now() - mailWindowStart > 3600e3) { mailWindowStart = Date.now(); mailCount = 0; }
  if (++mailCount > MAIL_LIMIT_PER_HOUR) throw new Error('테스트 메일 전송 한도(시간당 ' + MAIL_LIMIT_PER_HOUR + '회)를 넘었습니다. 잠시 뒤 다시 시도하세요.');

  const clip = (v, n) => String(v ?? '').slice(0, n);

  // 보내는 계정(SMTP)이 설정돼 있으면 그 계정으로 직접 발송, 없으면 FormSubmit 사용
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = require('nodemailer');
    const tr = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com', port: +process.env.SMTP_PORT || 465, secure: (+process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s+/g, '') },
      connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000,
    });
    const rows = Object.entries(fields).slice(0, 40).map(([k, v]) => `${clip(k, 30)}: ${clip(v, 500)}`).join('\n');
    // 사용자가 확인·수정한 메일 본문이 있으면 그대로 사용
    const text = mailText.trim()
      ? clip(mailText, 12000)
      : `[HoLab! 시연용 테스트 전송 — 법률 자문이 아닌 참고용 초안]\n접수번호: ${clip(receipt, 40)}\n전달 대상(시연): ${clip(lawyer.name, 30)} (${clip(lawyer.office, 40)})\n\n${rows}\n\n[진정 내용]\n${clip(body, 8000)}\n`;
    const buf = pdfBase64 ? Buffer.from(String(pdfBase64), 'base64') : null;
    try {
      await tr.sendMail({
        from: `HoLab! <${process.env.SMTP_USER}>`, to,
        subject: clip(subject, 150).replace(/[\r\n]+/g, ' ').trim() || `[HoLab! 진정서 테스트] ${clip(fields['진정인 성명'], 20) || '진정서'} → ${clip(lawyer.name, 20)}`,
        text,
        attachments: buf && buf.length > 0 && buf.length <= 4 * 1024 * 1024 ? [{ filename: clip(filename, 60) || '진정서.pdf', content: buf, contentType: 'application/pdf' }] : [],
      });
    } catch (e) {
      mailCount--;
      throw new Error(/535|Invalid login|Username and Password/i.test(String(e.message)) ? '보내는 계정 로그인에 실패했어요. Gmail은 일반 비밀번호가 아니라 “앱 비밀번호”(2단계 인증 필요)를 SMTP_PASS에 넣어야 해요.' : '메일 발송 오류: ' + clip(e.message, 200));
    }
    return { to: maskEmail(to) };
  }

  const fd = new FormData();
  fd.append('_subject', `[HoLab! 진정서 테스트] ${clip(fields['진정인 성명'], 20) || '진정서'} → ${clip(lawyer.name, 20)}`);
  fd.append('_captcha', 'false');
  fd.append('_template', 'box');
  fd.append('접수번호', clip(receipt, 40));
  fd.append('전달 대상(시연)', `${clip(lawyer.name, 30)} (${clip(lawyer.office, 40)})`);
  for (const [k, v] of Object.entries(fields).slice(0, 40)) fd.append(clip(k, 30), clip(v, 500));
  if (subject.trim()) fd.set('_subject', clip(subject, 150).replace(/[\r\n]+/g, ' '));
  fd.append(mailText.trim() ? '메일 내용' : '진정 내용', clip(mailText.trim() ? mailText : body, 12000));
  if (pdfBase64) {
    const buf = Buffer.from(String(pdfBase64), 'base64');
    if (buf.length > 0 && buf.length <= 4 * 1024 * 1024) fd.append('attachment', new Blob([buf], { type: 'application/pdf' }), clip(filename, 60) || '진정서.pdf');
  }
  const r = await fetch('https://formsubmit.co/ajax/' + to, {
    method: 'POST', body: fd, signal: AbortSignal.timeout(30000),
    headers: { Accept: 'application/json', Origin: 'http://localhost:3000', Referer: 'http://localhost:3000/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
  });
  const d = await r.json().catch(() => ({}));
  if (String(d.success) !== 'true') {
    if (/activation/i.test(String(d.message))) { mailCount--; throw new Error('받는 메일함으로 FormSubmit 활성화 메일이 발송되었어요. 메일의 [Activate Form] 링크를 누른 뒤 다시 전송해 주세요.'); }
    throw new Error('메일 서비스 오류: ' + clip(d.message || r.status, 200));
  }
  return { to: maskEmail(to) };
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/api/law?')) {
      const ref = parseLawRef(new URL(req.url, 'http://x').searchParams.get('ref') || '');
      if (!ref) return send(res, 400, { error: '조문을 알 수 없어요.' });
      const found = await Promise.race([lookupLaw(ref), new Promise((r) => setTimeout(() => r(null), 9000))]);
      return found ? send(res, 200, found) : send(res, 404, { error: '조문 원문을 불러오지 못했어요.' });
    }
    if (req.method === 'GET' && req.url === '/api/status') return send(res, 200, { hasKey: hasKey(), model: MODEL, mailTo: (mailTo() || (process.env.SMTP_USER && process.env.SMTP_PASS)) ? maskEmail(mailTo() || process.env.SMTP_USER) : null });

    if (req.method === 'POST' && req.url === '/api/analyze-contract') {
      const { maskedText, useRag = true } = await readBody(req);
      if (!maskedText || maskedText.length < 20) return send(res, 400, { error: '계약서 텍스트가 너무 짧습니다.' });
      const hits = useRag ? retrieve(maskedText) : [];
      const withRag = (r) => (useRag ? attachEvidence(r, hits) : { ...r, rag: { used: false, sources: [] } });
      if (!hasKey()) { const fb = fallbackAnalyze(maskedText); fb.clauses = [...fb.clauses, ...ruleFlags(maskedText, fb.clauses)]; return send(res, 200, await attachLawText(withRag(fb))); }
      try {
        const kb = hits.map((h) => `### ${h.c.title}\n${h.c.text}`).join('\n\n');
        const rule = useRag
          ? '\n\n[검색된 근거 자료] 아래 자료에 있는 내용만 근거로 삼아 점검하세요. 자료로 확인되지 않는 내용은 단정하지 말고 severity를 low로 하며, law에는 자료에 있는 조문만 쓰세요.\n' + kb
          : '';
        const out = JSON.parse(await callOpenAI(SYS_ANALYZE + rule, maskedText.slice(0, 6000), true));
        const clauses = Array.isArray(out.clauses) ? out.clauses : [];
        return send(res, 200, await attachLawText(withRag({ clauses: [], ...out, clauses: [...clauses, ...ruleFlags(maskedText, clauses)], missing: fallbackAnalyze(maskedText).missing, demo: false })));
      } catch (e) {
        console.error('[analyze] fallback:', e.message);
        return send(res, 200, await attachLawText(withRag(fallbackAnalyze(maskedText))));
      }
    }

    if (req.method === 'POST' && req.url === '/api/draft-complaint') {
      const facts = await readBody(req);
      if (!hasKey()) return send(res, 200, fallbackDraft(facts));
      try {
        const text = await callOpenAI(SYS_DRAFT, JSON.stringify(facts), false);
        return send(res, 200, { text: text.trim(), demo: false });
      } catch (e) {
        console.error('[draft] fallback:', e.message);
        return send(res, 200, fallbackDraft(facts));
      }
    }

    if (req.method === 'POST' && req.url === '/api/triage-chat') {
      const { messages = [], rag = true } = await readBody(req);
      const msgs = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return send(res, 400, { error: '메시지가 없습니다.' });
      if (!hasKey()) return send(res, 200, fallbackTriage(msgs));
      try {
        if (!aiBudgetOk()) throw new Error('AI hourly limit reached');
        // RAG: AI가 판단하기 전에 사용자 말과 가까운 법령 조문을 먼저 검색해 근거 자료로 붙임
        const useRag = rag !== false;
        const userText = msgs.filter((m) => m.role === 'user').slice(-6).map((m) => m.content).join(' ');
        const hits = useRag ? retrieve(expandQuery(userText), 6, 0.2) : [];
        const evidence = hits.map((h, i) => `[E${i + 1}] ${h.c.title}\n${h.c.text.slice(0, 420)}`).join('\n\n');
        const lastUser = msgs[msgs.length - 1].content;
        const asksLaw = /(위반|조항|법률|법적|무슨 법|어떤 법|처벌|불법)/.test(lastUser);
        const lawNote = asksLaw ? '\n\n[이번 질문 지침] 사용자가 방금 법 조항·위반 여부를 직접 물었습니다. 되묻지 말고 reply 첫머리에서 먼저 답하세요. 말씀만으로는 위반이라고 확정할 수 없지만 해당될 수 있는 조항이 있다고 알려 주고' + (useRag ? ', 근거 자료의 조문 이름을 말하고 citations에 번호를 반드시 적으세요.' : ', 알고 있는 조문을 말하되 확정하지 마세요.') + ' 확인 질문은 마지막에 1개만 하세요.' : '';
        const system = (useRag ? SYS_TRIAGE_RAG + '\n\n[근거 자료]\n' + (evidence || '(검색된 자료 없음)') : SYS_TRIAGE_PLAIN) + lawNote;
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          signal: AbortSignal.timeout(40000), method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
          body: JSON.stringify({ model: MODEL, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, ...msgs] }),
        });
        if (!r.ok) throw new Error('OpenAI ' + r.status);
        const out = JSON.parse((await r.json()).choices[0].message.content);
        if (process.env.DEBUG_TRIAGE) console.error('[triage raw]', JSON.stringify(out));
        const list = (a, n, len) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, len)).filter(Boolean).slice(0, n);
        const seen = new Set();
        let ranking = (Array.isArray(out.ranking) ? out.ranking : []).filter((x) => x && FEATURE_KEYS.includes(x.key) && !seen.has(x.key) && seen.add(x.key)).slice(0, 3).map((x) => ({ key: x.key, reason: String(x.reason || '').slice(0, 200) }));
        let caseType = CASE_TYPES[out.caseType] ? out.caseType : 'other';
        // 국적·외국인이라는 말이 있으면 괴롭힘보다 차별을 우선 (욕설이 함께 나와도 핵심은 국적 차별)
        if (/(외국인|베트남|필리핀|이주|국적|외노자)/.test(userText) && (caseType === 'harassment' || caseType === 'other')) caseType = 'discrimination';
        let citations = [], procedure = String(out.procedure || '').slice(0, 300), procedureDropped = false, usedHits = [];
        if (useRag) {
          // 검색된 자료 번호(E#)만 인정하고, 절차 설명 속 숫자(기한 등)가 인용한 조문에 실제로 있어야 유지
          const ids = [...new Set(list(out.citations, 6, 12).map((c) => (c.match(/E(\d+)/i) || [])[1]).filter(Boolean).map(Number))].filter((n) => n >= 1 && n <= hits.length);
          usedHits = ids.map((n) => hits[n - 1]);
          citations = usedHits.map((h) => h.c.title);
          const src = usedHits.map((h) => h.c.text).join(' ');
          // 기한·기간처럼 숫자+단위(3개월, 30일, 3년 …)는 인용한 조문 원문에 그대로 있어야 유지
          const compact = (s) => String(s).replace(/\s+/g, '');
          const claims = (procedure.match(/\d+\s*(?:개월|개|일|년|시간|세|퍼센트|%|명|분의)/g) || []).map(compact);
          const srcC = compact(src);
          if (procedure && (!usedHits.length || !claims.every((c) => srcC.includes(c)))) { procedure = ''; procedureDropped = true; }
        } else {
          citations = list(out.citations, 3, 60);
        }
        // 정보가 적어 AI가 비워 둔 부분은 "잠정"으로 채워 화면이 비지 않게 함 (잠정 표시를 붙여 사용자에게 알림)
        const aiCitations = [...citations]; // AI가 직접 고른 인용 (평가에는 이것만 사용)
        let rankingTentative = false, citationsTentative = false;
        if (!ranking.length && caseType !== 'other' && DEFAULT_RANK[caseType]) {
          ranking = DEFAULT_RANK[caseType].map((key) => ({ key, reason: key === 'lawyer' ? `말씀하신 내용으로는 "${CASE_TYPES[caseType]}" 문제로 보여요. 이런 사건은 맞는 절차를 전문가와 확인하는 게 안전해요.` : `말씀하신 내용으로는 "${CASE_TYPES[caseType]}" 문제로 보여서 이 기능이 도움이 될 수 있어요.` }));
          rankingTentative = true;
        }
        if (useRag && !usedHits.length && caseType !== 'other') {
          const pool = hits.length ? hits : retrieve(CASE_QUERY[caseType] || '', 3, 0.1);
          const pick = (hits.length ? pool.filter((h) => h.s >= 0.3) : pool).slice(0, 2);
          if (pick.length) { usedHits = pick; citations = pick.map((h) => h.c.title); citationsTentative = true; }
        }
        // 사건 유형이 정해졌는데 그 유형의 대표 조문이 인용에 없으면 함께 보여 줌 (예: 유형은 차별인데 괴롭힘 조항만 나오는 어긋남 방지)
        if (useRag && caseType !== 'other' && CASE_QUERY[caseType]) {
          for (const h of retrieve(CASE_QUERY[caseType], 2, 0.1)) { if (citations.length < 4 && !citations.includes(h.c.title)) { citations.push(h.c.title); usedHits.push(h) } }
        }
        // 핵심 유형 외에 욕설·폭언 같은 괴롭힘 정황이 함께 있으면 직장 내 괴롭힘 조문도 함께 보여 줌 (예: 차별 + 욕설)
        if (useRag && caseType !== 'harassment' && /(욕설|욕을|욕해|폭언|따돌|괴롭|모욕|놀림)/.test(userText)) {
          for (const h of retrieve(CASE_QUERY.harassment, 1, 0.1)) { if (citations.length < 5 && !citations.includes(h.c.title)) { citations.push(h.c.title); usedHits.push(h) } }
        }
        const userLines = msgs.filter((m) => m.role === 'user' && !/[?？]\s*$|어떻게|무슨|뭐|되나요/.test(m.content)).slice(-3).map((m) => m.content.slice(0, 120));
        const factsOut = list(out.facts, 10, 200);
        const bad = /(주세요|하세요|드릴게요|언제든|말씀해)/;
        // 눌러서 답하는 문장은 AI가 사용자 대신 사실을 지어내지 않도록 사건 유형별로 정해 둔 문장만 사용
        const sugg = FOLLOWUP[caseType] || FOLLOWUP.other;
        // RAG 모드: 답변 속 조문 번호가 검색된 자료에 없으면 "관련 조항"으로 바꿈 (AI가 기억으로 지어낸 번호가 화면에 나가지 않게)
        const okRefs = new Set([...hits, ...usedHits].map((h) => (h.c.title.match(/^(.+?)\s제(\d+)조(?:의(\d+))?/) || []).slice(1, 4).join('|')));
        // 지침에 쓴 내부 용어(citations·ranking 등)가 답변에 새어 나오면 그 문장을 지움
        const stripLeak = (s) => s.split(/(?<=[.!?。])\s+/).filter((x) => !/(citations|ranking|caseType|procedure|JSON|근거 자료 번호|\bE\d+\b)/i.test(x)).join(' ').trim();
        const stripE = (s) => stripLeak(s).replace(/\s*[\(（]\s*질문 1개[^\)）]*[\)）]/g, '').replace(/\s*[\(\[]\s*E\d+(?:\s*[,，]\s*E\d+)*\s*[\)\]]/g, '');
        const cleanReply = (s) => (useRag ? stripE(s).replace(/([가-힣ㆍ·]{2,}(?:법|령))\s*제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/g, (m, law, n, b) => (okRefs.has([law.trim(), n, b || ''].join('|')) ? m : '관련 조항')) : s);
        // 사용자가 법 조항을 직접 물었는데 AI 답변에 조항 안내가 없으면, 검색된 근거 조문으로 먼저 답해 줌 (되묻기만 하는 답변 방지)
        const nameOf = (title) => title.replace(/(제\d+조(?:의\d+)?)\s+(.+)$/, '$1($2)');
        const withLawAnswer = (s) => {
          if (!asksLaw || !citations.length) return s;
          const lawNames = citations.slice(0, 2).map(nameOf);
          if (lawNames.some((n) => s.includes(n.split('(')[0]))) return s;
          return s + `\n\n말씀만으로는 위반이라고 확정할 수는 없지만, ${lawNames.join(', ')}에 해당할 수 있어요. 아래 "해당될 수 있는 법 조항"에서 자세히 볼 수 있어요.`;
        };        const keyTop = ranking[0]?.key || null;
        return send(res, 200, {
          reply: withLawAnswer(cleanReply(String(out.reply || '').trim().slice(0, 1000))), facts: factsOut.length ? factsOut : userLines, issues: list(out.issues, 3, 100),
          caseType, caseLabel: CASE_TYPES[caseType], ranking, recommend: { key: keyTop, reason: keyTop ? ranking[0].reason : '' },
          citations, aiCitations, procedure, procedureDropped, rankingTentative, citationsTentative,
          rag: { used: useRag, sources: hits.map((h) => ({ title: h.c.title, text: h.c.text.slice(0, 200), score: Math.round(h.s * 100) / 100, used: usedHits.includes(h) })) },
          suggestions: sugg, demo: false,
        });
      } catch (e) {
        console.error('[triage-chat] fallback:', e.message);
        return send(res, 200, fallbackTriage(msgs));
      }
    }
    if (req.method === 'POST' && req.url === '/api/judge-calc') {
      const b = await readBody(req);
      const n = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
      const c = {
        계약시급: n(b.hourly), 법정최저시급: n(b.minWage), 주당_소정근로시간: n(b.weekly), 일한기간_개월: n(b.months), 개근못한_주수: Math.round((+b.missedWeeks || 0) * 10) / 10,
        '5인미만_사업장': !!b.under5, 주휴수당_이미_받는중: !!b.holidayPaid, 가산수당_이미_받는중: !!b.extraPaid,
        받아야할_급여_전체기간: n(b.totalDue), 그중_못받은_돈_합계: n(b.total), 못받은_주휴수당: n(b.holUnpaid), 못받은_가산수당: n(b.extraUnpaid), 최저임금_차액: n(b.minWageUnpaid),
      };
      // 결과 속 숫자는 위 계산 결과에 있는 값만 허용 (AI가 새 숫자를 지어내거나 바꿔 쓴 문장은 버림)
      const allowed = new Set(Object.values(c).filter((v) => typeof v === 'number').map((v) => String(Math.round(v))));
      allowed.add(String(Math.max(0, c.법정최저시급 - c.계약시급))); allowed.add('0'); // 최저임금과의 시급 차이도 허용
      const numsOk = (s) => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).every((x) => allowed.has(String(Math.round(+x.replace(/,/g, '')))));
      if (!hasKey()) return send(res, 200, { demo: true });
      try {
        const out = JSON.parse(await callOpenAI(SYS_JUDGE, JSON.stringify(c), true));
        const list = (a, k, len) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, len)).filter(Boolean).slice(0, k);
        const key = ['contract', 'complaint', 'lawyer'].includes(out?.recommend?.key) ? out.recommend.key : null;
        if (!key) throw new Error('bad key');
        const reasonOk = String(out.recommend.reason || '').slice(0, 300);
        if (!reasonOk || !numsOk(reasonOk)) throw new Error('reason has unverified numbers');
        const summaryOk = String(out.summary || '').slice(0, 300);
        if (!summaryOk || !numsOk(summaryOk)) throw new Error('summary has unverified numbers');
        return send(res, 200, { summary: summaryOk, recommend: { key, reason: reasonOk }, demo: false });
      } catch (e) {
        console.error('[judge-calc] fallback:', e.message);
        return send(res, 200, { demo: true });
      }
    }
    if (req.method === 'POST' && req.url === '/api/judge-contract') {
      const b = await readBody(req);
      const n = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
      const strs = (a, k, len) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, len)).filter(Boolean).slice(0, k);
      const c = {
        계약서_시급: n(b.contractHourly), 법정최저시급: n(b.minWage), 계약서_기준_월금액: n(b.contractMonthly), 실제_받은_월금액: n(b.received), 법적으로_받아야할_월금액: n(b.legalMonthly),
        부족액_계약서기준: n(b.shortVsContract), 부족액_법적기준: n(b.shortVsLegal),
        위험_조항수: n(b.high), 주의_조항수: n(b.medium), 참고_조항수: n(b.low), 위험조항_제목들: strs(b.highTitles, 5, 40), 누락항목들: strs(b.missing, 5, 30),
      };
      if (!hasKey()) return send(res, 200, { demo: true });
      // 결과 속 숫자는 위 값(과 조항 제목에 들어 있던 숫자)만 허용
      const allowed = new Set(Object.values(c).filter((v) => typeof v === 'number').map((v) => String(Math.round(v))));
      for (const s of [...c.위험조항_제목들, ...c.누락항목들]) for (const x of s.match(/\d[\d,]*/g) || []) allowed.add(String(+x.replace(/,/g, '')));
      allowed.add('0'); allowed.add(String(Math.max(0, c.법정최저시급 - c.계약서_시급)));
      const numsOk = (s) => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).every((x) => allowed.has(String(Math.round(+x.replace(/,/g, '')))));
      try {
        const out = JSON.parse(await callOpenAI(SYS_JUDGE_CONTRACT, JSON.stringify(c), true));
        const key = ['complaint', 'lawyer'].includes(out?.recommend?.key) ? out.recommend.key : null;
        const summary = String(out.summary || '').slice(0, 450);
        const reason = String(out?.recommend?.reason || '').slice(0, 300);
        if (!key || !summary || !reason || !numsOk(summary) || !numsOk(reason)) throw new Error('invalid or unverified output');
        return send(res, 200, { summary, recommend: { key, reason }, demo: false });
      } catch (e) {
        console.error('[judge-contract] fallback:', e.message);
        return send(res, 200, { demo: true });
      }
    }
    if (req.method === 'POST' && req.url === '/api/explain-legal') {
      const { titles = [], facts = [] } = await readBody(req);
      const wanted = [...new Set((Array.isArray(titles) ? titles : []).map((x) => String(x)))].slice(0, 4);
      const chunks = loadChunks();
      const picked = wanted.map((w) => chunks.find((c) => c.title === w)).filter(Boolean);
      const f = (Array.isArray(facts) ? facts : []).map((x) => String(x).slice(0, 160)).slice(0, 8);
      const banned = /위반(했|하였|입니다|이에요|이다)|불법/;
      // AI 없이도 쓸 수 있는 기본값: 조문 원문 첫 부분 + 정해진 문장
      const base = (c) => ({ title: c.title, plain: c.text.split('\n')[0].replace(/^제\d+조\([^)]*\)\s*/, '').slice(0, 160), situation: '말씀하신 상황이 이 조항에 해당할 수 있어요.', checks: [] });
      if (!picked.length) return send(res, 200, { items: [], demo: true });
      if (!hasKey()) return send(res, 200, { items: picked.map(base), demo: true });
      try {
        const user = '[사용자가 말한 사실]\n' + (f.map((x) => '- ' + x).join('\n') || '- (없음)') + '\n\n[조문]\n' + picked.map((c) => `제목: ${c.title}\n${c.text.slice(0, 500)}`).join('\n\n');
        const out = JSON.parse(await callOpenAI(SYS_EXPLAIN_LEGAL, user, true));
        const compact = (s) => String(s).replace(/\s+/g, '');
        const items = picked.map((c) => {
          const o = (Array.isArray(out.items) ? out.items : []).find((x) => x && x.title === c.title);
          const b = base(c);
          if (!o) return b;
          if (o.applies === false) return null; // 사건과 무관한 조문은 카드에서 뺌
          const srcC = compact(c.text + f.join(' '));
          const claims = (s) => (String(s).match(/\d+\s*(?:개월|개|일|년|시간|세|퍼센트|%|명|분의)/g) || []).map(compact);
          const plain = String(o.plain || '').slice(0, 240);
          const situation = String(o.situation || '').slice(0, 200);
          return {
            title: c.title,
            plain: plain && claims(plain).every((x) => srcC.includes(x)) && !banned.test(plain) ? plain : b.plain,
            situation: situation && !banned.test(situation) && /(수 있어요|일 수 있|있을 수 있)/.test(situation) ? situation : b.situation,
            checks: (Array.isArray(o.checks) ? o.checks : []).map((x) => String(x).slice(0, 60)).filter(Boolean).slice(0, 3),
          };
        });
        return send(res, 200, { items: items.filter(Boolean), demo: false });
      } catch (e) {
        console.error('[explain-legal] fallback:', e.message);
        return send(res, 200, { items: picked.map(base), demo: true });
      }
    }
    if (req.method === 'POST' && req.url === '/api/judge-complaint') {
      const b = await readBody(req);
      const n = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
      const strs = (a, k, len) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, len)).filter(Boolean).slice(0, k);
      const c = {
        못받은돈_합계: n(b.total), 비어있는_항목들: strs(b.missing, 6, 30), 갖고있는_증빙수: n(b.haveEvidence), 전체_필요_증빙수: n(b.needEvidence), 부족한_증빙수: Math.max(0, n(b.needEvidence) - n(b.haveEvidence)), 추천: b.suggest === 'lawyer' ? 'lawyer' : 'fix',
        위반_조항수: n(b.docIssues), 해당될수있는_조항수: n(b.stmtIssues), 자동작성_항목수: n(b.autoCount), 초안_작성됨: !!b.draftDone, 관련_법_조항들: strs(b.laws, 5, 50),
      };
      if (!hasKey()) return send(res, 200, { demo: true });
      const allowed = new Set(Object.values(c).filter((v) => typeof v === 'number').map((v) => String(Math.round(v))));
      for (const s of [...c.비어있는_항목들, ...c.관련_법_조항들]) for (const x of s.match(/\d[\d,]*/g) || []) allowed.add(String(+x.replace(/,/g, '')));
      allowed.add('0');
      const numsOk = (s) => (String(s).match(/\d[\d,]*(?:\.\d+)?/g) || []).every((x) => allowed.has(String(Math.round(+x.replace(/,/g, '')))));
      try {
        const out = JSON.parse(await callOpenAI(SYS_JUDGE_COMPLAINT, JSON.stringify(c), true));
        const key = c.추천; // 추천 기능은 규칙으로 정해 두고 AI는 이유만 씀(말과 추천이 어긋나지 않게)
        const summary = String(out.summary || '').slice(0, 450), reason = String(out?.recommend?.reason || '').slice(0, 300);
        if (!summary || !reason || !numsOk(summary) || !numsOk(reason)) throw new Error('invalid or unverified output');
        // 사실과 어긋나는 문장은 버림: 증빙을 다 갖췄는데 부족하다고 쓰거나, 초안이 있는데 없다고 쓴 경우
        const said = summary + ' ' + reason;
        if (c.부족한_증빙수 === 0 && /증빙[^.]{0,14}(부족|남아|모자|없)/.test(said)) throw new Error('contradicts evidence');
        if (c.초안_작성됨 && /초안[^.]{0,10}(없|작성되지|아직)/.test(said)) throw new Error('contradicts draft');
        if (key === 'lawyer' && /(먼저 보완|보완이 필요|보완하는 것이)/.test(said)) throw new Error('contradicts recommendation');
        if (/변호사/.test(said)) throw new Error('wrong counsel type'); // HoLab이 안내하는 곳은 무료 상담 센터(공인노무사)
        return send(res, 200, { summary, recommend: { key, reason }, demo: false });
      } catch (e) {
        console.error('[judge-complaint] fallback:', e.message);
        return send(res, 200, { demo: true });
      }
    }
    if (req.method === 'POST' && req.url === '/api/call-script') {
      const b = await readBody(req);
      const n = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
      const strs = (a, k, len) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, len)).filter(Boolean).slice(0, k);
      const c = { 센터: String(b.center || '').slice(0, 40), 상담방식: String(b.method || '').slice(0, 20), 사건유형: String(b.caseLabel || '').slice(0, 30), 말한_사실: strs(b.facts, 5, 120), 못받은돈_추정: n(b.total), 일한기간_개월: n(b.months), 관련_법_조항: strs(b.laws, 3, 50) };
      if (!hasKey()) return send(res, 200, { demo: true });
      const allowed = new Set([String(c.못받은돈_추정), String(c.일한기간_개월), '0']);
      for (const s of [...c.말한_사실, ...c.관련_법_조항]) for (const x of s.match(/\d[\d,]*/g) || []) allowed.add(String(+x.replace(/,/g, '')));
      const numsOk = (s) => (String(s).match(/\d[\d,]*/g) || []).every((x) => allowed.has(String(+x.replace(/,/g, ''))));
      const banned = /위반(했|하였|입니다|이에요|이다)|불법|고소|소송|센터입니다|하셨|필요하신/; // 센터 직원 말투(2인칭)로 쓴 대본도 버림
      try {
        const out = JSON.parse(await callOpenAI(SYS_CALL_SCRIPT, JSON.stringify(c), true));
        const script = String(out.script || '').trim().slice(0, 700);
        if (!script || !numsOk(script) || banned.test(script)) throw new Error('invalid or unverified script');
        return send(res, 200, { script, demo: false });
      } catch (e) {
        console.error('[call-script] fallback:', e.message);
        return send(res, 200, { demo: true });
      }
    }
    if (req.method === 'POST' && req.url === '/api/complaint-chat') {
      const { messages = [], facts = {} } = await readBody(req);
      const msgs = messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-14).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
      if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return send(res, 400, { error: '메시지가 없습니다.' });
      if (!hasKey()) return send(res, 200, fallbackComplaintChat(msgs));
      try {
        if (!aiBudgetOk()) throw new Error('AI hourly limit reached');
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          signal: AbortSignal.timeout(40000),
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
          body: JSON.stringify({
            model: MODEL, temperature: 0.3, response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: SYS_COMPLAINT_CHAT + '\n\n[facts] ' + JSON.stringify(facts).slice(0, 2000) }, ...msgs],
          }),
        });
        if (!r.ok) throw new Error('OpenAI ' + r.status);
        const out = JSON.parse((await r.json()).choices[0].message.content);
        const notes = (Array.isArray(out.notes) ? out.notes : []).map((x) => String(x).slice(0, 300)).filter(Boolean).slice(0, 12);
        let reply = String(out.reply || '').trim();
        let ready = !!out.ready;
        const userTurns = msgs.filter((m) => m.role === 'user').length;
        if (!ready && (notes.length >= 3 || userTurns >= 4)) { ready = true; reply = '충분한 내용이 모였어요. 이 내용으로 초안을 만들어 드릴까요?'; }
        const asks = /[?？]|주세요|까요|나요|있으세요|계신가요/.test(reply);
        if (!ready && !asks) reply = (reply ? reply + ' ' : '') + fallbackComplaintChat(msgs).reply.replace(/^.*?(?=[가-힣 ]*[?？])/, '').replace(/^말씀해 주셔서 고마워요\.\s*/, '');
        return send(res, 200, { reply: reply.slice(0, 1000), ready, notes, suggestions: (Array.isArray(out.suggestions) ? out.suggestions : []).map((x) => String(x).slice(0, 80)).slice(0, 3), demo: false });
      } catch (e) {
        console.error('[complaint-chat] fallback:', e.message);
        return send(res, 200, fallbackComplaintChat(msgs));
      }
    }
    if (req.method === 'POST' && req.url === '/api/draft-mail') {
      const { lawyerName = '', facts = {}, notes = [], clauses = [], missing = [] } = await readBody(req);
      const cl = (Array.isArray(clauses) ? clauses : []).slice(0, 8).map((c) => ({ title: String(c.title || '').slice(0, 60), issue: String(c.issue || '').slice(0, 200) }));
      const nt = (Array.isArray(notes) ? notes : []).slice(0, 12).map((x) => String(x).slice(0, 300));
      if (!hasKey()) return send(res, 200, { summary: summaryFallbackBullets(facts, cl, nt), demo: true });
      try {
        const out = await callOpenAI(SYS_MAIL, JSON.stringify({ facts, consultNotes: nt, contractIssues: cl, missingItems: (Array.isArray(missing) ? missing : []).slice(0, 10) }), false);
        return send(res, 200, { summary: out.trim().slice(0, 3000), demo: false });
      } catch (e) {
        console.error('[draft-mail] fallback:', e.message);
        return send(res, 200, { summary: summaryFallbackBullets(facts, cl, nt), demo: true });
      }
    }
    if (req.method === 'POST' && req.url === '/api/draft-report') {
      const { facts = {}, notes = [], clauses = [], missing = [] } = await readBody(req);
      const cl2 = (Array.isArray(clauses) ? clauses : []).slice(0, 8).map((c) => ({ title: String(c.title || '').slice(0, 60), issue: String(c.issue || '').slice(0, 200) }));
      const nt2 = (Array.isArray(notes) ? notes : []).slice(0, 12).map((x) => String(x).slice(0, 300));
      const fb = () => ({ summary: summaryFallbackBullets(facts, cl2, nt2), questions: reportQuestionsFallback(facts, cl2), demo: true });
      if (!hasKey()) return send(res, 200, fb());
      try {
        const raw = await callOpenAI(SYS_REPORT, JSON.stringify({ facts, consultNotes: nt2, contractIssues: cl2, missingItems: (Array.isArray(missing) ? missing : []).slice(0, 10) }), true);
        const out = JSON.parse(raw);
        const summary = String(out.summary || '').trim().slice(0, 2000) || summaryFallbackBullets(facts, cl2, nt2);
        const questions = (Array.isArray(out.questions) ? out.questions : []).map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 6);
        return send(res, 200, { summary, questions: questions.length ? questions : reportQuestionsFallback(facts, cl2), demo: false });
      } catch (e) {
        console.error('[draft-report] fallback:', e.message);
        return send(res, 200, fb());
      }
    }
    if (req.method === 'POST' && req.url === '/api/send-complaint-mail') {
      if (!mailTo() && !(process.env.SMTP_USER && process.env.SMTP_PASS)) return send(res, 503, { error: '메일 기능이 꺼져 있습니다.' });
      const body = await readBody(req, 6e6);
      try { return send(res, 200, { ok: true, ...(await sendComplaintMail(body)) }); }
      catch (e) { console.error('[mail]', e.message); return send(res, 502, { error: e.message }); }
    }
    // 정적 파일
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const root = staticRoot();
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: '서버 오류' });
  }
});

server.listen(PORT, () => console.log(`HoLab! 실행 중: http://localhost:${PORT}  (AI: ${hasKey() ? MODEL : '키 없음 → 대체 응답 모드'})`));

