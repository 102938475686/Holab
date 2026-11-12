// 페르소나 점검: 가상 인물 11명의 사례를 HoLab 에이전트에 넣어, 알맞은 기능을 고르고 법 조항을 제대로 짚는지 확인합니다.
// 실행: node eval/personas.js   (서버가 켜져 있어야 해요. 인물당 AI를 2~5번 부르며 전체 약 30회)
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const URL_BASE = process.env.HOLAB_URL || 'http://localhost:3000';
const { personas } = JSON.parse(fs.readFileSync(path.join(__dirname, 'personas.json'), 'utf8'));
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean)

const ALIAS = { 남녀고용평등법: '남녀고용평등과일가정양립지원에관한법률', 산재보험법: '산업재해보상보험법', 외국인고용법: '외국인근로자의고용등에관한법률' };
const norm = (s) => { const k = String(s).replace(/[^가-힣]/g, ''); return ALIAS[k] || k; };
function refs(str) {
  const out = new Set();
  const s = String(str);
  const m = s.match(/^\s*([^제\d]+?)\s*제\s*\d/);
  if (!m) return out;
  const law = norm(m[1]);
  for (const x of s.matchAll(/제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/g)) out.add(law + '|' + x[1] + (x[2] ? '의' + x[2] : ''));
  return out;
}
const refSet = (list) => { const o = new Set(); for (const s of list) for (const r of refs(s)) o.add(r); return o; };

async function post(p, body) {
  const r = await fetch(URL_BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  return r.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class LimitError extends Error {}
const need = (res, what) => { if (res.demo) throw new LimitError(`${what}: AI가 아닌 대체 응답이 왔어요(시간당 한도 초과·키 없음 등)`); return res; };

(async () => {
  let calcMod = null;
  try { calcMod = await import(pathToFileURL(path.join(__dirname, '..', 'web', 'src', 'lib', 'calc.ts')).href); } catch (e) { console.error('계산식 불러오기 실패(계산 검증 생략):', e.message); }
  const BANNED = /위반(했|하였|입니다|이에요|이다)|불법/;
  const results = [];
  let aborted = null;

  for (const p of personas.filter((x) => !only.length || only.includes(x.id))) {
    const row = { id: p.id, name: p.name, profile: p.profile, checks: [], calls: 0 };
    const add = (name, ok, detail = '') => row.checks.push({ name, ok, detail });
    try {
      // 1) 상담: 사건 유형·기능 순위·근거 조문
      const t = need(await post('/api/triage-chat', { messages: [{ role: 'user', content: p.say }], rag: true }), '상담'); row.calls++;
      row.triage = { caseType: t.caseType, ranking: (t.ranking || []).map((x) => x.key), citations: t.citations, procedure: t.procedure };
      const e = { ...p.expect, caseType: [].concat(p.expect.caseType) };
      add('사건 유형 분류', e.caseType.includes(t.caseType), `AI=${t.caseType} 정답=${e.caseType.join('|')}`);
      add('1순위 기능 추천', e.top1.includes(t.ranking?.[0]?.key), `AI=${(t.ranking || []).map((x) => x.key).join('>')} 정답=${e.top1.join('|')}`);
      const cited = refSet(t.citations || []), must = refSet(e.mustCite), rel = refSet(e.relevant);
      const hit = [...must].filter((x) => cited.has(x)).length;
      add('필수 조문 인용', hit === must.size, `${hit}/${must.size} (${(t.citations || []).map((c) => c.replace(/\s.*$/, '') + ' ' + (c.match(/제\d+조(의\d+)?/) || [''])[0]).join(', ') || '없음'})`);
      const bad = [...cited].filter((x) => !rel.has(x));
      add('엉뚱한 조문 인용 없음', bad.length === 0, bad.length ? bad.join(', ') : '');
      if (e.procAny?.length) {
        const proc = String(t.procedure || '');
        add('공식 절차 안내', e.procAny.some((k) => proc.includes(k)) && (e.procMust || []).every((k) => proc.includes(k)), proc ? proc.slice(0, 60) : '없음');
      }

      // 2) 법적 쟁점 설명: "해당될 수 있어요" 표현 규칙 지키는지
      if ((t.citations || []).length) {
        const x = need(await post('/api/explain-legal', { titles: t.citations, facts: t.facts }), '법 조항 설명'); row.calls++;
        const items = x.items || [];
        const hedge = items.every((i) => /(수 있어요|일 수 있|있을 수 있)/.test(i.situation));
        const noBan = items.every((i) => !BANNED.test(i.situation + i.plain));
        add('말한 내용만 근거 → "해당될 수 있어요"로 표현', items.length > 0 && hedge && noBan, items.map((i) => i.situation.slice(0, 40)).join(' / '));
      }

      // 3) 계산 (계산식 검증 + 판단 카드)
      if (p.calc && calcMod) {
        const c = calcMod.calculate({ ...calcMod.defaultCalcInput, ...p.calc });
        add('계산 결과 일치', !!c && Math.abs(Math.round(c.total) - p.calcExpect) <= 2, `계산=${c ? Math.round(c.total) : '실패'} 정답=${p.calcExpect}`);
        if (c) {
          const j = need(await post('/api/judge-calc', { hourly: c.hourly, minWage: calcMod.MIN_WAGE, weekly: c.weekly, months: c.months, missedWeeks: c.missedWeeks, under5: c.under5, holidayPaid: c.holidayPaid, extraPaid: c.extraPaid, holUnpaid: c.holUnpaid, extraUnpaid: c.extraUnpaid, minWageUnpaid: c.minWageUnpaid, total: c.total, monthlyDue: c.monthlyDue, totalDue: c.totalDue }), '계산 판단'); row.calls++;
          add('계산 후 다음 기능 추천', (p.calcRec || []).includes(j.recommend?.key), `AI=${j.recommend?.key} 정답=${(p.calcRec || []).join('|')}`);
        }
      }

      // 4) 계약서 분석: 문제 조항을 짚고, 확실한 문구는 "위반이에요"(document)로 분류되는지
      if (p.contract) {
        const a = need(await post('/api/analyze-contract', { maskedText: p.contract, useRag: true }), '계약서 분석'); row.calls++;
        const clauses = (a.clauses || []).map((c) => ({ ...c, doc: c.severity === 'high' && !!(c.evidence || c.lawText) && !!c.quote, text: [c.title, c.issue, c.quote, c.law].filter(Boolean).join(' ') }));
        row.contract = clauses.map((c) => `${c.severity}${c.doc ? '*' : ''} ${c.title}`);
        for (const topic of e.topics || []) {
          const found = clauses.find((c) => topic.any.some((k) => c.text.includes(k))) || ((a.missing || []).some((m) => topic.any.some((k) => m.includes(k))) ? { doc: false, title: '(누락 항목)' } : null);
          add(`계약서 점검 — ${topic.name}`, !!found && (!topic.doc || found.doc), found ? `${found.title}${found.doc ? ' [위반 판정]' : ' [가능성]'}` : '못 찾음');
        }
      }
    } catch (err) {
      if (err instanceof LimitError) { aborted = err.message; row.aborted = err.message; results.push(row); break; }
      row.error = err.message; add('실행 오류', false, err.message);
    }
    results.push(row);
    const ok = row.checks.filter((c) => c.ok).length;
    console.log(`\n${p.id} ${p.name} (${p.profile})  ${ok}/${row.checks.length}`);
    for (const c of row.checks) console.log(`  ${c.ok ? '✔' : '✘'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
    await sleep(800);
  }

  const resFile = path.join(__dirname, 'personas-results.json');
  if (only.length && fs.existsSync(resFile)) { const prev = JSON.parse(fs.readFileSync(resFile, 'utf8')).results.filter((r) => !only.includes(r.id)); results.unshift(...prev); results.sort((a, b) => a.id.localeCompare(b.id)); }
  const all = results.flatMap((r) => r.checks);
  const group = (re) => { const g = all.filter((c) => re.test(c.name)); return g.length ? `${g.filter((c) => c.ok).length}/${g.length}` : '-'; };
  const summary = {
    페르소나: results.length, AI호출: results.reduce((s, r) => s + r.calls, 0), 중단: aborted,
    사건유형: group(/사건 유형/), '1순위기능': group(/1순위/), 필수조문: group(/필수 조문/), 엉뚱한조문없음: group(/엉뚱한/), 공식절차: group(/공식 절차/),
    표현규칙: group(/표현/), 계산일치: group(/계산 결과/), 계산후추천: group(/계산 후/), 계약서점검: group(/계약서 점검/),
  };
  console.log('\n=== 요약 ===');
  for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(10), v);
  fs.writeFileSync(path.join(__dirname, 'personas-results.json'), JSON.stringify({ runAt: new Date().toISOString(), summary, results }, null, 2), 'utf8');
})();
