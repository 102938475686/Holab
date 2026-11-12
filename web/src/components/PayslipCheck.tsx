import { useRef, useState } from 'react'
import { Camera, CheckCircle2, CreditCard, Lock, NotebookPen, TriangleAlert, UploadCloud } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { won, type CalcResult } from '@/lib/calc'
import { extractPayAmount } from '@/lib/payslip'
import { useStore } from '@/store'

// 급여명세서 사진/텍스트에서 실제 받은 금액을 뽑아, ①에서 계산한 "받아야 할 금액"과 비교합니다.
// AI나 서버로 보내지 않고 브라우저 안(OCR 포함)에서만 처리합니다.
export default function PayslipCheck({ calc }: { calc: CalcResult }) {
  const { consultNotes, setConsultNotes } = useStore()
  const [tab, setTab] = useState('photo')
  const [preview, setPreview] = useState<string | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [pctText, setPctText] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState('')
  const GROSS_LABEL = '지급총액 (세전)'
  const NET_LABEL = '차인지급액 (세후 실수령액)'
  const [kindLabel, setKindLabel] = useState(GROSS_LABEL)
  const kind: 'net' | 'gross' = kindLabel === NET_LABEL ? 'net' : 'gross'
  const [matched, setMatched] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [contractAmt, setContractAmt] = useState('')
  const [contractIncludesHol, setContractIncludesHol] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const applyMatch = (text: string) => {
    const m = extractPayAmount(text)
    if (m) { setAmount(String(m.amount)); setKindLabel(m.kind === 'net' ? NET_LABEL : GROSS_LABEL); setMatched(m.matchedText); setNotFound(false) }
    else { setNotFound(true); setMatched(null) }
  }

  const runOcr = async (src: string) => {
    setPct(3); setPctText('글자 인식 엔진 준비 중…'); setAdded(false)
    try {
      const { default: Tesseract } = await import('tesseract.js')
      const { data } = await Tesseract.recognize(src, 'kor+eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') { setPct(10 + m.progress * 88); setPctText(`글자 인식 중… ${Math.round(m.progress * 100)}%`) }
          else if (m.status) { setPct(6); setPctText('언어 데이터 불러오는 중…') }
        },
      })
      setPct(null)
      applyMatch(data.text || '')
    } catch {
      setPct(null)
      setNotFound(true)
    }
  }

  const startFile = (f: File) => { const url = URL.createObjectURL(f); setPreview(url); runOcr(url) }

  const amt = Number(amount)
  const valid = amt > 0
  const dueGross = Math.round(calc.monthlyDue)
  const diff = dueGross - amt // 법정 최소 기준과의 차이
  const cAmt = Number(contractAmt)
  const hasContract = cAmt > 0
  const contractDiff = cAmt - amt // 계약서 약정액과의 차이 (계약 이행 여부)
  const contractBelowLegal = hasContract && cAmt < dueGross - 1000 // 계약서 약정액 자체가 법정 기준보다 낮은 경우

  const addNote = () => {
    const lines: string[] = []
    lines.push(kind === 'gross'
      ? `급여명세서 확인: 명세서상 지급총액(세전) ${won(amt)} vs 계산상 법정 최소 급여(세전) ${won(dueGross)} → 차액 약 ${won(Math.max(0, diff))}`
      : `급여명세서 확인: 명세서상 차인지급액(세후 실수령액) ${won(amt)} — 계산상 법정 최소 급여(세전) ${won(dueGross)}와는 세금·4대보험 공제 차이가 있어 직접 비교는 어려움`)
    if (hasContract) {
      lines.push(`근로계약서 약정 급여${contractIncludesHol ? '(주휴수당 포함 기재)' : ''} ${won(cAmt)} vs 실제 받은 금액 ${won(amt)} → 차액 약 ${won(Math.max(0, contractDiff))}${contractDiff > 1000 ? ' (계약서에 적힌 금액보다 적게 받음)' : ''}`)
      if (contractBelowLegal) lines.push(`근로계약서 약정 급여 ${won(cAmt)}는 법정 최소 기준 ${won(dueGross)}보다 낮게 적혀 있어, 계약 내용 자체가 문제일 수 있음`)
    }
    setConsultNotes([...consultNotes, ...lines])
    setAdded(true)
  }

  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <h3 className="flex items-center gap-2 font-semibold"><CreditCard className="size-4 text-muted-foreground" /> 급여명세서로 실제 받은 금액 확인 <Badge variant="outline">선택</Badge></h3>
      <p className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        <span>사진은 <b>내 브라우저 안에서</b>만 글자로 변환됩니다. 서버나 AI로 전송되지 않습니다.</span>
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="photo"><Camera /> 명세서 사진</TabsTrigger>
          <TabsTrigger value="manual">직접 입력</TabsTrigger>
        </TabsList>
        <TabsContent value="photo" className="grid gap-3 pt-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 p-6 text-sm text-muted-foreground transition-colors hover:bg-muted">
            <UploadCloud className="size-6" />
            급여명세서 사진을 선택하세요
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) startFile(f); e.target.value = '' }} />
          {preview && <img src={preview} alt="명세서 미리보기" className="max-h-56 rounded-lg border object-contain" />}
          {pct !== null && (
            <div className="grid gap-1.5">
              <Progress value={pct} />
              <p className="text-[13px] text-muted-foreground">{pctText}</p>
            </div>
          )}
          {notFound && pct === null && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>금액을 자동으로 찾지 못했어요.</AlertTitle>
              <AlertDescription>사진이 흐리거나 양식이 달라서일 수 있어요. 아래 금액 칸에 직접 입력해 주세요.</AlertDescription>
            </Alert>
          )}
          {matched && <p className="text-[13px] text-muted-foreground">인식된 부분: “{matched}”</p>}
        </TabsContent>
        <TabsContent value="manual" className="pt-3">
          <p className="text-[13px] text-muted-foreground">급여명세서에 적힌 금액을 아래 칸에 직접 입력하세요.</p>
        </TabsContent>
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="payAmt">받은 금액 (원)</Label>
          <Input id="payAmt" type="number" min={0} value={amount} onChange={(e) => { setAmount(e.target.value); setAdded(false) }} placeholder="예: 950000" />
        </div>
        <div className="grid gap-1.5">
          <Label>이 금액은</Label>
          <Select value={kindLabel} onValueChange={(v) => { if (v) { setKindLabel(String(v)); setAdded(false) } }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={GROSS_LABEL}>{GROSS_LABEL}</SelectItem>
              <SelectItem value={NET_LABEL}>{NET_LABEL}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {valid && (
        <div className="grid gap-2">
          <p className="text-[13px] font-semibold text-muted-foreground">A. 법정 최소 기준과 비교</p>
          {kind === 'gross' ? (
            diff > 1000 ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>명세서 금액이 법정 기준보다 적어요</AlertTitle>
                <AlertDescription>명세서상 지급총액 {won(amt)}은 계산상 법정 최소 급여(세전) {won(dueGross)}보다 <b>{won(diff)}</b> 적습니다.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 />
                <AlertTitle>명세서 금액이 법정 기준과 거의 일치해요</AlertTitle>
                <AlertDescription>명세서상 지급총액 {won(amt)} vs 법정 최소 {won(dueGross)}</AlertDescription>
              </Alert>
            )
          ) : (
            <Alert>
              <TriangleAlert />
              <AlertTitle>세전·세후 차이가 있어 바로 비교하기 어려워요</AlertTitle>
              <AlertDescription>
                명세서상 차인지급액(세후) {won(amt)}은 세금·4대보험이 빠진 실수령액이라, 계산상 법정 최소 급여(세전) {won(dueGross)}와 금액이 달라도 정상일 수 있어요. 명세서의 <b>지급총액</b> 항목과 공제 내역을 함께 확인해 보세요.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-[13px] font-semibold text-muted-foreground">B. 근로계약서에 적힌 약정 급여와 비교 (주휴수당 등을 포함해서 월급으로 써 놓은 경우에 유용해요)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cAmt">계약서에 적힌 급여 (원)</Label>
            <Input id="cAmt" type="number" min={0} value={contractAmt} onChange={(e) => { setContractAmt(e.target.value); setAdded(false) }} placeholder="예: 1200000" />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="holIncl" checked={contractIncludesHol} onCheckedChange={(v) => { setContractIncludesHol(!!v); setAdded(false) }} />
            <Label htmlFor="holIncl" className="cursor-pointer font-normal text-sm">이 금액에 주휴수당이 포함되어 있다고 적혀 있음</Label>
          </div>
        </div>
        {valid && hasContract && (
          contractDiff > 1000 ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>계약서에 적힌 금액보다 적게 받았어요</AlertTitle>
              <AlertDescription>
                계약서 약정 급여 {won(cAmt)}인데 실제로는 {won(amt)}만 받았습니다. 차액 <b>{won(contractDiff)}</b>은 법정 기준 미달이 아니라 <b>계약을 지키지 않은 것(체불)</b>일 수 있어요.
                {contractBelowLegal && <> 또한 계약서 약정액 자체가 법정 최소 기준({won(dueGross)})보다 낮게 적혀 있어, 계약 내용도 함께 확인이 필요해요.</>}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 />
              <AlertTitle>계약서에 적힌 금액만큼은 받았어요</AlertTitle>
              <AlertDescription>
                계약서 약정 급여 {won(cAmt)} vs 실제 받은 금액 {won(amt)}
                {contractBelowLegal && <> — 다만 계약서 약정액 자체가 법정 최소 기준({won(dueGross)})보다 낮게 적혀 있어요. 계약서에 다 포함했다고 써 있어도 그 결과가 법정 기준보다 낮으면 문제가 될 수 있어요.</>}
              </AlertDescription>
            </Alert>
          )
        )}
      </div>

      {valid && kind === 'gross' && (
        <dl className="grid gap-1.5 rounded-lg border p-3 text-sm">
          <p className="text-[13px] font-semibold text-muted-foreground">한눈에 비교 (월, 세전)</p>
          <div className="flex justify-between"><dt>계약 시급</dt><dd>{calc.hourly.toLocaleString()}원</dd></div>
          {hasContract && <div className="flex justify-between"><dt>계약서에 적힌 급여</dt><dd>{won(cAmt)}</dd></div>}
          <div className="flex justify-between"><dt>법적 기준 계산액</dt><dd>{won(dueGross)}</dd></div>
          <div className="flex justify-between"><dt>실제 지급액</dt><dd>{won(amt)}</dd></div>
          <div className="flex justify-between border-t pt-1.5 font-bold"><dt>미지급 추정액</dt><dd className="text-destructive">{won(Math.max(0, Math.max(dueGross, hasContract ? cAmt : 0) - amt))}</dd></div>
        </dl>
      )}

      {valid && (
        <div>
          <Button size="sm" variant="outline" onClick={addNote} disabled={added}>
            <NotebookPen /> {added ? '진정서·상담 메모에 반영됨' : '이 결과를 진정서·상담 메모에 반영하기'}
          </Button>
        </div>
      )}
    </div>
  )
}

