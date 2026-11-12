// RAG 평가: 같은 사건 14건을 "검색 후 판단(RAG)"과 "검색 없이 판단"으로 각각 AI에 물어 정답과 비교합니다.
// 실행: node eval/run.js   (서버가 켜져 있어야 하고, 사건마다 AI를 2번 호출합니다 → 약 28회)
const fs = require('fs');
const path = require('path');
const URL = process.env.HOLAB_URL || 'http://localhost:3000';
const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));

// "근로기준법 제64조·제66조" 같은 문자열에서 (법령, 조) 키를 모두 뽑음
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

async function ask(text, rag) {
  const r = await fetch(URL + '/api/triage-chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: text }], rag }), signal: AbortSignal.timeout(90000),
  });
  return r.json();
}

function score(c, res, rag) {
  const must = refSet(c.mustCite), rel = refSet(c.relevant);
  const cited = refSet(res.citationsTentative ? [] : (res.aiCitations ?? res.citations ?? [])); // AI가 직접 고른 인용만 셈 (서버가 사건 유형으로 보태거나 잠정으로 채운 조문은 제외)
  const hit = [...cited].filter((x) => rel.has(x)).length;
  const bad = [...cited].filter((x) => !rel.has(x));
  const proc = String(res.procedure || '');
  const retrieved = refSet((res.rag?.sources || []).map((s) => s.title));
  return {
    typeOk: res.caseType === c.caseType,
    top1Ok: !res.rankingTentative && c.top1.includes(res.ranking?.[0]?.key), // AI가 비워 기본값으로 채운 추천은 정답으로 세지 않음
    cited: cited.size, citedOk: hit, citedBad: bad,
    mustHit: [...must].filter((x) => cited.has(x)).length, mustN: must.size,
    procWanted: c.procedureAny.length > 0,
    procPresent: proc.length > 0,
    procHit: c.procedureAny.length > 0 && c.procedureAny.some((k) => proc.includes(k)) && c.procedureMust.every((k) => proc.includes(k)),
    retrievalHit: rag ? [...must].filter((x) => retrieved.has(x)).length : null,
  };
}

const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
function summarize(rows) {
  const n = rows.length;
  const cites = sum(rows, (r) => r.cited);
  const procCases = rows.filter((r) => r.procWanted);
  return {
    cases: n,
    caseTypeAcc: sum(rows, (r) => +r.typeOk) / n,
    top1Acc: sum(rows, (r) => +r.top1Ok) / n,
    citationRecall: sum(rows, (r) => r.mustHit) / sum(rows, (r) => r.mustN),
    citationPrecision: cites ? sum(rows, (r) => r.citedOk) / cites : null,
    unsupportedCitations: sum(rows, (r) => r.citedBad.length),
    totalCitations: cites,
    procedureCoverage: procCases.length ? procCases.filter((r) => r.procHit).length / procCases.length : null,
    procedureCases: procCases.length,
    retrievalRecall: rows[0].retrievalHit == null ? null : sum(rows, (r) => r.retrievalHit) / sum(rows, (r) => r.mustN),
  };
}

(async () => {
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
  const modes = [['rag', true], ['plain', false]].filter(([n]) => !only || n === only);
  const resFile = path.join(__dirname, 'results.json');
  const prev = only && fs.existsSync(resFile) ? JSON.parse(fs.readFileSync(resFile, 'utf8')).rows.filter((r) => r.mode !== only) : [];
  const per = { rag: [], plain: [] }, raw = [...prev];
  for (const c of cases) {
    for (const [name, rag] of modes) {
      let res;
      try { res = await ask(c.text, rag); } catch (e) { console.error('ERR', c.id, name, e.message); process.exit(1); }
      if (res.demo) { console.error(`중단: ${c.id}(${name}) 응답이 AI가 아닌 대체 응답이에요(키 없음·시간당 한도 초과 등).`); process.exit(2); }
      const s = score(c, res, rag);
      per[name].push(s);
      raw.push({ id: c.id, label: c.label, mode: name, caseType: res.caseType, ranking: (res.ranking || []).map((x) => x.key), citations: res.citations, procedure: res.procedure, procedureDropped: res.procedureDropped, ...s });
      console.log(`${c.id} ${c.label.padEnd(14)} ${name.padEnd(5)} type=${s.typeOk ? 'O' : 'X'} top1=${s.top1Ok ? 'O' : 'X'} cite=${s.citedOk}/${s.cited}${s.citedBad.length ? ' 오인용=' + s.citedBad.join(',') : ''} must=${s.mustHit}/${s.mustN} proc=${s.procWanted ? (s.procHit ? 'O' : 'X') : '-'}`);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  const byMode = (m) => raw.filter((r) => r.mode === m);
  const summary = { rag: summarize(byMode('rag')), plain: summarize(byMode('plain')) };
  const out = { runAt: new Date().toISOString(), model: process.env.OPENAI_MODEL || 'gpt-4o-mini', note: JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'))._note, summary, rows: raw };
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(out, null, 2), 'utf8');
  const pub = path.join(__dirname, '..', 'web', 'public');
  if (fs.existsSync(pub)) fs.writeFileSync(path.join(pub, 'eval-results.json'), JSON.stringify({ runAt: out.runAt, model: out.model, note: out.note, summary }, null, 2), 'utf8');
  const pct = (v) => (v == null ? '-' : Math.round(v * 100) + '%');
  console.log('\n지표                         RAG    RAG 없음');
  for (const [k, l] of [['caseTypeAcc', '사건 유형 정확도'], ['top1Acc', '1순위 추천 정확도'], ['citationRecall', '꼭 필요한 조문 인용률'], ['citationPrecision', '인용 조문 정확도'], ['procedureCoverage', '공식 절차 안내 정확도']])
    console.log(l.padEnd(24), pct(summary.rag[k]).padStart(6), pct(summary.plain[k]).padStart(8));
  console.log('근거 없는 조문 인용 수'.padEnd(20), String(summary.rag.unsupportedCitations).padStart(6), String(summary.plain.unsupportedCitations).padStart(8));
  console.log('검색 단계 재현율(RAG)', pct(summary.rag.retrievalRecall));
})();
