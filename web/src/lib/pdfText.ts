// 계약서 PDF 읽기: 글자가 들어 있는 PDF는 글자를 바로 꺼내고, 스캔본(그림)이면 페이지를 그림으로 바꿔 OCR에 넘김.
// 모든 처리는 브라우저 안에서만 일어나고 파일은 서버로 올라가지 않아요.
const MAX_PAGES = 5

export type PdfRead = { text: string; images: string[] }

export async function readPdf(file: File): Promise<PdfRead> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages = Math.min(pdf.numPages, MAX_PAGES)

  let text = ''
  for (let i = 1; i <= pages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent()
    for (const it of tc.items) {
      if ('str' in it) text += it.str + (it.hasEOL ? '\n' : ' ')
    }
    text += '\n'
  }
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if ((text.match(/[가-힣]/g) || []).length >= 40) return { text, images: [] }

  // 글자가 없는 PDF(스캔본): 페이지를 그림으로 바꿔 OCR
  const images: string[] = []
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    images.push(canvas.toDataURL('image/png'))
  }
  return { text: '', images }
}
