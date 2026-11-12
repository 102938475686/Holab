import { useStore } from '@/store'
import { won, type CalcResult } from '@/lib/calc'
import logo from '@/assets/logo.png'
import { calcIssues, clauseIssues, dedupeIssues, verdictOf } from '@/lib/legal'

// 노무사 대면 상담 전에 들고 갈 "1장 리포트". 짧은 상담 시간에 본론부터 말할 수 있도록
// 상황 요약·핵심 금액·계약서 점검 결과·물어볼 질문을 한 장으로 정리합니다. PDF 캡처용이라 색상은 고정값(hex) 사용.
function Bullets({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean)
  if (!lines.length) return <p className="rempty">정리된 내용이 없습니다.</p>
  return <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
}

// 노무사 사무실에 가져갈 증빙자료: 기본 자료 + 지금까지 확인된 쟁점에 맞춘 자료
export function evidenceList(calc: CalcResult | null, titles: string[], hasContract: boolean): { id: string; label: string; why: string }[] {
  const t = titles.join(' ')
  const out = [
    { id: 'contract', label: '근로계약서 (원본 또는 사진)', why: hasContract ? '분석한 조항을 노무사가 직접 확인해요' : '없다면 "계약서를 받지 못했다"는 것도 상담 내용이에요' },
    { id: 'payslip', label: '급여명세서', why: '실제로 어떤 항목이 지급됐는지 확인해요' },
    { id: 'bank', label: '월급이 들어온 통장 거래내역', why: '실제 받은 금액의 가장 확실한 증거예요' },
    { id: 'attend', label: '출퇴근 기록 (근무표, 메신저 근무 공지, 교통카드 내역 등)', why: calc && (calc.holUnpaid > 0 || calc.extraUnpaid > 0) ? '주휴·가산수당은 실제 근무시간이 핵심 근거예요' : '실제로 일한 시간을 보여줘요' },
    { id: 'msg', label: '사장님·관리자와 나눈 문자·카톡', why: '근무 지시, 임금 약속, 거절한 내용을 보여줘요' },
  ]
  if (calc && calc.minWageUnpaid > 0) out.push({ id: 'wage', label: '시급이 적힌 자료 (채용 공고, 계약서, 대화 캡처)', why: '최저임금보다 낮게 약속된 사실을 보여줘요' })
  if (/괴롭힘|폭언|폭행|차별|성희롱/.test(t)) out.push({ id: 'harass', label: '폭언·괴롭힘 기록 (녹음, 메시지, 날짜별 메모, 목격자 연락처)', why: '언제 어떤 일이 있었는지가 중요해요' })
  if (/해고|해고예고/.test(t)) out.push({ id: 'fire', label: '해고 통보 내용 (문자, 서면, 녹음)', why: '해고 날짜와 방식을 확인해요' })
  if (/퇴직금|퇴직급여/.test(t)) out.push({ id: 'retire', label: '입사·퇴사일을 알 수 있는 자료 (4대보험 가입내역 등)', why: '1년 이상 일했는지 확인해요' })
  if (/재해|산재|부상/.test(t)) out.push({ id: 'injury', label: '병원 진료기록·진단서', why: '일하다 다친 사실을 보여줘요' })
  out.push({ id: 'id', label: '신분증', why: '상담 접수 때 필요할 수 있어요' })
  return out
}

export default function ReportDoc({ interactive = false }: { interactive?: boolean }) {
  const { report, setReport, calc, analysis, form, legalConsult, masked, pasteText } = useStore()
  // 관련 법 조항: 계약서처럼 확실한 자료가 있으면 "위반이에요", 말한 내용만 있으면 "해당될 수 있어요"
  const legal = dedupeIssues([...clauseIssues(analysis), ...(calc ? calcIssues(calc, masked || pasteText, analysis) : []), ...legalConsult])
  const evidence = evidenceList(calc, legal.map((x) => x.title), !!analysis)
  const have = report?.have ?? []
  const toggle = (id: string) => report && setReport({ ...report, have: have.includes(id) ? have.filter((h) => h !== id) : [...have, id] })
  const today = new Date()
  const dateStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`

  return (
    <div className="hreport">
      <div className="rhead">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logo} alt="HoLab 로고" style={{ height: 40, width: 'auto' }} />
          <div>
          <h1>상담 준비 리포트</h1>
          <p className="rsub">HoLab이 앞서 입력한 내용(상담·못 받은 돈·계약서 쟁점)으로 자동 작성한 참고용 요약 — 노무사 상담 전에 들고 가세요</p>
          </div>
        </div>
        <div className="rmeta">
          작성일 {dateStr}<br />
          {report?.lawyerName ? `상담 대상: ${report.lawyerName}` : ''}
        </div>
      </div>

      <h2>상황 요약</h2>
      <Bullets text={report?.summary ?? ''} />

      {calc && (
        <>
          <h2>핵심 금액</h2>
          <table className="rtable"><tbody>
            <tr><th>주휴수당</th><td>{calc.holUnpaid > 0 ? won(calc.holUnpaid) : '해당 없음'}</td><th>가산수당</th><td>{calc.extraUnpaid > 0 ? won(calc.extraUnpaid) : '해당 없음'}</td></tr>
            <tr><th>최저임금 차액</th><td>{calc.minWageUnpaid > 0 ? won(calc.minWageUnpaid) : '해당 없음'}</td><th>미지급 추정 합계</th><td className="rstrong">{won(calc.total)}</td></tr>
          </tbody></table>
        </>
      )}

      {(analysis?.clauses?.length || analysis?.missing?.length) ? (
        <>
          <h2>계약서 점검 결과</h2>
          <ul>
            {(analysis?.clauses ?? []).map((c, i) => <li key={'c' + i}>{c.title}{c.issue ? ` — ${c.issue}` : ''}</li>)}
            {(analysis?.missing ?? []).length > 0 && <li>계약서에서 확인되지 않은 항목: {(analysis?.missing ?? []).join(', ')}</li>}
          </ul>
        </>
      ) : null}

      {legal.length > 0 && (
        <>
          <h2>관련 법 조항 (자동 정리)</h2>
          <ul>
            {legal.map((x) => <li key={x.key}><b>{x.title}</b> — {verdictOf(x.basis)}{x.basis === 'document' && x.quote ? ` “${x.quote}”` : ''}</li>)}
          </ul>
          <p className="rempty">“위반이에요”는 계약서 등 확실한 자료가 근거인 경우, “해당될 수 있어요”는 말씀하신 내용만 있어 사실 확인이 더 필요한 경우예요.</p>
        </>
      )}

      <h2>가져갈 증빙자료 체크리스트</h2>
      <ul className="rcheck">
        {evidence.map((e) => {
          const on = have.includes(e.id)
          return (
            <li key={e.id}>
              {interactive
                ? <button type="button" className={'rbox' + (on ? ' on' : '')} aria-pressed={on} aria-label={`${e.label} 준비됨 표시`} onClick={() => toggle(e.id)}>{on ? '✓' : ''}</button>
                : <span className={'rbox' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>}
              <span><b>{e.label}</b> <span className="rwhy">— {e.why}</span></span>
            </li>
          )
        })}
      </ul>
      <p className="rempty">없는 자료가 있어도 상담은 받을 수 있어요. 갖고 있는 것만 챙겨 가세요.</p>

      <div className="rquestions">
        <h2>상담에서 물어볼 질문</h2>
        <ol>{(report?.questions ?? []).map((q, i) => <li key={i}>{q}</li>)}</ol>
      </div>

      <div className="rfoot">
        {form.pName.trim() && <>작성자: {form.pName.trim()}　</>}
        본 리포트는 HoLab 에이전트가 정리한 참고용 자료이며 법률 자문이 아닙니다. 상담 시 노무사와 함께 사실 관계를 다시 확인하세요.
      </div>
    </div>
  )
}

