import type { ReactNode } from 'react'
import { useStore } from '@/store'
import logo from '@/assets/logo.png'

// 고용노동부 진정서 양식. PDF/인쇄용이라 shadcn 색상 변수 대신 print.css의 고정 색을 사용합니다.
const fmtDate = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[1]}. ${+m[2]}. ${+m[3]}.` : ''
}
const Chk = ({ sel, opts }: { sel: string; opts: string[] }) => (
  <>{opts.map((o, i) => <span key={o}>{i > 0 && '     '}{o === sel ? '☑' : '□'} {o}</span>)}</> // taste-skill-ignore: 실제 진정서 양식 체크박스 글리프
)
const Row4 = ({ l1, r1, l2, r2 }: { l1: ReactNode; r1: ReactNode; l2: ReactNode; r2: ReactNode }) => (
  <tr><th>{l1}</th><td>{r1}</td><th>{l2}</th><td>{r2}</td></tr>
)
const Row2 = ({ l, r, cls }: { l: ReactNode; r: ReactNode; cls?: string }) => (
  <tr><th>{l}</th><td colSpan={3} className={cls}>{r}</td></tr>
)
const Cols = () => (
  <colgroup><col style={{ width: '19%' }} /><col style={{ width: '31%' }} /><col style={{ width: '19%' }} /><col style={{ width: '31%' }} /></colgroup>
)

export default function ComplaintDoc() {
  const { form: f } = useStore()
  const v = (s: string) => s.trim()
  return (
    <div className="hform">
      <h1>진 정 서</h1>
      <h2>1. 진정인</h2>
      <table><Cols /><tbody>
        <Row4 l1="성 명" r1={v(f.pName)} l2="주민등록번호" r2={v(f.pRrn)} />
        <Row2 l="주 소" r={v(f.pAddr)} />
        <Row4 l1="전 화 번 호" r1={v(f.pTel)} l2="휴대전화번호" r2={v(f.pMobile)} />
        <Row2 l="전자우편주소" r={v(f.pEmail)} />
        <Row4 l1="처리상황 수신여부" r1={<Chk sel={f.pRecv} opts={['예', '아니오']} />} l2="노동포털 통지여부" r2={<Chk sel={f.pPortal} opts={['예', '아니오']} />} />
      </tbody></table>
      <h2>2. 피진정인</h2>
      <table><Cols /><tbody>
        <Row4 l1="성 명" r1={v(f.rBoss)} l2="연 락 처" r2={v(f.rTel)} />
        <Row2 l="주 소" r={v(f.rAddr)} />
        <Row2 l="사업체 구분" r={<Chk sel={f.rKind} opts={['사업장', '공사현장']} />} />
        <Row2 l="사 업 장 명" r={v(f.rName)} />
        <Row2 l={<>사업장 주소<br />(실근무장소)</>} r={v(f.rBizAddr)} cls="tall" />
        <Row4 l1="사업장전화번호" r1={v(f.rBizTel)} l2="근 로 자 수" r2={v(f.rCount)} />
      </tbody></table>
      <h2>3. 진정 내용</h2>
      <table><Cols /><tbody>
        <Row4 l1="입 사 일" r1={fmtDate(f.startDate)} l2="퇴 사 일" r2={fmtDate(f.endDate)} />
        <Row4 l1="체불임금총액" r1={v(f.wageTotal)} l2="퇴 직 여 부" r2={<Chk sel={f.retired} opts={['퇴직', '재직']} />} />
        <Row4 l1="체불퇴직금액" r1={v(f.retireAmt)} l2="기타체불금액" r2={v(f.etcAmt)} />
        <Row2 l="업 무 내 용" r={v(f.duty)} />
        <Row4 l1="임금 지급일" r1={v(f.payDay)} l2="근로계약방법" r2={<Chk sel={f.contractType} opts={['서면', '구두']} />} />
        <Row2 l="내 용" r={f.draft} cls="ta" />
        <Row2 l="파 일 첨 부" r={v(f.attach)} />
      </tbody></table>
      <div className="to">( {v(f.office) || ' '.repeat(8)} )고용노동(지)청장 귀하</div>
      {/* 공식 양식 머리 부분은 그대로 두고, 작성 보조 표시에만 로고를 붙임 */}
      <div className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={logo} alt="HoLab 로고" style={{ height: 22, width: 'auto' }} />
        <span>※ 본 문서는 HoLab 에이전트가 작성을 보조한 참고용 초안이며 법률 자문이 아닙니다. 제출 전 내용의 사실 여부를 직접 확인하시기 바랍니다.</span>
      </div>
    </div>
  )
}

