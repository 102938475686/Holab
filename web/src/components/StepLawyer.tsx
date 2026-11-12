import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReportDoc from '@/components/ReportDoc'
import { loadReservation } from '@/lib/counsel'
import { ArrowRight, Check, CheckCircle2, ClipboardList, FileDown, Loader2, Mail, MapPin, Navigation, Phone, Receipt, Send, Sparkles, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { draftMailSummary, draftReport, sendComplaintMail } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { won } from '@/lib/calc'
import { distanceKm, fmtKm } from '@/lib/geo'
import CenterMap from '@/components/CenterMap'
import CounselPrep from '@/components/CounselPrep'
import { CALL_QUESTIONS, CENTERS_SOURCE, COMMON_SCOPE, LAWYERS, MAIN_PHONE, SEOUL_COUNSEL, counselorOf, isWide, lawyersOf, mapLink, needTags, rankLawyers, unknownFields, type Lawyer } from '@/lib/lawyers'
import { pdfBase64, savePdf } from '@/lib/pdf'
import { useStore } from '@/store'

// 리포트 미리보기: A4 폭(794px) 양식을 창 폭에 맞춰 축소해서 보여줌 (체크리스트는 여기서 바로 체크 가능)
function ReportPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setZoom(Math.min(1, Math.max(0.6, el.clientWidth / 794))) // 휴대폰에선 너무 작아지지 않게 최소 60% + 가로 스크롤
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="overflow-x-auto rounded-lg border bg-white">
      <div style={{ zoom }}><ReportDoc interactive /></div>
    </div>
  )
}

const validMail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function StepLawyer() {
  const { calc, analysis, markDone, form, ai, consultNotes, report, setReport, go, caseLabel, legalConsult } = useStore()
  const [toAddr, setToAddr] = useState('') // 메일 받는 주소(사용자가 고칠 수 있음)
  const [sel, setSel] = useState<string | null>(null) // 지도·목록에서 고른 센터 (리포트 대상)
  const [subject, setSubject] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [composing, setComposing] = useState(false)
  const [reportFor, setReportFor] = useState<Lawyer | null>(null)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportSaved, setReportSaved] = useState(false)
  const [reportErr, setReportErr] = useState<string | null>(null)
  const [target, setTarget] = useState<Lawyer | null>(null)
  const [agree, setAgree] = useState(false)
  const [phase, setPhase] = useState<'confirm' | 'sending' | 'done'>('confirm')
  const [progress, setProgress] = useState(0)
  const [receipt, setReceipt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')
  const [myLoc, setMyLoc] = useState<{ lat: number; lon: number } | null>(null)
  const [locBusy, setLocBusy] = useState(false)
  const [locErr, setLocErr] = useState<string | null>(null)
  const [sortByDistance, setSortByDistance] = useState(false)
  const [myDistrict, setMyDistrict] = useState<string | null>(null) // 직접 고른 사는 구 (위치 권한 없이 쓰는 경우)
  const [showAll, setShowAll] = useState(false)
  const realMail = !!ai?.mailTo // 서버에 테스트 수신 주소가 설정돼 있으면 실제로 메일 전송

  // 위치는 브라우저 안에서만 거리 계산에 쓰고, 서버로 전송하거나 저장하지 않음
  const findNearby = () => {
    if (!navigator.geolocation) { setLocErr('이 브라우저는 위치 기능을 지원하지 않아요.'); return }
    setLocBusy(true); setLocErr(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMyLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setMyDistrict(null); setSortByDistance(true); setLocBusy(false) },
      (err) => {
        setLocBusy(false)
        setLocErr(err.code === err.PERMISSION_DENIED ? '위치 권한이 거부됐어요. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요.' : '위치를 가져오지 못했어요. 다시 시도해 주세요.')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }
  const districts = useMemo(() => [...new Set(LAWYERS.map((l) => l.region))].sort(), [])
  // 위치 권한 없이 사는 구를 직접 고르는 방법: 그 구 센터 좌표를 기준점으로 사용
  const pickDistrict = (d: string) => {
    // 그 구에 있는 센터들의 중간 지점을 기준점으로 사용 (한 센터 위치를 쓰면 그 센터가 0m로 나와 어색함)
    const cs = LAWYERS.filter((l) => l.region === d)
    if (cs.length) { setMyLoc({ lat: cs.reduce((a, c) => a + c.lat, 0) / cs.length, lon: cs.reduce((a, c) => a + c.lon, 0) / cs.length }); setMyDistrict(d); setSortByDistance(true); setLocErr(null) }
  }
  const STEPS = realMail ? ['메일 내용·첨부 준비', '이메일 전송', '전송 완료 처리'] : ['메일 내용 준비', '가상 전송', '완료 처리']

  // 내 사건에 필요한 분야 (노무사 전담 분야와 겹치는 정도로 적합도를 계산)
  const need = useMemo(() => needTags(
    [caseLabel, ...consultNotes, ...legalConsult.map((x) => x.title), ...(analysis?.clauses ?? []).map((c) => c.title)],
    { unpaid: !!calc && calc.total > 0, minWage: !!calc && calc.minWageUnpaid > 0, holiday: !!calc && calc.holUnpaid > 0, contract: (analysis?.clauses.length ?? 0) > 0 },
  ), [caseLabel, consultNotes, legalConsult, analysis, calc])

  const list = useMemo(() => {
    // 센터는 거리순(위치를 모르면 고른 구 → 광역 센터 → 공개 자료 순). 센터 안 노무사는 임시 데이터이고, 적합도는 고른 센터 안에서 보여 줌
    const scored = LAWYERS.map((l, idx) => {
      const dist = myLoc ? distanceKm(myLoc.lat, myLoc.lon, l.lat, l.lon) : null
      const sameDistrict = !!myDistrict && l.region === myDistrict
      const best = rankLawyers(l, need, dist)[0]
      const why = [
        sameDistrict ? `내가 고른 지역(${myDistrict})에 있어요` : '',
        dist != null && dist >= 0.05 ? `${myDistrict ? '고른 구' : '내 위치'} 기준 ${fmtKm(dist)} 거리예요` : '',
        isWide(l) ? '서울시 광역 센터예요' : '',
        best?.pct != null ? `센터 안 노무사 ${lawyersOf(l).length}명 · 최고 적합도 ${best.pct}%` : `센터 안 노무사 ${lawyersOf(l).length}명`,
      ].filter(Boolean)
      return { ...l, why, dist, sameDistrict, idx }
    })
    return sortByDistance && myLoc
      ? scored.sort((a, b) => Number(b.sameDistrict) - Number(a.sameDistrict) || (a.dist ?? Infinity) - (b.dist ?? Infinity))
      : scored.sort((a, b) => Number(b.sameDistrict) - Number(a.sameDistrict) || Number(isWide(b)) - Number(isWide(a)) || (a.dist ?? 0) - (b.dist ?? 0) || a.idx - b.idx)
  }, [myLoc, myDistrict, sortByDistance, need])
  const mapCenters = useMemo(() => list.map((l, i) => ({ ...l, rank: i + 1 })), [list])
  const reportCenter = list.find((l) => l.name === sel) ?? list[0]
  // 고른 센터 안 노무사: 적합도 순. 직접 고르지 않으면 1순위
  const [selLw, setSelLw] = useState<string | null>(null)
  const lwRank = useMemo(() => rankLawyers(reportCenter, need, reportCenter.dist), [reportCenter, need])
  const chosenLw = (lwRank.find((r) => r.lw.name === selLw) ?? lwRank[0])?.lw
  // 고른 노무사가 바뀌면 받는 주소를 그 노무사 이메일로 채움 (이후 사용자가 직접 고칠 수 있음)
  useEffect(() => { setToAddr(chosenLw?.email ?? reportCenter.email ?? '') }, [chosenLw?.email, reportCenter.name]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (name: string, scroll = true, lawyer: string | null = null) => {
    setSel(name); setSelLw(lawyer)
    if (list.findIndex((l) => l.name === name) >= 5) setShowAll(true)
    if (scroll) setTimeout(() => document.getElementById('center-' + name)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
  }
  const issueText = useMemo(() => {
    const out: string[] = []
    if (calc && calc.holUnpaid > 0) out.push('주휴수당')
    if (calc && calc.extraUnpaid > 0) out.push('가산수당')
    if (calc && calc.minWageUnpaid > 0) out.push('최저임금')
    for (const c of analysis?.clauses ?? []) out.push(c.title)
    return out.slice(0, 4).join('·')
  }, [calc, analysis])

  // 메일 본문: 인적사항·사업장·계산·계약서 점검·AI 상담 내용을 정리해 노무사가 다시 묻지 않아도 되게 함 (주민번호는 본문에 넣지 않음, PDF에만 포함)
  const composeBody = (l: Lawyer, summary: string, no: string) => {
    const line = (k: string, v?: string) => (v && v.trim() ? `- ${k}: ${v.trim()}\n` : '')
    const sec = (t: string, rows: string) => (rows ? `■ ${t}\n${rows}\n` : '')
    const period = form.startDate ? `${form.startDate} ~ ${form.endDate || (form.retired === '재직' ? '재직 중' : '')}` : ''
    const prepared = loadReservation(l.name).checks
    const issues = (analysis?.clauses ?? []).map((c) => `- ${c.title}${c.issue ? ': ' + c.issue : ''}\n`).join('')
    const missing = (analysis?.missing ?? []).length ? `- 계약서에서 확인되지 않은 항목: ${(analysis?.missing ?? []).join(', ')}\n` : ''
    const money = calc && calc.total > 0
      ? line('미지급 추정 합계', won(calc.total)) + line('주휴수당', calc.holUnpaid > 0 ? won(calc.holUnpaid) : '') + line('가산수당', calc.extraUnpaid > 0 ? won(calc.extraUnpaid) : '') + line('최저임금 차액', calc.minWageUnpaid > 0 ? won(calc.minWageUnpaid) : '') + line('기준', `시급 ${calc.hourly.toLocaleString()}원, 주 ${calc.weekly}시간${calc.under5 ? ', 5인 미만 사업장' : ''} (2026년 최저임금 기준 추정치)`)
      : ''
    const lw = chosenLw
    return (
      `${lw ? `${l.name} ${lw.name} 노무사님께` : `${l.name} 담당자님께`},\n\n` +
      `안녕하세요. HoLab(노동권 구제 서비스)를 통해 노동상담을 요청드립니다.\n제 상황은 아래에 정리했고,${form.draft.trim().length >= 20 ? ' 노동청 진정서 초안(PDF)을 첨부합니다.' : ' 필요하시면 진정서 초안도 보내드리겠습니다.'} 같은 내용을 다시 설명드리지 않아도 되도록 미리 정리했습니다.\n\n` +
      sec('사건 요약 (AI 상담 내용 정리)', summary.trim() ? summary.trim() + '\n' : '') +
      sec('진정인', line('성명', form.pName) + line('휴대전화', form.pMobile) + line('이메일', form.pEmail) + line('주소', form.pAddr)) +
      sec('사업장', line('사업장명', form.rName) + line('대표자', form.rBoss) + line('주소', form.rBizAddr) + line('상시 근로자 수', form.rCount)) +
      sec('근로 관계', line('근무 기간', period) + line('업무 내용', form.duty) + line('임금 지급일', form.payDay) + line('계약 형태', form.contractType)) +
      sec('못 받은 돈 확인 결과', money) +
      sec('근로계약서 점검 결과', issues + missing) +
      (prepared.length ? `■ 상담에 준비한 자료 (체크리스트)\n${prepared.map((b) => `- ${b}\n`).join('')}\n` : '') +
      (form.draft.trim().length >= 20 ? `■ 첨부\n- 진정서 PDF (고용노동부 진정서 양식)\n\n` : '') +
      `회신은 위 연락처로 부탁드립니다. 감사합니다.\n\n` +
      `문의번호 ${no}\n※ 본 메일은 HoLab이 정리한 참고용 초안이며 법률 자문이 아닙니다.\n`
    )
  }

  // ── 자동으로 센터 고르기 ── 확인 가능한 사실(같은 구 → 확인된 전담 분야 → 가까운 거리)로만 고르고, 이유를 그대로 보여 줌
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoRes, setAutoRes] = useState<{ name: string; lawyer: string; reasons: string[]; notes: string[]; alts: { name: string; line: string }[]; fromGps: boolean } | null>(null)
  const getPos = () => new Promise<{ lat: number; lon: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 브라우저는 위치 기능을 지원하지 않아요.'))
    navigator.geolocation.getCurrentPosition((pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }), (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? '위치 권한이 거부됐어요.' : '위치를 가져오지 못했어요.')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  })
  const autoPick = async () => {
    setAutoBusy(true); setLocErr(null)
    try {
      let loc = myLoc, fromGps = false
      if (!loc) { loc = await getPos(); fromGps = true; setMyLoc(loc); setMyDistrict(null) }
      // 가까운 센터를 먼저 고르고, 그 센터 안에서 내 사건과 가장 잘 맞는 노무사를 고름
      const ranked = LAWYERS.map((l, idx) => ({ l, dist: distanceKm(loc!.lat, loc!.lon, l.lat, l.lon), same: !!myDistrict && !fromGps && l.region === myDistrict, idx }))
        .sort((a, b) => Number(b.same) - Number(a.same) || a.dist - b.dist || a.idx - b.idx)
      const top = ranked[0]
      const best = rankLawyers(top.l, need, top.dist)[0]
      const reasons = [
        top.same ? `내가 고른 구(${myDistrict})에 있는 센터예요` : '',
        top.dist < 0.05 ? '' : `${myDistrict && !fromGps ? '고른 구 중심' : '내 위치'}에서 ${fmtKm(top.dist)} 거리라 가장 가까워요`,
        best?.pct != null ? `센터 안 노무사 중 내 사건 분야(${need.join('·')})와 가장 잘 맞아요 → 적합도 ${best.pct}%` : '',
        best ? `상담 시간: ${best.lw.hours}` : '',
      ].filter(Boolean)
      const notes = [
        need.length ? '' : '아직 사건 분야를 알 수 없어 노무사는 센터 안 첫 번째로 골랐어요. AI 상담이나 계산·계약서 분석을 하면 분야까지 맞춰 줘요.',
        '노무사 정보는 시연용 임시 데이터(가상 인물)예요. 실제 서비스에서는 센터에서 확인한 정보로 바뀌어요.',
      ].filter(Boolean)
      setAutoRes({ name: top.l.name, lawyer: best?.lw.name ?? '', reasons, notes, fromGps, alts: ranked.slice(1, 3).map((r) => ({ name: r.l.name, line: fmtKm(r.dist) })) })
      setSortByDistance(true)
      pick(top.l.name, false, best?.lw.name)
    } catch (e) {
      setLocErr(e instanceof Error ? e.message : '위치를 가져오지 못했어요.')
    }
    setAutoBusy(false)
  }
  const [copied, setCopied] = useState(false)
  const [cmpBusy, setCmpBusy] = useState(false)
  // 센터에 제출하는 법: 메일 작성창은 짧은 본문만 채우고(길면 메일 앱이 잘라 냄), 자세한 본문은 복사해서 붙여 넣게 함. 발송·첨부는 사용자가 직접 해요
  const mailtoOf = (l: Lawyer) => l.email
    ? `mailto:${l.email}?subject=${encodeURIComponent('[노동상담 요청] 임금·근로조건 상담 신청')}&body=${encodeURIComponent('안녕하세요. 노동상담을 요청드립니다.\n상황은 첨부한 상담 준비 리포트(PDF)에 정리했습니다.\n회신은 이 메일로 부탁드립니다.')}`
    : ''
  const copyMail = async (l: Lawyer) => {
    const body = composeBody(l, consultNotes.map((n) => '- ' + n).join('\n'), '-')
    try { await navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch { /* 복사 권한이 없으면 무시 */ }
  }
  const saveComplaintPdf = async () => {
    const el = document.getElementById('printDoc')
    if (!el) return
    setCmpBusy(true)
    try { await savePdf(el, `진정서_${form.pName.trim() || '초안'}.pdf`) } catch (e) { alert(e instanceof Error ? e.message : 'PDF 생성 실패') }
    setCmpBusy(false)
  }

  // 서버 AI 요청에 공통으로 쓰는 입력(계산·계약서 점검·상담 메모) — 개인정보는 포함하지 않음
  const buildFacts = () => {
    const c = calc
    return {
      facts: c ? { hourly: c.hourly, weeklyHours: c.weekly, workedPeriod: c.months ? `${c.months}개월` : undefined, under5: !!c.under5, totalUnpaid: Math.round(c.total), unpaidBreakdown: { 주휴수당: Math.round(c.holUnpaid), 가산수당: Math.round(c.extraUnpaid), 최저임금차액: Math.round(c.minWageUnpaid) } } : {},
      notes: [...consultNotes, ...form.timeline.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '경과: ' + l)],
      clauses: (analysis?.clauses ?? []).map((x) => ({ title: x.title, issue: x.issue })),
      missing: analysis?.missing ?? [],
    }
  }

  const open = async (l: Lawyer) => {
    const no = 'HL-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + (Math.floor(Math.random() * 9000) + 1000)
    setTarget(l); setAgree(false); setPhase('confirm'); setProgress(0); setError(null); setSentTo('')
    setReceipt(no); setSubject(`[HoLab] ${form.pName.trim() || '근로자'} 님 진정서 및 상담 요청`); setMailBody(''); setComposing(true)
    let summary = ''
    try {
      const r = await draftMailSummary({ lawyerName: l.name, ...buildFacts() })
      summary = r.summary
    } catch { summary = consultNotes.map((n) => `- ${n}`).join('\n') }
    setMailBody(composeBody(l, summary, no))
    setComposing(false)
  }

  // 대면 상담 전 1장 리포트: 짧은 상담 시간에 본론부터 말할 수 있도록 상황 요약 + 물어볼 질문 + 증빙 체크리스트.
  // 먼저 만들어 미리보기로 보여주고, 사용자가 확인한 뒤 PDF로 저장
  const openReport = async (l: Lawyer) => {
    const have = report?.have // 앞서 체크해 둔 증빙자료는 유지
    setReportFor(l); setReportBusy(true); setReportSaved(false); setReportErr(null); setReport(null)
    try {
      const r = await draftReport(buildFacts())
      setReport({ lawyerName: l.name, summary: r.summary, questions: r.questions, have })
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : '리포트를 만들지 못했습니다.')
    }
    setReportBusy(false)
  }
  const [reportPdfBusy, setReportPdfBusy] = useState(false)
  const downloadReport = async () => {
    setReportPdfBusy(true); setReportErr(null)
    try {
      const el = document.getElementById('reportDoc')
      if (!el) throw new Error('리포트 양식을 찾지 못했습니다.')
      await savePdf(el, `상담리포트_${form.pName.trim() || '김민수'}.pdf`)
      setReportSaved(true)
    } catch (e) {
      setReportErr(e instanceof Error ? e.message : 'PDF를 만들지 못했습니다.')
    }
    setReportPdfBusy(false)
  }

  const send = async () => {
    if (!target) return
    setError(null); setPhase('sending'); setProgress(0)
    const no = receipt
    try {
      if (realMail) {
        if (!validMail(toAddr)) throw new Error('받는 이메일 주소를 확인해 주세요.')
        // 진정서를 작성했다면 PDF로 첨부하고, 아직이면 메일 본문만 보냄
        const el = document.getElementById('printDoc')
        const b64 = form.draft.trim().length >= 20 && el ? await pdfBase64(el) : ''
        setProgress(1)
        const res = await sendComplaintMail({
          lawyer: { name: target.name, office: target.office },
          receipt: no,
          fields: {
            '진정인 성명': form.pName, '진정인 주민등록번호': form.pRrn, '진정인 주소': form.pAddr,
            '진정인 휴대전화': form.pMobile, '진정인 이메일': form.pEmail,
            '피진정인(대표)': form.rBoss, '사업장명': form.rName, '사업장 주소': form.rBizAddr, '근로자 수': form.rCount,
            '입사일': form.startDate, '퇴사일': form.endDate, '체불임금 총액': form.wageTotal, '업무내용': form.duty,
            '임금 지급일': form.payDay, '관할 노동청': form.office, '첨부 자료': form.attach,
          },
          body: form.draft,
          pdfBase64: b64,
          filename: `진정서_${form.pName.trim() || '초안'}.pdf`,
          subject,
          mailText: mailBody,
          to: toAddr.trim(),
        })
        setSentTo(res.to)
        setProgress(2)
      } else {
        for (let i = 1; i <= 2; i++) { await sleep(900); setProgress(i) }
      }
      await sleep(500)
      setProgress(3)
      setReceipt(no); setPhase('done'); markDone(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 중 오류가 발생했습니다.')
      setPhase('confirm')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">노무사 매칭 · 상담 준비</CardTitle>
        <CardDescription>내 사건 분야에 맞는 노무사를 찾고, <b>상담 방식</b>에 맞춰 준비물을 챙긴 뒤 메일로 보내요. <Badge variant="outline" className="ml-1">센터는 실제 기관 · 노무사는 임시 데이터</Badge></CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* 1. 내 위치 */}
        <section className="grid gap-3" aria-labelledby="s4-1">
          <h3 id="s4-1" className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">1</span> 내 위치 정하기</h3>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <Button size="sm" variant={sortByDistance ? 'default' : 'outline'} onClick={myLoc ? () => setSortByDistance((v) => !v) : findNearby} disabled={locBusy}>
              {locBusy ? <Loader2 className="animate-spin" /> : <MapPin />} {myLoc ? (sortByDistance ? '거리순 보는 중' : '거리순으로 보기') : '내 위치에서 가까운 센터 찾기'}
            </Button>
            {myLoc && sortByDistance && <Button size="sm" variant="ghost" onClick={() => setSortByDistance(false)}>기본 순서로 보기</Button>}
            <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              또는 직접 선택
              <select aria-label="사는 지역 직접 선택" defaultValue="" onChange={(e) => e.target.value && pickDistrict(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-[13px] text-foreground">
                <option value="" disabled>자치구</option>
                {districts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <p className="w-full text-[13px] text-muted-foreground">위치 정보는 거리 계산에만 쓰이고 기기 밖으로 전송되지 않아요. 서울 지역 센터를 제공하며, 다른 지역은 고용노동부 1350(무료 상담)으로 문의할 수 있어요.</p>
          </div>
          {locErr && <Alert variant="destructive"><TriangleAlert /><AlertDescription>{locErr} 위의 “직접 선택”으로 사는 구를 골라도 돼요.</AlertDescription></Alert>}
        </section>

        {/* 2. 센터 고르기 */}
        <section className="grid gap-3" aria-labelledby="s4-2">
          <h3 id="s4-2" className="flex items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">2</span> 노무사 매칭 <span className="text-[13px] font-normal text-muted-foreground">· 지도의 번호는 아래 목록 순서예요</span></h3>
          <div className="grid gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={autoPick} disabled={autoBusy}>{autoBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} 노무사 자동 매칭</Button>
              <span className="text-[13px] text-muted-foreground">내 사건 분야{need.length ? `(${need.join('·')})` : ''}와 {myLoc ? '고른 위치' : '내 위치(허용 시)'}로 적합한 노무사를 골라 이유와 함께 보여 드려요.</span>
            </div>
            {autoRes && (
              <div className="pop-in grid gap-2 rounded-lg bg-background p-3.5 text-sm" aria-live="polite">
                <div className="flex flex-wrap items-center gap-2"><Badge><Sparkles /> HoLab이 매칭한 노무사</Badge><b className="text-base">{autoRes.lawyer} 노무사</b><span className="text-muted-foreground">{autoRes.name}</span></div>
                <ul className="grid gap-1">
                  {autoRes.reasons.map((r) => <li key={r} className="flex items-start gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" strokeWidth={3} /> {r}</li>)}
                </ul>
                {autoRes.notes.map((n) => <p key={n} className="text-[13px] text-muted-foreground">ⓘ {n}</p>)}
                {autoRes.alts.length > 0 && <p className="text-[13px] text-muted-foreground">다른 후보: {autoRes.alts.map((a) => `${a.name} (${a.line})`).join(' · ')}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => document.getElementById('prep')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>이 노무사로 상담 준비하기 <ArrowRight /></Button>
                  <Button size="sm" variant="ghost" onClick={() => document.getElementById('lawyer-pick')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>이 센터의 다른 노무사 보기</Button>
                </div>
              </div>
            )}
            {locErr && <p className="text-[13px] text-destructive">{locErr} 위의 “직접 선택”으로 사는 구를 고른 뒤 다시 눌러 주세요.</p>}
          </div>          <CenterMap centers={mapCenters} selected={sel} onSelect={(n) => pick(n)} me={myLoc} />
          <p className="text-[13px] text-muted-foreground"><MapPin className="mr-1 inline size-3.5" />핀이나 목록에서 센터를 고르세요. 지도 타일은 OpenStreetMap에서 불러오며, 내 위치는 이 기기 밖으로 보내지 않아요.</p>
          <details className="rounded-lg border p-3 text-[13px]">
            <summary className="cursor-pointer font-semibold">
              {sortByDistance && myLoc ? '지금은 거리순이에요' : '지금은 기본 순서예요'} · 왜 이 순서인가요?
            </summary>
            <div className="mt-2 grid gap-1.5 text-muted-foreground">
              <p><b className="text-foreground">센터 순서</b> — {sortByDistance && myLoc ? '내 위치(또는 고른 구)에서 가까운 센터부터예요.' : '위치를 알려 주면 가까운 순으로 바꿔 드려요. 지금은 고른 구 → 서울시 광역 센터 → 공개 자료 순서예요.'}</p>
              <p><b className="text-foreground">노무사 적합도</b> — 센터를 고르면 그 안의 노무사를 적합도 순으로 보여 줘요.</p>
              <ol className="list-decimal space-y-0.5 pl-5">
                <li><b>전담 분야 일치 70점</b> — 내 사건에 필요한 분야{need.length ? `(${need.join('·')})` : ''} 중 노무사가 전담하는 분야의 비율이에요.</li>
                <li><b>거리 30점</b> — 위치를 알려 주면 3km 이내 30점, 8km 이내 20점, 15km 이내 10점이에요. 위치를 모르면 분야 일치만으로 100점 만점이에요.</li>
                {need.length === 0 && <li>지금은 사건 분야를 몰라 적합도를 계산하지 못했어요. AI 상담이나 계산·계약서 분석을 하면 나와요.</li>}
              </ol>
              <p><b className="text-foreground">임시 데이터 안내</b> — 노무사 이름·분야·이메일은 시연용 가상 정보예요. 센터와 연락처는 실제 공개 자료이고, 실제 서비스에서는 센터에서 확인한 노무사 정보로 바꿔요.</p>
              <p><b className="text-foreground">모든 센터가 공통으로 다루는 상담</b> — {COMMON_SCOPE}.{issueText && <> 지금 확인된 쟁점({issueText})도 이 범위 안이에요.</>}</p>
            </div>
          </details>

          <div id="lawyer-list" className="grid gap-2">
            {(showAll ? list : list.slice(0, 3)).map((l, i) => {
              const chosen = sel === l.name
              const lead = l.sameDistrict ? '내가 고른 구' : i === 0 && sortByDistance && myLoc && !myDistrict ? '가장 가까움' : ''
              return (
                <div key={l.name} id={`center-${l.name}`} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${chosen ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : ''}`}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>{l.name}</b>
                      {lead && <Badge>{lead}</Badge>}
                      {l.dist != null && l.dist >= 0.05 && <Badge variant="outline" className="gap-1"><MapPin className="size-3" /> {fmtKm(l.dist)}</Badge>}
                    </div>
                    <p className="text-[13px] text-muted-foreground">{l.office} · {l.region} · {l.address}</p>
                    <p className="text-[13px]"><a href={`tel:${l.phone.replace(/[^0-9]/g, '').slice(0, 11)}`} className="font-medium underline-offset-2 hover:underline">{l.phone}</a> <span className="text-muted-foreground">· {l.why.join(' · ')}</span></p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a href={mapLink(l)} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[0.8rem] font-medium hover:bg-muted"><Navigation className="size-3.5" /> 길찾기</a>
                    <Button size="sm" variant={chosen ? 'secondary' : 'default'} onClick={() => { pick(l.name, false); if (!chosen) setTimeout(() => document.getElementById('lawyer-pick')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }}>
                      {chosen ? <><Check /> 선택됨</> : '이 센터 선택'}
                    </Button>
                  </div>
                </div>
              )
            })}
            {!showAll && list.length > 3 && (
              <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setShowAll(true)}>+ {list.length - 3}곳 더 보기</Button>
            )}
          </div>
        </section>

        {/* 3. 고른 센터 안 노무사: 적합도 순 (임시 데이터) */}
        <section id="lawyer-pick" className="grid gap-3 scroll-mt-16" aria-label="센터 안 노무사 고르기">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">3</span> {reportCenter.name}의 노무사 <Badge variant="outline">임시 데이터</Badge></h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {lwRank.map((r, i) => {
              const on = chosenLw?.name === r.lw.name
              return (
                <div key={r.lw.name} className={`grid gap-1.5 rounded-xl border p-3 ${on ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{r.lw.name} 노무사</b>
                    {r.pct != null ? <Badge className="bg-emerald-700 text-white">적합도 {r.pct}%</Badge> : <Badge variant="outline">적합도 계산 전</Badge>}
                    {i === 0 && r.pct != null && <Badge>가장 잘 맞아요</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {r.lw.specialties.map((s) => <span key={s} className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${r.fit.includes(s) ? 'bg-emerald-700 text-white' : 'bg-muted text-muted-foreground'}`}>{s}</span>)}
                  </div>
                  <p className="text-[13px] text-muted-foreground">{r.lw.intro} · 상담 {r.lw.hours}</p>
                  <Button size="sm" variant={on ? 'secondary' : 'default'} className="justify-self-start" onClick={() => { setSelLw(r.lw.name); setTimeout(() => document.getElementById('prep')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }}>
                    {on ? <><Check /> 선택됨</> : '이 노무사 선택'}
                  </Button>
                </div>
              )
            })}
          </div>
          <p className="text-[13px] text-muted-foreground">초록색 분야는 내 사건과 맞는 분야예요. 노무사 이름·분야·이메일은 시연용 가상 정보이고, 실제 서비스에서는 센터에서 확인한 정보로 채워져요.</p>
        </section>

        {/* 4. 상담 준비 */}
        {reportCenter && (
          <CounselPrep
            center={reportCenter} lawyer={chosenLw} dist={list.find((x) => x.name === reportCenter.name)?.dist ?? null} chosen={!!sel}
            openReport={openReport} reportBusy={reportBusy} reportSaved={reportSaved} saveComplaintPdf={saveComplaintPdf} cmpBusy={cmpBusy}
            mail={{ realMail, to: toAddr, setTo: setToAddr, valid: validMail(toAddr), onSend: open }}
          />
        )}
        <p className="text-[13px] text-muted-foreground">
          ※ 센터 연락처는 <a href={CENTERS_SOURCE.url} target="_blank" rel="noreferrer" className="underline">{CENTERS_SOURCE.label}</a>에 공개된 실제 정보입니다 ({CENTERS_SOURCE.checkedAt} 확인). <b>노무사 이름·전담 분야·이메일은 시연용 임시 데이터(가상 인물)</b>이며, 적합도는 HoLab 참고용이에요. HoLab은 센터에 대신 접수하지 않아요. 접수 방법은 센터마다 다르니 전화로 먼저 확인하세요.
        </p>
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o && phase !== 'sending') setTarget(null) }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {phase === 'confirm' && target && (
            <>
              <DialogHeader>
                <DialogTitle>{chosenLw ? `${chosenLw.name} 노무사에게` : `${target.name}에게`} 메일 보내기</DialogTitle>
                <DialogDescription>{target.name} · {target.region}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <label className="grid gap-1 text-sm font-semibold">받는 이메일 <span className="text-[13px] font-normal text-muted-foreground">(노무사 이메일이 채워져 있어요. 고칠 수 있어요)</span>
                  <Input type="email" value={toAddr} onChange={(e) => setToAddr(e.target.value)} aria-label="받는 이메일" placeholder="name@example.com" aria-invalid={!!toAddr && !validMail(toAddr)} />
                </label>
                {toAddr && !validMail(toAddr) && <p className="text-[13px] text-destructive">이메일 형식이 올바르지 않아요.</p>}
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">메일 내용 확인 · 수정 <Badge variant="secondary"><Sparkles /> 자동 작성 · 상담·못 받은 돈·계약서·진정서 내용</Badge></p>
                <p className="text-[13px] text-muted-foreground">AI 상담·계산·계약서 분석 내용을 정리한 메일 초안이에요. 자유롭게 고친 뒤 아래 <b>전송 확인</b>을 눌러야 전송됩니다.</p>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="메일 제목" placeholder="메일 제목" disabled={composing} />
                {composing ? (
                  <div className="flex h-56 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> 상담 내용을 정리하는 중…</div>
                ) : (
                  <Textarea value={mailBody} onChange={(e) => setMailBody(e.target.value)} aria-label="메일 본문" className="h-64 resize-y text-sm leading-relaxed" />
                )}
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><Mail className="size-3.5" /> {form.draft.trim().length >= 20 ? <>첨부: <b className="text-foreground">진정서_{form.pName.trim() || '초안'}.pdf</b> (진정서 양식, <b>주민등록번호 포함</b>) — 전송 시 자동 첨부</> : '진정서를 아직 작성하지 않아 메일 본문만 전송돼요 (첨부 없음)'}</p>
              </div>
              {realMail ? (
                <Alert>
                  <Mail />
                  <AlertDescription>
                    위 <b>받는 이메일</b>로 <b>실제 이메일</b>이 전송돼요. 메일 본문에는 입력하신 이름·연락처가 들어가고{form.draft.trim().length >= 20 && <>, 첨부 PDF에는 주민등록번호가 들어가요</>}. 받는 주소를 꼭 다시 확인하세요. 노무사 이메일은 시연용 임시 주소라 실제로는 도착하지 않을 수 있어요.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-[13px] text-muted-foreground"><Badge variant="outline" className="mr-1">시연용</Badge>메일 발송 설정이 꺼져 있어 실제 전송은 이루어지지 않는 가상 전송입니다.</p>
              )}
              {error && (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3">
                <Checkbox id="agree2" checked={agree} onCheckedChange={(v) => setAgree(!!v)} className="mt-0.5" />
                <Label htmlFor="agree2" className="cursor-pointer font-normal leading-relaxed">
                  <span>위 내용이 <b>{toAddr.trim() || '입력한 주소'}</b>로 이메일 전송되는 데 동의하며, 이는 법률 자문이 아닌 <b>참고용 초안</b>임을 확인했습니다.</span>
                </Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTarget(null)}>취소</Button>
                <Button disabled={!agree || composing || mailBody.trim().length < 20 || !subject.trim() || !validMail(toAddr)} onClick={send}>{error ? '다시 전송 확인' : '전송 확인'}</Button>
              </DialogFooter>
            </>
          )}
          {phase === 'sending' && (
            <>
              <DialogHeader><DialogTitle>전송 중…</DialogTitle></DialogHeader>
              <div className="grid gap-2 py-2">
                {STEPS.map((s, i) => (
                  <div key={s} className={`flex items-center gap-2 text-sm ${progress > i ? 'font-semibold text-emerald-700' : 'text-muted-foreground'}`}>
                    {progress > i ? <CheckCircle2 className="size-4" /> : <Loader2 className="size-4 animate-spin" />} {s}
                  </div>
                ))}
              </div>
            </>
          )}
          {phase === 'done' && target && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-700" /> {sentTo ? '메일 전송 완료' : '가상 전송 완료'}</DialogTitle>
                <DialogDescription>
                  {sentTo ? <>메일이 <b>{sentTo}</b>로 발송되었습니다.</> : <><b>{target.name}</b> 노무사에게 보낸 것으로 기록했어요 (가상 전송).</>}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm leading-relaxed">
                접수번호 <b>{receipt}</b><br />
                {sentTo ? <>메일함(스팸함 포함)을 확인해 주세요. 몇 분 걸릴 수 있어요.</> : <>실제 메일은 발송되지 않았어요.</>}
              </div>
              <p className="text-[13px] text-muted-foreground">HoLab은 센터에 대신 접수하지 않아요. 답장이 없으면 전화로 한 번 더 확인하세요.</p>
              <DialogFooter><Button onClick={() => setTarget(null)}>확인</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportFor} onOpenChange={(o) => { if (!o && !reportBusy && !reportPdfBusy) setReportFor(null) }}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="size-5 text-primary" /> 상담 준비 리포트 미리보기</DialogTitle>
            <DialogDescription>{reportFor?.name} 방문 상담 전, 지금까지 입력한 내용으로 정리했어요. 내용을 확인하고 다운로드할지 정하세요. 가지고 있는 증빙자료는 체크해 두면 PDF에도 표시돼요.</DialogDescription>
          </DialogHeader>
          {reportBusy && (
            <div className="flex h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> 리포트를 만드는 중…</div>
          )}
          {!reportBusy && reportErr && (
            <Alert variant="destructive"><TriangleAlert /><AlertDescription>{reportErr}</AlertDescription></Alert>
          )}
          {!reportBusy && report && <ReportPreview />}
          {!reportBusy && reportSaved && !reportErr && (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm leading-relaxed">
              리포트 PDF가 저장되었습니다. 상담 시간이 짧아도 상황·쟁점·질문을 바로 꺼내 보여줄 수 있어요.
            </div>
          )}
          <p className="text-[13px] text-muted-foreground"><Badge variant="outline" className="mr-1">참고용</Badge>법률 자문이 아니며, 상담 시 노무사와 사실 관계를 다시 확인하세요.</p>
          <DialogFooter>
            {reportErr && !report && <Button variant="outline" onClick={() => reportFor && openReport(reportFor)}>다시 시도</Button>}
            <Button variant="outline" onClick={() => setReportFor(null)} disabled={reportBusy || reportPdfBusy}>{reportSaved ? '닫기' : '다운로드 안 하고 닫기'}</Button>
            {!reportBusy && report && (
              <Button onClick={downloadReport} disabled={reportPdfBusy}>
                {reportPdfBusy ? <Loader2 className="animate-spin" /> : <FileDown />} {reportPdfBusy ? 'PDF 만드는 중…' : reportSaved ? '다시 다운로드' : 'PDF 다운로드'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

