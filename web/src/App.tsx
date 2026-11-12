import { FileCheck, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ComplaintDoc from '@/components/ComplaintDoc'
import HelpPage from '@/components/HelpPage'
import Home from '@/components/Home'
import TriageAssistant from '@/components/TriageAssistant'
import ReportDoc from '@/components/ReportDoc'
import Wizard from '@/components/Wizard'
import { StoreProvider, useStore } from '@/store'

function Shell() {
  const { view, askLawyer, setAskLawyer, go } = useStore()
  return (
    <>
      <div id="app-root" className="relative min-h-dvh">
        <div className="relative z-10">
        <div className="sticky top-0 z-30 flex min-h-10 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[13px] text-amber-950">
          <Scale className="size-4 shrink-0" />
          <span>이 서비스는 <b>참고용 정보</b>이며 <b>법률 자문이 아닙니다</b>. 중요한 결정은 노무사·노동청과 상담하세요.</span>
        </div>
        {view === 'home' && <Home />}
        {view === 'help' && <HelpPage />}
        {view === 'wizard' && <Wizard />}
        <TriageAssistant />
        </div>

        <Dialog open={askLawyer} onOpenChange={setAskLawyer}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileCheck className="size-5 text-primary" /> 진정서 PDF가 저장되었습니다</DialogTitle>
              <DialogDescription>내 사건에 맞는 <b>노무사</b>를 매칭하고, 상담에 가져갈 리포트를 준비해 보시겠어요?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAskLawyer(false)}>나중에 할게요</Button>
              <Button onClick={() => { setAskLawyer(false); go(4) }}>노무사 매칭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {/* PDF 생성·인쇄용 진정서 양식 (화면에는 보이지 않음) */}
      <div id="printDoc"><ComplaintDoc /></div>
      {/* PDF 생성용 상담 준비 리포트 (화면에는 보이지 않음) */}
      <div id="reportDoc"><ReportDoc /></div>
    </>
  )
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>
}