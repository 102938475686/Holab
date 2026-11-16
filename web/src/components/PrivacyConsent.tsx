import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useStore } from '@/store'

// 처음 들어올 때 개인정보 수집·이용, AI 처리(국외 이전), 만 14세 미만 보호자 동의를 받아요.
// 동의 기록은 이 기기(localStorage)에만 남고, 상단 "개인정보 안내"에서 다시 보거나 철회할 수 있어요.
const KEY = 'holab-consent'
const VERSION = 1
type Saved = { v: number; at: string; under14: boolean }

function readSaved(): Saved | null {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === VERSION ? s : null } catch { return null }
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <p className="font-semibold text-foreground">{title}</p>
      <div className="text-muted-foreground">{children}</div>
    </div>
  )
}

function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <Label htmlFor={id} className="cursor-pointer font-normal leading-relaxed">{children}</Label>
    </div>
  )
}

export default function PrivacyConsent() {
  const { resetAll } = useStore()
  const [saved, setSaved] = useState<Saved | null>(readSaved)
  const [open, setOpen] = useState(() => !readSaved())
  const [useAgree, setUseAgree] = useState(false)
  const [aiAgree, setAiAgree] = useState(false)
  const [age, setAge] = useState<'' | 'over' | 'under'>('')
  const [guardian, setGuardian] = useState(false)
  const [declined, setDeclined] = useState(false)

  const gate = !saved // 아직 동의하지 않았으면 닫을 수 없음
  const ready = useAgree && aiAgree && (age === 'over' || (age === 'under' && guardian))

  const agree = () => {
    const s: Saved = { v: VERSION, at: new Date().toISOString(), under14: age === 'under' }
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장이 막힌 환경은 이번 방문만 동의로 처리 */ }
    setSaved(s); setOpen(false); setDeclined(false)
  }
  const withdraw = () => {
    if (!window.confirm('동의를 철회하면 이 기기에 남은 HoLab 입력 내용(계산·계약서·상담·진정서·상담 예약 기록)이 모두 지워져요. 계속할까요?')) return
    resetAll()
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    setSaved(null); setUseAgree(false); setAiAgree(false); setAge(''); setGuardian(false)
  }
  const clearData = () => {
    if (!window.confirm('이 기기에 남은 HoLab 입력 내용(계산·계약서·상담·진정서·상담 예약 기록)을 모두 지울까요? 되돌릴 수 없어요.')) return
    resetAll(); setOpen(false)
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2">
        <ShieldCheck className="size-3.5" /> 개인정보 안내
      </button>
      <Dialog open={open} onOpenChange={(o) => { if (!gate) setOpen(o) }}>
        <DialogContent showCloseButton={!gate} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> {gate ? '시작하기 전에 확인해 주세요' : '개인정보 안내'}</DialogTitle>
            <DialogDescription>HoLab은 내 정보를 이렇게 다뤄요. 짧게 읽어 보고 동의해 주세요.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 text-sm leading-relaxed">
            <Item title="1. 어떤 정보를, 왜 쓰나요?">
              시급·근무 시간 같은 근무 조건, 상담에서 말한 내용, 근로계약서 내용, 진정서에 적는 이름·연락처·주소를 써요.
              못 받은 돈 계산, 계약서 점검, 진정서와 상담 리포트 작성에만 사용해요.
            </Item>
            <Item title="2. 어디에 저장되고, 언제 지워지나요?">
              지금 쓰는 <b className="text-foreground">이 브라우저 탭에만</b> 저장되고, 탭을 닫으면 지워져요. <b className="text-foreground">HoLab 서버에는 저장하지 않아요.</b>{' '}
              계약서 사진은 내 기기 안에서 글자만 읽고, 사진 자체는 어디로도 보내지 않아요. 주민등록번호는 저장하지 않아요.
              상담 예약 기록만 이 기기에 남는데, 아래 <b className="text-foreground">“내 정보 지우기”</b>로 언제든 지울 수 있어요.
            </Item>
            <Item title="3. AI에 보내는 정보 (국외 이전)">
              AI 상담·계약서 분석·진정서 초안은 <b className="text-foreground">OpenAI(미국)</b>의 AI가 처리해요. 보내기 전에 이름·전화번호·주민등록번호·주소·계좌번호는 <b className="text-foreground">[가림] 처리</b>해요.
              <details className="mt-1.5 rounded-lg bg-muted/60 p-2.5">
                <summary className="cursor-pointer font-medium text-foreground">자세히 보기</summary>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                  <li>받는 곳: OpenAI, L.L.C. (미국)</li>
                  <li>보내는 때와 방법: AI 기능을 쓸 때마다 암호화된 인터넷 연결로 전송</li>
                  <li>보내는 정보: 개인정보를 가린 상담 내용·계약서 내용·근무 조건</li>
                  <li>목적: 답변과 문서 초안 만들기</li>
                  <li>보관: OpenAI 정책상 AI 학습에 쓰지 않고, 남용 감시를 위해 최대 30일 보관 후 삭제</li>
                </ul>
              </details>
            </Item>
            <Item title="4. 다른 사람에게 보내는 경우 (제3자 제공)">
              노무사나 상담 센터에 이메일을 보낼 때만 보내요. 보내기 직전에 받는 사람과 보낼 내용을 직접 확인하고, 그때 <b className="text-foreground">따로 한 번 더 동의</b>를 받아요.
            </Item>
            <Item title="5. 동의하지 않을 수 있어요">
              동의하지 않아도 괜찮아요. 다만 그러면 HoLab 기능을 쓸 수 없어요. 이럴 땐 고용노동부 고객상담센터 <b className="text-foreground">☎ 1350</b>에서 무료로 상담받을 수 있어요.
            </Item>

            {gate ? (
              <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                <Check id="pc-use" checked={useAgree} onChange={setUseAgree}><b>[필수]</b> 1·2번처럼 개인정보를 수집·이용하는 데 동의해요.</Check>
                <Check id="pc-ai" checked={aiAgree} onChange={setAiAgree}><b>[필수]</b> 3번처럼 가린 내용이 OpenAI(미국)로 전송되는 데(국외 이전) 동의해요.</Check>
                <div className="grid gap-2">
                  <p className="font-semibold">나이를 알려 주세요 <span className="font-normal text-muted-foreground">(만 나이)</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {([['over', '만 14세 이상이에요'], ['under', '만 14세 미만이에요']] as const).map(([k, label]) => (
                      <Button key={k} type="button" variant={age === k ? 'default' : 'outline'} aria-pressed={age === k} onClick={() => setAge(k)}>{label}</Button>
                    ))}
                  </div>
                  {age === 'under' && (
                    <div className="grid gap-2 rounded-lg bg-amber-50 p-3 text-amber-950">
                      <p className="text-[13px]">만 14세 미만은 법에 따라 <b>보호자(부모님 등)의 동의</b>가 꼭 필요해요. 보호자와 함께 위 내용을 읽어 주세요.</p>
                      <Check id="pc-guardian" checked={guardian} onChange={setGuardian}><b>[필수]</b> 보호자가 위 내용을 확인하고 동의했어요.</Check>
                    </div>
                  )}
                </div>
                {declined && <p className="rounded-lg bg-muted p-2.5 text-[13px]">동의하지 않으면 HoLab 기능을 쓸 수 없어요. 고용노동부 고객상담센터 <b>☎ 1350</b>(평일 9~18시)에 전화하면 무료로 상담받을 수 있어요. 마음이 바뀌면 위에 체크하고 시작해 주세요.</p>}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/60 p-2.5 text-[13px] text-muted-foreground">
                {new Date(saved!.at).toLocaleDateString('ko-KR')}에 동의했어요{saved!.under14 ? ' (만 14세 미만, 보호자 동의)' : ''}.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {gate ? (
              <>
                <Button variant="outline" onClick={() => setDeclined(true)}>동의하지 않아요</Button>
                <Button disabled={!ready} onClick={agree}>동의하고 시작하기</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={withdraw}>동의 철회하기</Button>
                <Button variant="outline" onClick={clearData}>내 정보 지우기</Button>
                <Button onClick={() => setOpen(false)}>닫기</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
