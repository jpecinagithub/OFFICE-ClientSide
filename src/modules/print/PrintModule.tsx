import { useRef, useState } from 'react'
import { Printer, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'
import mammoth from 'mammoth'

export default function PrintModule() {
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    setFileName(f.name)
    if (ext === 'txt') {
      const text = await f.text()
      setContent(text.replace(/\n/g, '<br/>'))
    } else if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })
      setContent(result.value)
    } else {
      toast.error('Solo se aceptan .txt y .docx')
    }
  }

  const print = () => {
    if (!content) { toast.error('Carga un documento primero'); return }
    window.print()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 no-print"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md text-slate-300 transition-all"
          style={{ background: '#1a2332', border: '1px solid #2d3f55' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#475569')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2d3f55')}
        >
          <Upload size={13} /> Cargar documento
        </button>
        <input ref={inputRef} type="file" accept=".txt,.docx" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />

        {fileName && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-400"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <FileText size={12} className="text-rose-400" />
            {fileName}
          </div>
        )}

        <div className="flex-1" />

        <button onClick={print} disabled={!content}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#1d4ed8', color: 'white' }}
          onMouseEnter={e => { if (content) e.currentTarget.style.background = '#1e40af' }}
          onMouseLeave={e => (e.currentTarget.style.background = '#1d4ed8')}
        >
          <Printer size={14} /> Imprimir
        </button>
      </div>

      {/* Preview / Drop zone */}
      {content ? (
        <div className="flex-1 overflow-y-auto bg-white">
          <div
            id="print-content"
            className="max-w-3xl mx-auto p-12 text-gray-900 text-[15px] leading-relaxed"
            style={{ fontFamily: 'Georgia, serif' }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 m-6 rounded-xl cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${dragging ? '#f43f5e' : '#1e293b'}`,
            background: dragging ? 'rgba(244,63,94,0.05)' : 'transparent',
          }}
          onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#0f172a' }}>
            <Printer size={26} className="text-rose-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-400">Arrastra un documento aquí</p>
            <p className="text-xs text-slate-600 mt-1">o haz clic para buscarlo · .txt y .docx</p>
            <p className="text-xs text-slate-700 mt-3">El sistema abrirá el diálogo de impresora nativo</p>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-content, #print-content * { visibility: visible; }
          #print-content { position: fixed; top: 0; left: 0; width: 100%; padding: 2cm; font-family: Georgia, serif; }
        }
      `}</style>
    </div>
  )
}
