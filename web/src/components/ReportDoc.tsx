import { useStore } from '@/store'
import { won } from '@/lib/calc'
import logo from '@/assets/logo.png'
import { calcIssues, clauseIssues, dedupeIssues, verdictOf } from '@/lib/legal'

// 노무사 대면 상담 전에 들고 갈 "1장 리포트". 짧은 상담 시간에 본론부터 말할 수 있도록
// 상황 요약·핵심 금액·계약서 점검 결과·물어볼 질문을 한 장으로 정리합니다. PDF 캡처용이라 색상은 고정값(hex) 사용.
function Bullets({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter(Boolean)
  if (!lines.length) return <p className="rempty">정리된 내용이 없습니다.</p>
  return <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
}

export default function ReportDoc() {
  const { report, calc, analysis, form, legalConsult, masked, pasteText } = useStore()
  // 관련 법 조항: 계약서처럼 확실한 자료가 있으면 "위반이에요", 말한 내용만 있으면 "해당될 수 있어요"
  const legal = dedupeIssues([...clauseIssues(analysis), ...(calc ? calcIssues(calc, masked || pasteText, analysis) : []), ...legalConsult])
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

