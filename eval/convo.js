// 대화 회귀 점검: 실제 사용자가 겪은 "정보가 적고 법 조항을 직접 묻는" 대화를 다시 돌려 봅니다. (AI 3회 호출)
// 실행: node eval/convo.js
const URL = process.env.HOLAB_URL || 'http://localhost:3000';
const turns = ['베트남 사람인데 욕을 해요 사람들이', '위반 조항은 어떻게 되나요?', '해당되는 법률 위반 조항 어떻게 되나요'];

async function ask(messages) {
  const r = await fetch(URL + '/api/triage-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, rag: true }) });
  return r.json();
}

(async () => {
  const hist = [], results = [];
  for (const u of turns) {
    hist.push({ role: 'user', content: u });
    const r = await ask(hist);
    if (r.demo) { console.error('AI 응답이 아닌 대체 응답이에요(키 없음·한도 초과).'); process.exit(2); }
    hist.push({ role: 'assistant', content: r.reply });
    results.push(r);
    console.log(`\n사용자: ${u}\nAI: ${r.reply}\n유형=${r.caseLabel} 추천=${(r.ranking || []).map((x) => x.key).join('>')} 인용=${(r.citations || []).join(' ; ')}\n칩: ${(r.suggestions || []).join(' / ')}`);
  }
  const ok = [
    ['사건 유형이 "차별"(국적 언급)', results.every((r) => r.caseType === 'discrimination')],
    ['모든 턴에서 기능 추천이 비어 있지 않음', results.every((r) => (r.ranking || []).length > 0)],
    ['모든 턴에서 근거 조문이 있음', results.every((r) => (r.citations || []).length > 0)],
    ['법 조항을 물은 턴(2·3번째)의 답변에 조문 이름이 들어 있음', [1, 2].every((i) => /제\d+조/.test(results[i].reply))],
    ['검색에 없는 조문 번호를 말하지 않음', results.every((r) => !/제76조(?!의)/.test(r.reply))],
    ['눌러서 답하는 문장이 요청문("~해 주세요")이 아님', results.every((r) => (r.suggestions || []).every((s) => !/주세요/.test(s)))],
    ['답변에 내부 표식(E3 등)이 남지 않음', results.every((r) => !/\bE\d+\b/.test(r.reply))],
  ];
  console.log('\n점검 결과');
  for (const [name, pass] of ok) console.log(` ${pass ? '통과' : '실패'}  ${name}`);
  process.exit(ok.every(([, p]) => p) ? 0 : 1);
})();
