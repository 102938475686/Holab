import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'

const PW = 210, PH = 297, MARGIN = 12 // A4(mm), 이어지는 쪽의 위·아래 여백

// 글자 줄 사이(빈 가로줄) 중 쪽 경계로 쓸 수 있는 위치를 위에서부터 찾음. 내용 칸(x 190~738px) 기준.
function findCut(ctx: CanvasRenderingContext2D, k: number, target: number, floor: number): number {
  const x1 = Math.round(190 * k), x2 = Math.round(738 * k)
  for (let y = target; y > floor; y--) {
    const d = ctx.getImageData(x1, y - 1, x2 - x1, 3).data
    let clean = true
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] < 170 || d[i + 1] < 170 || d[i + 2] < 170) { clean = false; break }
    }
    if (clean) return y
  }
  return target
}

// 표 안(왼쪽 테두리가 이어지는 줄)에서 잘렸는지
function inTable(ctx: CanvasRenderingContext2D, k: number, y: number): boolean {
  const d = ctx.getImageData(Math.round(52 * k) - 2, y, 5, 1).data
  for (let i = 0; i < d.length; i += 4) if (d[i] < 120) return true
  return false
}

// 진정서 양식(container)을 A4 PDF로 렌더링. 인쇄창 없이 파일 저장·메일 첨부에 모두 사용.
async function render(container: HTMLElement): Promise<jsPDF> {
  const prev = container.style.cssText
  container.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;background:#fff'
  try {
    if (document.fonts?.ready) await document.fonts.ready
    const target = (container.firstElementChild as HTMLElement) ?? container
    // 화면(창) 크기와 상관없이 양식 폭(794px = A4)에 맞춰 캡처
    const w = target.offsetWidth || 794
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true, width: w, windowWidth: w, scrollX: 0, scrollY: 0 })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const imgH = (canvas.height * PW) / canvas.width
    if (imgH <= PH * 1.08) {
      const img = canvas.toDataURL('image/jpeg', 0.92)
      if (imgH > PH) {
        // 살짝 넘치면 한 장에 맞춰 축소
        const sw = (PW * PH) / imgH
        pdf.addImage(img, 'JPEG', (PW - sw) / 2, 0, sw, PH)
      } else {
        pdf.addImage(img, 'JPEG', 0, 0, PW, imgH)
      }
      return pdf
    }

    // 길면 쪽을 나눔: 글자 줄 사이에서 자르고, 표 안에서 잘리면 잘린 면에 테두리를 그려 양식이 이어지게 함
    const ctx = canvas.getContext('2d')!
    const k = canvas.width / w
    const pxPerMm = canvas.width / PW
    const areaPx = (PH - MARGIN * 2) * pxPerMm
    let start = 0, page = 0
    while (start < canvas.height - 2) {
      const first = page === 0
      const avail = first ? (PH - MARGIN) * pxPerMm : areaPx
      let end = start + avail
      let cut = false
      if (end >= canvas.height) end = canvas.height
      else { end = findCut(ctx, k, Math.round(end), Math.round(start + avail * 0.75)); cut = true }
      const h = Math.round(end - start)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = h
      const sc = slice.getContext('2d')!
      sc.fillStyle = '#fff'
      sc.fillRect(0, 0, slice.width, h)
      sc.drawImage(canvas, 0, start, canvas.width, h, 0, 0, canvas.width, h)
      const lx = Math.round(52 * k), rx = Math.round(742 * k), lw = Math.max(2, Math.round(k))
      sc.fillStyle = '#000'
      if (!first && inTable(ctx, k, Math.round(start) + 1)) sc.fillRect(lx, 0, rx - lx, lw)
      if (cut && inTable(ctx, k, Math.round(end) - 1)) sc.fillRect(lx, h - lw, rx - lx, lw)
      if (!first) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, first ? 0 : MARGIN, PW, (h * PW) / canvas.width)
      start = end
      page++
    }
    return pdf
  } finally {
    container.style.cssText = prev
  }
}

export async function savePdf(container: HTMLElement, filename: string) {
  const pdf = await render(container)
  pdf.save(filename)
}

// 메일 첨부용: PDF를 base64 문자열로
export async function pdfBase64(container: HTMLElement): Promise<string> {
  const pdf = await render(container)
  return pdf.output('datauristring').split(',')[1]
}
