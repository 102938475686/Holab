import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, Loader2, NotebookPen, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { complaintChat, draftComplaint } from '@/lib/api'
import { maskText } from '@/lib/mask'
import { useStore } from '@/store'

interface Msg { id: number; role: 'user' | 'ai'; text: string }
interface Facts { issues?: string[]; totalUnpaid?: number; [k: string]: unknown }

const GREETING =
  '진정서에 꼭 넣고 싶은 이야기를 편하게 말씀해 주세요. 계산·분석으로 이미 확인된 내용은 초안에 자동으로 들어가니 다시 말씀하지 않으셔도 돼요. 사업주와 있었던 일, 가지고 계신 증거, 원하는 결과 같은 걸 알려 주시면 그걸 바탕으로 초안을 써 드릴게요.'
const FIRST_SUGGESTIONS = ['사장님께 말했는데 안 줬어요', '증거가 있어요', '넣을 내용은 따로 없어요']

export default function ComplaintAssistant({
  open, onOpenChange, facts, onDraft,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  facts: Facts
  onDraft: (text: string, meta: { demo: boolean; consulted: boolean; notes: string[] }) => void
}) {
  const { consultNotes } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: 'ai', text: GREETING }])
  const [notes, setNotes] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>(FIRST_SUGGESTIONS)
  // 열릴 때마다 ①단계 급여명세서 비교 등에서 이미 쌓아 둔 메모를 미리 채워 넣음 (사용자가 다시 말하지 않아도 되게)
  useEffect(() => { if (open) setNotes((n) => (n.length ? n : consultNotes)) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const history = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const seq = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy, open])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy || drafting) return
    setQ('')
    setSuggestions([])
    setMsgs((m) => [...m, { id: seq.current++, role: 'user', text }])
    history.current.push({ role: 'user', content: maskText(text).out }) // 개인정보는 가린 뒤 전송
    setBusy(true)
    try {
      const d = await complaintChat(history.current, facts)
      history.current.push({ role: 'assistant', content: d.reply })
      setMsgs((m) => [...m, { id: seq.current++, role: 'ai', text: d.reply }])
      setNotes(d.notes ?? [])
      setReady(d.ready)
      setSuggestions(d.ready ? [] : d.suggestions ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류'
      setMsgs((m) => [...m, { id: seq.current++, role: 'ai', text: `죄송해요, 답변을 가져오지 못했어요. (${msg}) 아래 [초안 작성하기]를 누르면 지금까지 말씀하신 내용으로 초안을 만들 수 있어요.` }])
      setNotes(history.current.filter((h) => h.role === 'user').map((h) => h.content))
      setReady(true)
    }
    setBusy(false)
  }

  const makeDraft = async () => {
    setDrafting(true)
    try {
      const d = await draftComplaint({ ...facts, userNotes: notes })
      onDraft(d.text, { demo: !!d.demo, consulted: notes.length > 0, notes })
      onOpenChange(false)
    } catch (e) {
      setMsgs((m) => [...m, { id: seq.current++, role: 'ai', text: '초안을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요. (' + (e instanceof Error ? e.message : '오류') + ')' }])
    }
    setDrafting(false)
  }

  const reflected = [...(facts.issues ?? [])]
  const userCount = msgs.filter((m) => m.role === 'user').length

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!drafting) onOpenChange(o) }}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="size-5 text-primary" /> 진정서 내용 작성 도우미</DialogTitle>
          <DialogDescription>넣고 싶은 이야기를 알려 주시면, 분석된 내용과 함께 진정서 “내용” 란 초안을 써 드려요.</DialogDescription>
        </DialogHeader>

        {reflected.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-2.5 text-[13px] text-muted-foreground">
            <span className="mr-1.5 font-semibold text-foreground">이미 반영된 내용</span>
            {reflected.map((r) => <Badge key={r} variant="secondary" className="mr-1 mt-1">{r}</Badge>)}
          </div>
        )}

        <div className="min-h-[200px] flex-1 overflow-y-auto rounded-xl border bg-background/40 p-3">
          <div className="flex flex-col gap-2.5">
            {msgs.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'self-end' : 'self-start'} style={{ maxWidth: '88%' }}>
                <div className={m.role === 'user'
                  ? 'whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground'
                  : 'whitespace-pre-wrap rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5 text-sm leading-relaxed'}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="self-start rounded-2xl rounded-bl-md border bg-card px-3.5 py-3">
                <span className="inline-flex gap-1">
                  {[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {notes.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-[13px]">
            <div className="mb-1 flex items-center gap-1 font-semibold text-foreground"><NotebookPen className="size-3.5" /> 초안에 반영될 내용</div>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        )}

        {suggestions.length > 0 && !busy && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-auto rounded-full whitespace-normal py-1.5 text-left" onClick={() => send(s)}>{s}</Button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(q) }} className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="진정서에 넣고 싶은 내용을 적어 주세요" aria-label="진정서 내용 상담 입력" disabled={busy || drafting} />
          <Button type="submit" size="icon" aria-label="보내기" disabled={!q.trim() || busy || drafting}><ArrowUp /></Button>
        </form>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground">
            {ready ? '정보가 충분해요. 초안을 만들어 볼까요?' : userCount === 0 ? '말씀하지 않아도 분석된 내용만으로 초안을 만들 수 있어요.' : '더 말씀하셔도 되고, 지금 초안을 만들 수도 있어요.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={drafting}>닫기</Button>
            <Button onClick={makeDraft} disabled={drafting || busy} className={ready && !drafting ? 'ring-2 ring-primary/40' : ''}>
              {drafting ? <><Loader2 className="animate-spin" /> 작성 중…</> : <><Sparkles /> 초안 작성하기</>}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

