import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjs from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Upload, Download, FileType2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Type, X } from 'lucide-react'
import { toast } from 'sonner'
import { downloadBlob } from '../../lib/utils'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface Annotation { id: string; text: string; page: number; x: number; y: number }

export default function PdfModule() {
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [addingText, setAddingText] = useState(false)
  const [pendingText, setPendingText] = useState('')
  const [pendingPos, setPendingPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const renderTask = useRef<pdfjs.RenderTask | null>(null)

  const renderPage = useCallback(async (doc: pdfjs.PDFDocumentProxy, pageNum: number, sc: number) => {
    if (!canvasRef.current) return
    if (renderTask.current) renderTask.current.cancel()
    const p = await doc.getPage(pageNum)
    const viewport = p.getViewport({ scale: sc })
    const canvas = canvasRef.current
    canvas.width = viewport.width
    canvas.height = viewport.height
    renderTask.current = p.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport })
    try { await renderTask.current.promise } catch { /* cancelled */ }
  }, [])

  useEffect(() => { if (pdfDoc) renderPage(pdfDoc, page, scale) }, [pdfDoc, page, scale, renderPage])

  const openFile = async (f: File) => {
    if (!f.name.endsWith('.pdf')) { toast.error('Solo se aceptan archivos PDF'); return }
    const bytes = new Uint8Array(await f.arrayBuffer())
    setPdfBytes(bytes)
    setFileName(f.name)
    setAnnotations([])
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
    setPdfDoc(doc)
    setTotalPages(doc.numPages)
    setPage(1)
    toast.success(`${f.name} — ${doc.numPages} página${doc.numPages !== 1 ? 's' : ''}`)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!addingText) return
    const rect = canvasRef.current!.getBoundingClientRect()
    setPendingPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const confirmAnnotation = () => {
    if (!pendingPos || !pendingText.trim()) return
    setAnnotations(prev => [...prev, { id: Date.now().toString(), text: pendingText, page, x: pendingPos.x, y: pendingPos.y }])
    setPendingText('')
    setPendingPos(null)
    setAddingText(false)
  }

  const downloadPdf = async () => {
    if (!pdfBytes) return
    try {
      const doc = await PDFDocument.load(pdfBytes)
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const pages = doc.getPages()
      const canvas = canvasRef.current
      for (const ann of annotations) {
        const p = pages[ann.page - 1]
        const { height } = p.getSize()
        const ratio = canvas ? height / (canvas.height / scale) : 1
        p.drawText(ann.text, {
          x: (ann.x / scale) * ratio, y: height - (ann.y / scale) * ratio,
          size: 11, font, color: rgb(0.9, 0.1, 0.1),
        })
      }
      const saved = await doc.save()
      downloadBlob(new Blob([saved.buffer as ArrayBuffer], { type: 'application/pdf' }), `anotado_${fileName}`)
      toast.success('PDF descargado con anotaciones')
    } catch { toast.error('Error al generar el PDF') }
  }

  const Btn = ({ onClick, disabled, children, title }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; title?: string }) => (
    <button onClick={onClick} disabled={disabled} title={title}
      className="p-1.5 rounded-md transition-colors disabled:opacity-30 text-slate-400 hover:text-slate-200 hover:bg-[#1a2332]">
      {children}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 flex-wrap no-print"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
          style={{ background: '#1d4ed8', color: 'white' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e40af')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1d4ed8')}
        >
          <Upload size={13} /> Abrir PDF
        </button>
        <input ref={inputRef} type="file" accept=".pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) openFile(e.target.files[0]) }} />

        {pdfDoc && (
          <>
            <div className="flex items-center gap-1 ml-2 px-2 py-1 rounded-md text-xs text-slate-500 max-w-[180px]"
              style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
              <FileType2 size={11} className="text-orange-400 shrink-0" />
              <span className="truncate">{fileName}</span>
            </div>

            <div className="w-px h-5 mx-1" style={{ background: '#1e293b' }} />

            <Btn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft size={15} /></Btn>
            <span className="text-xs text-slate-500 tabular-nums w-16 text-center">{page} / {totalPages}</span>
            <Btn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}><ChevronRight size={15} /></Btn>

            <div className="w-px h-5 mx-1" style={{ background: '#1e293b' }} />

            <Btn onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))} title="Reducir zoom"><ZoomOut size={15} /></Btn>
            <span className="text-xs text-slate-500 tabular-nums w-10 text-center">{Math.round(scale * 100)}%</span>
            <Btn onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))} title="Ampliar zoom"><ZoomIn size={15} /></Btn>

            <div className="w-px h-5 mx-1" style={{ background: '#1e293b' }} />

            <button onClick={() => { setAddingText(!addingText); setPendingPos(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
              style={addingText
                ? { background: '#92400e', color: '#fcd34d', border: '1px solid #b45309' }
                : { background: '#111827', color: '#94a3b8', border: '1px solid #1e293b' }
              }
            >
              <Type size={13} /> {addingText ? 'Cancelar' : 'Añadir texto'}
            </button>

            {annotations.length > 0 && (
              <span className="text-xs text-slate-600 px-2">
                {annotations.filter(a => a.page === page).length} nota{annotations.length !== 1 ? 's' : ''} en esta página
              </span>
            )}

            <div className="flex-1" />
            <button onClick={downloadPdf}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
              style={{ background: '#065f46', color: '#6ee7b7' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
              onMouseLeave={e => (e.currentTarget.style.background = '#065f46')}
            >
              <Download size={13} /> Descargar PDF
            </button>
          </>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex flex-col items-center py-6 relative"
        style={{ background: '#070b12' }}>
        {!pdfDoc ? (
          <div
            className="flex flex-col items-center justify-center w-full h-full gap-4 m-6 rounded-xl cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragging ? '#f97316' : '#1e293b'}`,
              background: dragging ? 'rgba(249,115,22,0.05)' : 'transparent',
              maxWidth: '600px', margin: '24px auto',
            }}
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#0f172a' }}>
              <FileType2 size={26} className="text-orange-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Arrastra un PDF aquí</p>
              <p className="text-xs text-slate-600 mt-1">o haz clic para buscarlo</p>
            </div>
          </div>
        ) : (
          <div className="relative shadow-2xl">
            <canvas ref={canvasRef} onClick={handleCanvasClick}
              className={`rounded-sm ${addingText ? 'cursor-crosshair' : 'cursor-default'}`} />
            {annotations.filter(a => a.page === page).map(ann => (
              <div key={ann.id} style={{ position: 'absolute', left: ann.x, top: ann.y, transform: 'translate(0,-50%)' }}
                className="flex items-center gap-1 group">
                <span className="text-red-400 text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(248,113,113,0.3)' }}>
                  {ann.text}
                </span>
                <button onClick={() => setAnnotations(prev => prev.filter(a => a.id !== ann.id))}
                  className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity">
                  <X size={11} />
                </button>
              </div>
            ))}
            {pendingPos && addingText && (
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg shadow-xl"
                style={{ position: 'absolute', left: pendingPos.x, top: pendingPos.y, zIndex: 10, background: '#1e293b', border: '1px solid #3b82f6' }}>
                <input autoFocus value={pendingText} onChange={e => setPendingText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmAnnotation(); if (e.key === 'Escape') { setPendingPos(null); setPendingText('') } }}
                  placeholder="Escribe · Enter para confirmar"
                  className="bg-transparent text-xs text-slate-200 outline-none w-44 placeholder-slate-600" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
