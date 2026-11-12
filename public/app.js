// HoLab! 프론트엔드 - 계산 / OCR+마스킹 / 분석 / 진정서 / 노무사 매칭(가상)
const MIN_WAGE = 10320; // 2026년 최저임금
const WEEKS_PER_MONTH = 4.345;
const $ = (id) => document.getElementById(id);
const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { calc: null, masked: '', analysis: null, draftDemo: false, pdfDone: false };

// ---------- 스텝 이동 ----------
function go(n) {
  showView('wizard');
  for (let i = 1; i <= 4; i++) {
    $('step' + i).classList.toggle('hidden', i !== n);
    const b = document.querySelector(`#steps button[data-step="${i}"]`);
    b.classList.toggle('active', i === n);
  }
  if (n === 3) { renderFacts(); prefillForm(); }
  if (n === 4) renderMatches();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('#steps button').forEach((b) => (b.onclick = () => go(+b.dataset.step)));
const markDone = (n) => document.querySelector(`#steps button[data-step="${n}"]`).classList.add('done');

// ---------- AI 상태 ----------
fetch('/api/status').then((r) => r.json()).then((s) => {
  const b = $('aiBadge');
  b.textContent = s.hasKey ? `AI 연결됨 (${s.model})` : 'AI 키 없음 · 대체 응답 모드';
}).catch(() => { $('aiBadge').textContent = '서버 연결 안 됨'; });

// ---------- ① 계산 ----------
function calculate() {
  const hourly = +$('hourly').value, weekly = +$('weekly').value, months = +$('months').value || 0;
  if (!hourly || !weekly) { alert('시급과 주 근로시간을 입력하세요.'); return null; }
  const ot = +$('ot').value || 0, night = +$('night').value || 0, hol = +$('hol').value || 0;
  const under5 = $('under5').checked, holidayPaid = $('holidayPaid').checked, extraPaid = $('extraPaid').checked, full = $('fullAttend').checked;
  const weeks = months * WEEKS_PER_MONTH;

  const eligible = weekly >= 15 && full;
  const holHours = eligible ? Math.min(weekly, 40) / 40 * 8 : 0;
  const weeklyHolPay = holHours * hourly;
  const extraWeekly = under5 ? 0 : hourly * 0.5 * (ot + night + hol); // 가산분?(50%)
  const basePay = hourly * weekly; // 주 기본급

  const minWageGap = Math.max(0, MIN_WAGE - hourly);
  const minWageUnpaid = minWageGap * weekly * weeks;
  const holUnpaid = holidayPaid ? 0 : weeklyHolPay * weeks;
  const extraUnpaid = extraPaid ? 0 : extraWeekly * weeks;
  const total = holUnpaid + extraUnpaid + minWageUnpaid;

  const monthlyDue = (basePay + weeklyHolPay + extraWeekly + (ot + night + hol) * hourly) * WEEKS_PER_MONTH;
  return { hourly, weekly, months, weeks, ot, night, hol, under5, holidayPaid, extraPaid, eligible, holHours, weeklyHolPay, extraWeekly, basePay, minWageGap, minWageUnpaid, holUnpaid, extraUnpaid, total, monthlyDue };
}

function renderCalc(c) {
  const bad = c.total > 0;
  let rows = `
    <tr><td>주 기본급 (${c.hourly.toLocaleString()}원 × ${c.weekly}시간)</td><td>${won(c.basePay)}</td></tr>
    <tr><td>주휴수당 (주 ${c.holHours.toFixed(1)}시간분)</td><td>${c.eligible ? won(c.weeklyHolPay) : '해당 없음'}</td></tr>
    <tr><td>연장·야간·휴일 가산수당 (주)</td><td>${c.under5 ? '5인 미만 – 미적용' : won(c.extraWeekly)}</td></tr>
    <tr><td><b>월 예상 받아야 할 급여 (세전)</b></td><td><b>${won(c.monthlyDue)}</b></td></tr>`;
  const notes = [];
  if (c.weekly < 15) notes.push('주 15시간 미만 근로는 주휴수당 지급 대상이 아닙니다.');
  if (!c.eligible && c.weekly >= 15) notes.push('개근하지 않으면 주휴수당이 발생하지 않을 수 있습니다.');
  if (c.under5) notes.push('5인 미만 사업장은 연장·야간·휴일 가산수당이 적용되지 않지만, 주휴수당과 최저임금은 적용됩니다.');
  if (c.minWageGap > 0) notes.push(`⚠️ 시급이 2026년 최저임금(${MIN_WAGE.toLocaleString()}원)보다 ${c.minWageGap.toLocaleString()}원 낮습니다.`);
  $('calcResult').innerHTML = `
    <div class="result-hero ${bad ? '' : 'good'}">
      ${bad ? `<div>확인된 <b>미지급 추정액</b> (${c.months || 0}개월 기준)</div><div class="big">${won(c.total)}</div>
      <div class="note">주당 주휴수당 <b>${won(c.weeklyHolPay)}</b>${c.holidayPaid ? '' : ' 미지급'} · 임금채권 소멸시효는 3년입니다.</div>`
      : `<div class="big">미지급 추정액 없음</div><div class="note">입력하신 조건에서는 미지급 항목이 확인되지 않았습니다.</div>`}
    </div>
    <table class="t"><tbody>${rows}</tbody></table>
    ${bad ? `<table class="t"><thead><tr><th>미지급 항목</th><th>금액</th></tr></thead><tbody>
      <tr><td>주휴수당</td><td>${won(c.holUnpaid)}</td></tr>
      <tr><td>가산수당</td><td>${won(c.extraUnpaid)}</td></tr>
      <tr><td>최저임금 차액</td><td>${won(c.minWageUnpaid)}</td></tr>
      <tr><td><b>합계</b></td><td><b>${won(c.total)}</b></td></tr></tbody></table>` : ''}
    ${notes.map((n) => `<div class="note">• ${esc(n)}</div>`).join('')}
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" onclick="go(2)">다음: 근로계약서 분석 →</button>
      ${bad ? `<button class="btn primary" onclick="go(3)">바로 진정서 작성 →</button>` : ''}
    </div>`;
}
$('btnCalc').onclick = () => { const c = calculate(); if (!c) return; S.calc = c; renderCalc(c); markDone(1); };

// ---------- ② OCR + 마스킹 ----------
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('tabPhoto').classList.toggle('hidden', t.dataset.tab !== 'photo');
  $('tabPaste').classList.toggle('hidden', t.dataset.tab !== 'paste');
}));

const NAME = '[가-힣](?:[ \\t]?[가-힣]){1,2}(?![가-힣])';
const MASK_RULES = [
  [/\d{6}\s?[-–~]\s?[1-4]\d{6}/g, '[주민등록번호]'],
  [/01[016789]\s?[-–.]?\s?\d{3,4}\s?[-–.]?\s?\d{4}/g, '[연락처]'],
  [/0\d{1,2}\s?[-–]\s?\d{3,4}\s?[-–]\s?\d{4}/g, '[연락처]'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[이메일]'],
  [/\d{2,6}[-–]\d{2,6}[-–]\d{2,8}(?:[-–]\d{1,4})?/g, '[계좌/번호]'],
  [new RegExp('((?:사업주|근로자|대표자|대표|성명|이름)\\s*(?:성명)?\\s*[:：]\\s*)' + NAME, 'g'), '$1[이름]'],
  [/((?:사업장\s*)?주소\s*[:：]?\s*)[^\n]+/g, '$1[주소]'],
];
function maskText(text) {
  let count = 0, out = text;
  for (const [re, rep] of MASK_RULES) out = out.replace(re, (...a) => { count++; return rep.replace(/\$1/g, typeof a[1] === 'string' ? a[1] : ''); });
  return { out, count };
}

function showMasked(text) {
  const { out, count } = maskText(text);
  S.masked = out;
  $('maskedText').value = out;
  $('maskCount').textContent = `(${count}곳 가림)`;
  $('maskBox').classList.remove('hidden');
  $('analysisResult').innerHTML = '';
  $('maskBox').scrollIntoView({ behavior: 'smooth' });
}

function showRetry(msg) {
  const el = $('ocrRetry');
  el.innerHTML = `<b>📸 사진을 다시 올려 주세요.</b><br>${esc(msg)}<br><small>팁: 밝은 곳에서, 계약서 전체가 화면에 꽉 차게, 그림자·반사 없이 정면으로 찍어 주세요.</small>`;
  el.classList.remove('hidden');
  $('maskBox').classList.add('hidden');
}

async function runOcr(imageSource) {
  $('ocrRetry').classList.add('hidden');
  $('ocrProgress').classList.remove('hidden');
  const setP = (p, t) => { $('ocrBar').style.width = p + '%'; $('ocrText').textContent = t; };
  setP(3, '글자 인식 엔진 준비 중…');
  try {
    if (typeof Tesseract === 'undefined') throw new Error('OCR 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하세요.');
    const { data } = await Tesseract.recognize(imageSource, 'kor+eng', {
      logger: (m) => { if (m.status === 'recognizing text') setP(10 + m.progress * 88, `글자 인식 중… ${Math.round(m.progress * 100)}%`); else if (m.status) setP(6, '언어 데이터 불러오는 중…'); },
    });
    $('ocrProgress').classList.add('hidden');
    const text = (data.text || '').trim();
    const hangul = (text.match(/[가-힣]/g) || []).length;
    const hasKey = /(시급|임금|근로시간|근무|계약)/.test(text);
    if (data.confidence < 55 || hangul < 40 || !hasKey) {
      return showRetry(`글자를 또렷하게 읽지 못했습니다. (인식 신뢰도 ${Math.round(data.confidence)}%, 읽은 한글 ${hangul}자)`);
    }
    showMasked(text);
  } catch (e) {
    $('ocrProgress').classList.add('hidden');
    showRetry('인식 중 문제가 발생했습니다: ' + e.message);
  }
}

$('file').onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  $('preview').src = url; $('preview').classList.remove('hidden');
  runOcr(url);
};
$('btnUsePaste').onclick = () => {
  const t = $('pasteText').value.trim();
  if (t.length < 20) return alert('계약서 내용을 붙여넣어 주세요.');
  showMasked(t);
};

$('btnAnalyze').onclick = async () => {
  const btn = $('btnAnalyze'); btn.disabled = true; btn.textContent = '분석 중…';
  try {
    const r = await fetch('/api/analyze-contract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maskedText: $('maskedText').value }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || '분석 실패');
    S.analysis = data; renderAnalysis(data); markDone(2);
  } catch (e) { $('analysisResult').innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
  btn.disabled = false; btn.textContent = 'AI로 계약서 분석하기';
};

const SEV = { high: '위험', medium: '주의', low: '참고' };
function renderAnalysis(a) {
  $('analysisResult').innerHTML = `
    <h3>📋 분석 결과 ${a.demo ? '<span class="badge demo">규칙 기반 점검</span>' : '<span class="badge ok">AI 분석</span>'}</h3>
    <p>${esc(a.summary || '')}</p>
    ${(a.clauses || []).map((c) => `<div class="clause ${esc(c.severity)}">
      <span class="sev ${esc(c.severity)}">${SEV[c.severity] || '참고'}</span><b>${esc(c.title)}</b>
      ${c.quote ? `<q>“${esc(c.quote)}”</q>` : ''}<div>${esc(c.issue)}</div><div class="law">${esc(c.law || '')}</div>${c.lawText ? `<details class="lawtext"><summary>📖 조문 원문 보기 · ${esc(c.lawText.name)} ${esc(c.lawText.article)}${c.lawText.title ? `(${esc(c.lawText.title)})` : ''}</summary><div class="lawbody">${esc(c.lawText.text)}</div><div class="lawsrc">출처: 법제처 국가법령정보센터 (참고용 · 최신 원문은 law.go.kr에서 확인)</div></details>` : ''}</div>`).join('') || '<p>문제 소지가 있는 조항이 발견되지 않았습니다.</p>'}
    ${(a.missing || []).length ? `<h3>계약서에 없거나 확인이 안 된 항목</h3>${a.missing.map((m) => `<span class="chip">${esc(m)}</span>`).join('')}<div class="note">근로계약서에는 임금, 소정근로시간, 휴일, 연차휴가 등이 명시되어야 합니다. (근로기준법 제17조)</div>` : ''}
    <div style="margin-top:16px"><button class="btn primary" onclick="go(3)">다음: 진정서 작성 →</button></div>`;
}

// ---------- ③ 진정서 (고용노동부 진정서 양식) ----------
const F = (id) => $(id).value.trim();
function issueList() {
  const out = [];
  const c = S.calc;
  if (c && c.holUnpaid > 0) out.push(`주휴수당 미지급 (주당 ${won(c.weeklyHolPay)})`);
  if (c && c.extraUnpaid > 0) out.push('연장·야간·휴일 가산수당 미지급');
  if (c && c.minWageUnpaid > 0) out.push(`최저임금 미달 (시급 ${c.hourly.toLocaleString()}원)`);
  for (const cl of (S.analysis?.clauses || [])) if (cl.severity !== 'low') out.push(`계약서 조항 문제: ${cl.title}`);
  return out;
}
function buildFacts() {
  const c = S.calc || {};
  return {
    hourly: c.hourly, weeklyHours: c.weekly, workedPeriod: c.months ? `${c.months}개월` : undefined,
    under5: !!c.under5, weeklyHolidayPay: Math.round(c.weeklyHolPay || 0), totalUnpaid: Math.round(c.total || 0),
    unpaidBreakdown: { 주휴수당: Math.round(c.holUnpaid || 0), 가산수당: Math.round(c.extraUnpaid || 0), 최저임금차액: Math.round(c.minWageUnpaid || 0) },
    issues: issueList(),
  };
}
function renderFacts() {
  const c = S.calc;
  $('facts').innerHTML = c
    ? `<b>AI에 전달되는 사실관계</b> (인적사항 제외)<br>시급 ${c.hourly.toLocaleString()}원 · 주 ${c.weekly}시간 · ${c.months}개월 · 미지급 추정 ${won(c.total)}${issueList().length ? '<br>' + issueList().map((i) => `<span class="chip">${esc(i)}</span>`).join('') : ''}`
    : '⚠️ ①단계에서 임금 계산을 먼저 하면 초안이 더 정확해집니다.';
}
// 계산 결과·계약서(마스킹본)에서 알 수 있는 항목을 빈 칸에만 자동 입력
function prefillForm() {
  const set = (id, val) => { if (val && !$(id).value.trim()) $(id).value = val; };
  const c = S.calc, m = S.masked || '';
  if (c && c.total > 0) { set('wageTotal', won(c.total)); set('etcAmt', won(c.total)); }
  const pick = (re) => { const x = m.match(re); return x ? x[1].trim() : ''; };
  set('duty', pick(/업무\s*내용\s*[:：]\s*([^\n]+)/));
  set('payDay', pick(/임금\s*지급일\s*[:：]\s*([^\n]+)/));
  set('rName', pick(/사업장\s*명\s*[:：]\s*([^\n]+)/));
  const cnt = pick(/근로자\s*수\s*[:：]\s*(\d+)/); if (cnt) set('rCount', cnt + '명');
  const sd = m.match(/근로\s*개시일\s*[:：]\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (sd) set('startDate', `${sd[1]}-${sd[2].padStart(2, '0')}-${sd[3].padStart(2, '0')}`);
  if (/(서면|근로계약서)/.test(m)) $('contractType').value = '서면';
  $('retired').value = $('endDate').value ? '퇴직' : '재직';
}
$('endDate').onchange = () => { $('retired').value = $('endDate').value ? '퇴직' : '재직'; };

$('btnDraft').onclick = async () => {
  const btn = $('btnDraft'); btn.disabled = true; btn.textContent = '작성 중…';
  try {
    const r = await fetch('/api/draft-complaint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildFacts()) });
    const d = await r.json();
    $('draftText').value = d.text;
    const b = $('draftBadge'); b.classList.remove('hidden');
    b.className = 'badge ' + (d.demo ? 'demo' : 'ok'); b.textContent = d.demo ? '기본 서식 초안' : 'AI 초안';
  } catch (e) { alert('초안 생성 실패: ' + e.message); }
  btn.disabled = false; btn.textContent = '✨ AI로 진정 내용(내용 란) 초안 만들기';
  updatePdfBtn();
};
const updatePdfBtn = () => { const ok = $('agree1').checked && $('draftText').value.trim().length > 20; $('btnPdf').disabled = !ok; $('btnPrint').disabled = !ok; };
$('agree1').onchange = updatePdfBtn; $('draftText').oninput = updatePdfBtn;

const fmtDate = (s) => { const m = (s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[1]}. ${+m[2]}. ${+m[3]}.` : ''; };
const chk = (sel, opts) => opts.map((o) => (o === sel ? '☑' : '□') + ' ' + o).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
function buildDoc() {
  const v = (id) => esc(F(id));
  const row4 = (l1, r1, l2, r2) => `<tr><th>${l1}</th><td>${r1}</td><th>${l2}</th><td>${r2}</td></tr>`;
  const row2 = (l, r, cls = '') => `<tr><th>${l}</th><td colspan="3" class="${cls}">${r}</td></tr>`;
  const cols = '<colgroup><col style="width:19%"><col style="width:31%"><col style="width:19%"><col style="width:31%"></colgroup>';
  return `<div class="hform">
    <h1>진 정 서</h1>
    <h2>1. 진정인</h2>
    <table>${cols}
      ${row4('성 명', v('pName'), '주민등록번호', v('pRrn'))}
      ${row2('주 소', v('pAddr'))}
      ${row4('전 화 번 호', v('pTel'), '휴대전화번호', v('pMobile'))}
      ${row2('전자우편주소', v('pEmail'))}
      ${row4('처리상황 수신여부', chk($('pRecv').value, ['예', '아니오']), '노동포털 통지여부', chk($('pPortal').value, ['예', '아니오']))}
    </table>
    <h2>2. 피진정인</h2>
    <table>${cols}
      ${row4('성 명', v('rBoss'), '연 락 처', v('rTel'))}
      ${row2('주 소', v('rAddr'))}
      ${row2('사업체 구분', chk($('rKind').value, ['사업장', '공사현장']))}
      ${row2('사 업 장 명', v('rName'))}
      ${row2('사업장 주소<br>(실근무장소)', v('rBizAddr'), 'tall')}
      ${row4('사업장전화번호', v('rBizTel'), '근 로 자 수', v('rCount'))}
    </table>
    <h2>3. 진정 내용</h2>
    <table>${cols}
      ${row4('입 사 일', esc(fmtDate($('startDate').value)), '퇴 사 일', esc(fmtDate($('endDate').value)))}
      ${row4('체불임금총액', v('wageTotal'), '퇴 직 여 부', chk($('retired').value, ['퇴직', '재직']))}
      ${row4('체불퇴직금액', v('retireAmt'), '기타체불금액', v('etcAmt'))}
      ${row2('업 무 내 용', v('duty'))}
      ${row4('임금 지급일', v('payDay'), '근로계약방법', chk($('contractType').value, ['서면', '구두']))}
      <tr><th>내 용</th><td colspan="3" class="ta">${esc($('draftText').value)}</td></tr>
      ${row2('파 일 첨 부', v('attach'))}
    </table>
    <div class="to">( ${esc(F('office')) || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} )고용노동(지)청장 귀하</div>
    <div class="note">※ 본 문서는 HoLab! 에이전트가 작성을 보조한 참고용 초안이며 법률 자문이 아닙니다. 제출 전 내용의 사실 여부를 직접 확인하시기 바랍니다.</div>
  </div>`;
}

// 인쇄창 없이 바로 PDF 파일로 저장 (양식을 이미지로 렌더링해 A4 PDF로 변환)
async function savePdf() {
  const el = $('printDoc'); el.innerHTML = buildDoc();
  const prev = el.style.cssText;
  el.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;background:#fff';
  try {
    if (!window.html2canvas || !window.jspdf) throw new Error('PDF 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하거나 [인쇄]를 사용하세요.');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = await html2canvas(el.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297, imgH = canvas.height * pw / canvas.width;
    const img = canvas.toDataURL('image/jpeg', 0.95);
    if (imgH > ph && imgH <= ph * 1.35) {
      // 살짝 넘치면 한 장에 맞춰 축소
      const w = pw * ph / imgH;
      pdf.addImage(img, 'JPEG', (pw - w) / 2, 0, w, ph);
    } else {
      pdf.addImage(img, 'JPEG', 0, 0, pw, imgH);
      for (let left = imgH - ph, y = 0; left > 0; left -= ph) { pdf.addPage(); y -= ph; pdf.addImage(img, 'JPEG', 0, y, pw, imgH); }
    }
    pdf.save(`진정서_${F('pName') || '초안'}.pdf`);
    return true;
  } finally { el.style.cssText = prev; }
}
$('btnPdf').onclick = async () => {
  const b = $('btnPdf'); b.disabled = true; b.textContent = 'PDF 만드는 중…';
  try { if (await savePdf()) askSendToLawyer(); } catch (e) { alert(e.message); }
  b.textContent = '📄 진정서 PDF 다운로드'; updatePdfBtn();
};
$('btnPrint').onclick = () => { $('printDoc').innerHTML = buildDoc(); window.print(); };
// ---------- ④ 노무사 매칭 (가상) ---------- 이후 노무사무소 DB 연결 필요
const LAWYERS = [
  { name: '이하늘 노무사', office: '청년노동 하늘노무법인', region: '서울 마포', tags: ['임금체불', '주휴수당', '청년·알바'], resp: '평균 2시간 내 응답', base: 90 },
  { name: '정도윤 노무사', office: '바른길 노무사무소', region: '서울 영등포', tags: ['부당해고', '근로계약서', '5인 미만'], resp: '평균 4시간 내 응답', base: 82 },
  { name: '한서연 노무사', office: '함께일해 노무사무소', region: '경기 수원', tags: ['임금체불', '가산수당', '최저임금'], resp: '평균 3시간 내 응답', base: 78 },
];
function scoreOf(l) {
  const issues = issueList().join(' ');
  let s = l.base;
  for (const t of l.tags) if (issues.includes(t.replace('·알바', '')) || (t === '5인 미만' && S.calc?.under5)) s += 4;
  return Math.min(99, s);
}
let chosen = null;
function renderMatches() {
  const list = LAWYERS.map((l) => ({ ...l, score: scoreOf(l) })).sort((a, b) => b.score - a.score);
  $('matchList').innerHTML = list.map((l, i) => `
    <div class="lawyer ${i === 0 ? 'top1' : ''}">
      <div class="av">${esc(l.name[0])}</div>
      <div class="info"><b>${esc(l.name)}</b> ${i === 0 ? '<span class="sev high" style="background:var(--gold)">추천 1순위</span>' : ''}<br>
        <span class="note">${esc(l.office)} · ${esc(l.region)} · ${esc(l.resp)} · <b>무료 초기상담</b></span><br>
        ${l.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      <div><div class="score">${l.score}%</div><div class="note">적합도</div>
        <button class="btn primary" data-i="${LAWYERS.indexOf(LAWYERS.find((x) => x.name === l.name))}" onclick="openSend(this.dataset.i)">진정서 보내기</button></div>
    </div>`).join('') + `<p class="note">※ 시연용 가상 노무사 정보입니다. 실제 서비스에서는 등록된 노무사무소 DB와 연동됩니다.</p>`;
}

function modal(html) { $('modalBox').innerHTML = html; $('modal').classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); }
window.closeModal = closeModal;

function askSendToLawyer() {
  modal(`<h3>📄 진정서 PDF가 저장되었습니다</h3>
    <p>작성한 진정서를 <b>무료 노무사</b>에게 보내 검토와 접수 도움을 받아 보시겠어요?</p>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">나중에 할게요</button><button class="btn primary" onclick="closeModal();go(4)">노무사 보러 가기</button></div>`);
}

window.openSend = (i) => {
  chosen = LAWYERS[+i];
  modal(`<h3>${esc(chosen.name)}에게 진정서 보내기</h3>
    <p class="note">${esc(chosen.office)} · ${esc(chosen.region)}</p>
    <p>전달되는 내용: 진정서 본문과 작성하신 인적사항, 계산 결과</p>
    <label class="chk agree"><input id="agree2" type="checkbox" onchange="document.getElementById('goSend').disabled=!this.checked"> 위 내용이 노무사에게 전달되는 데 동의하며, 이는 법률 자문이 아닌 <b>참고용 초안</b>임을 확인했습니다.</label>
    <p class="note"><span class="demo-tag">시연용</span> 실제 전송은 이루어지지 않는 가상 전송입니다.</p>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">취소</button><button id="goSend" class="btn primary" disabled onclick="fakeSend()">전송</button></div>`);
};

window.fakeSend = async () => {
  const steps = ['진정서 PDF 패키징', '노무사 사무소로 전송', '접수 확인 대기'];
  modal(`<h3>전송 중…</h3><div id="sl">${steps.map((s) => `<div class="stepline">⏳ ${s}</div>`).join('')}</div>`);
  const nodes = document.querySelectorAll('#sl .stepline');
  for (let i = 0; i < nodes.length; i++) { await new Promise((r) => setTimeout(r, 900)); nodes[i].classList.add('on'); nodes[i].textContent = '✅ ' + steps[i]; }
  await new Promise((r) => setTimeout(r, 500));
  const no = 'HL-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 9000) + 1000);
  markDone(4);
  modal(`<h3>🎉 노무사 접수 완료</h3>
    <p><b>${esc(chosen.name)}</b>(${esc(chosen.office)})에게 진정서가 접수되었습니다.</p>
    <div class="factsbox">접수번호 <b>${no}</b><br>${esc(chosen.resp)} · 무료 초기상담 배정<br>접수 완료 알림이 등록된 연락처로 발송됩니다.</div>
    <p class="note"><span class="demo-tag">시연용</span> 가상 접수입니다.</p>
    <div class="modal-actions"><button class="btn primary" onclick="closeModal()">확인</button></div>`);
};

// ---------- 샘플(김민수) ----------
const SAMPLE_TEXT = [
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
];
function makeSampleImage() {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 1000;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000'; g.font = 'bold 44px "Malgun Gothic", sans-serif'; g.fillText(SAMPLE_TEXT[0], 70, 90);
  g.font = '34px "Malgun Gothic", sans-serif';
  SAMPLE_TEXT.slice(1).forEach((line, i) => g.fillText(line, 70, 150 + i * 46));
  return c.toDataURL('image/png');
}
$('btnSample').onclick = () => {
  $('hourly').value = 10320; $('weekly').value = 20; $('months').value = 3;
  $('ot').value = 0; $('night').value = 0; $('hol').value = 0;
  $('under5').checked = false; $('holidayPaid').checked = false; $('extraPaid').checked = true; $('fullAttend').checked = true;
  $('pasteText').value = SAMPLE_TEXT.join('\n');
  $('pName').value = '김민수'; $('pRrn').value = '040315-3123456'; $('pAddr').value = '서울특별시 서대문구 (예시 주소)';
  $('pMobile').value = '010-1234-5678'; $('pEmail').value = 'minsu@example.com';
  $('rBoss').value = '박서준'; $('rTel').value = '02-000-0000'; $('rAddr').value = '서울특별시 마포구 월드컵로 123';
  $('rName').value = '해온 카페'; $('rBizAddr').value = '서울특별시 마포구 월드컵로 123'; $('rBizTel').value = '02-000-0000';
  $('rCount').value = '7명'; $('startDate').value = '2026-06-01'; $('duty').value = '음료 제조 및 매장 관리'; $('payDay').value = '매월 10일';
  $('office').value = '서울서부'; $('attach').value = '근로계약서 사본, 급여 입금 내역';  const img = makeSampleImage();
  $('preview').src = img; $('preview').classList.remove('hidden');
  S.calc = calculate(); renderCalc(S.calc);
  go(1);
  alert('김민수 샘플을 불러왔습니다.\n① 계산 결과를 확인하고, ②단계에서 [샘플 계약서 사진으로 OCR 실행] 또는 [텍스트 붙여넣기 → 이 텍스트로 진행]을 눌러 보세요.');
};

// 샘플 계약서 이미지로 OCR 시연 버튼
const ocrBtn = document.createElement('button');
ocrBtn.className = 'btn'; ocrBtn.style.marginTop = '10px'; ocrBtn.textContent = '🧪 샘플 계약서 사진으로 OCR 실행';
ocrBtn.onclick = () => { const img = makeSampleImage(); $('preview').src = img; $('preview').classList.remove('hidden'); runOcr(img); };
$('tabPhoto').appendChild(ocrBtn);


// ================= 시작 화면 · AI 상담 =================
function showView(v) {
  for (const x of ['home', 'chat', 'wizard']) $(x).classList.toggle('hidden', x !== v);
  window.scrollTo(0, 0);
}
window.showView = showView;

// 계약서 사진 첨부 → 바로 계약서 분석 단계(OCR)로
function attachContract(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  go(2);
  $('preview').src = url; $('preview').classList.remove('hidden');
  runOcr(url);
}
$('homeAttach').onclick = () => $('homeFile').click();
$('homeFile').onchange = (e) => { attachContract(e.target.files[0]); e.target.value = ''; };

// 상담 없이 진행하기
$('skipBtn').onclick = () => go(1);
$('btnHome').onclick = () => showView('home');
$('chatBack').onclick = () => { cancelAuto(); showView('home'); };
$('chatSkip').onclick = () => { cancelAuto(); go(1); };
$('homeSample').onclick = () => { showView('wizard'); $('btnSample').click(); };
$('homeInput').oninput = () => $('homeSend').classList.toggle('hidden', !$('homeInput').value.trim());

const chat = { history: [], facts: {}, busy: false, timer: null };
const AUTO_ROUTES = ['contract', 'complaint']; // 이 단계들은 안내 후 자동으로 넘어감
function cancelAuto() { if (chat.timer) { clearInterval(chat.timer); chat.timer = null; } document.querySelectorAll('.cta .count').forEach((e) => e.remove()); }
const ROUTES = {
  calc: '💰 임금 계산 단계', contract: '📄 계약서 분석 단계', complaint: '📝 진정서 작성 보조 단계', lawyer: '🤝 노무사 매칭 단계',
};
function bubble(role, html) {
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.innerHTML = html;
  $('chatLog').appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}
function applyFacts(f) {
  const set = (id, v) => { if (v !== null && v !== undefined && v !== '') $(id).value = v; };
  set('hourly', f.hourly); set('weekly', f.weeklyHours); set('months', f.months);
  if (typeof f.under5 === 'boolean') $('under5').checked = f.under5;
  if (typeof f.holidayPaid === 'boolean') $('holidayPaid').checked = f.holidayPaid;
}
function tryCalc() {
  if ($('hourly').value && $('weekly').value) { const c = calculate(); if (c) { S.calc = c; renderCalc(c); markDone(1); } }
}
function follow(route) {
  applyFacts(chat.facts);
  if (route === 'calc') { tryCalc(); go(1); }
  else if (route === 'contract') go(2);
  else if (route === 'complaint') { if (!S.calc) tryCalc(); go(3); }
  else go(4);
}
window.follow = follow;

async function sendChat(text) {
  text = text.trim();
  if (!text || chat.busy) return;
  chat.busy = true;
  cancelAuto();
  showView('chat');
  $('chatSug').innerHTML = '';
  bubble('user', esc(text));
  chat.history.push({ role: 'user', content: maskText(text).out }); // 개인정보는 가린 뒤 전송
  const typing = bubble('ai typing', '<span></span><span></span><span></span>');
  try {
    const known = S.calc ? { hourly: S.calc.hourly, weeklyHours: S.calc.weekly, months: S.calc.months, totalUnpaid: Math.round(S.calc.total) } : null;
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chat.history, known }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '상담 오류');
    typing.remove();
    chat.history.push({ role: 'assistant', content: d.reply });
    for (const [k, v] of Object.entries(d.extracted || {})) if (v !== null && v !== undefined) chat.facts[k] = v;
    const el = bubble('ai', `<span class="who">HoLab! 상담</span>${esc(d.reply)}`);
    if (d.route && ROUTES[d.route]) {
      const cta = document.createElement('div');
      cta.className = 'cta';
      const auto = AUTO_ROUTES.includes(d.route);
      cta.innerHTML = `${d.route_reason ? `<div class="why">${esc(d.route_reason)}</div>` : ''}<div class="cta-row"><button class="btn primary go">${ROUTES[d.route]}${auto ? '로 지금 이동' : '로 이동'}</button>${auto ? '<button class="btn stay">계속 상담하기</button>' : ''}</div>${auto ? '<div class="count"></div>' : ''}`;
      cta.querySelector('.go').onclick = () => { cancelAuto(); follow(d.route); };
      if (auto) {
        cta.querySelector('.stay').onclick = () => cancelAuto();
        let left = 4;
        const cnt = cta.querySelector('.count');
        cnt.textContent = `${left}초 뒤 자동으로 이동해요`;
        chat.timer = setInterval(() => {
          left--;
          if (left <= 0) { cancelAuto(); follow(d.route); } else cnt.textContent = `${left}초 뒤 자동으로 이동해요`;
        }, 1000);
      }
      el.appendChild(cta);
    }
    $('chatSug').innerHTML = (d.suggestions || []).map((s) => `<button class="ex" type="button">${esc(s)}</button>`).join('');
    $('chatSug').querySelectorAll('.ex').forEach((b) => (b.onclick = () => sendChat(b.textContent)));
  } catch (e) {
    typing.remove();
    bubble('ai', `<span class="who">HoLab! 상담</span>죄송해요, 지금 답변을 가져오지 못했어요. (${esc(e.message)})\n아래 [상담 없이 진행하기]로 바로 이용하실 수도 있어요.`);
  }
  chat.busy = false;
  $('chatInput').focus();
}

$('homeForm').onsubmit = (e) => {
  e.preventDefault();
  const t = $('homeInput').value.trim(); if (!t) return;
  chat.history = []; chat.facts = {}; $('chatLog').innerHTML = '';   // 새 상담 시작
  $('homeInput').value = ''; $('homeSend').classList.add('hidden');
  sendChat(t);
};
document.querySelectorAll('.ex[data-q]').forEach((b) => (b.onclick = () => {
  chat.history = []; chat.facts = {}; $('chatLog').innerHTML = '';
  sendChat(b.dataset.q);
}));
$('chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('chatInput').value; $('chatInput').value = ''; sendChat(t); };
$('chatAttach').onclick = () => $('homeFile').click();

// 첫 화면
showView('home');