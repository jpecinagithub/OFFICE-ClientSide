import { useState, useRef, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Upload, Download, FileText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import mammoth from 'mammoth'
import {
  Document, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, Packer, WidthType,
} from 'docx'
import { downloadBlob } from '../../lib/utils'

interface OpenFile { name: string; type: 'txt' | 'docx' }

// ─── HTML → docx converter (browser-safe, uses existing `docx` lib) ──────────

function parseInline(node: Node, bold = false, italics = false, underline = false): TextRun[] {
  const runs: TextRun[] = []
  const walk = (n: Node, b: boolean, i: boolean, u: boolean) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent ?? ''
      if (text) runs.push(new TextRun({ text, bold: b, italics: i, underline: u ? {} : undefined }))
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') { runs.push(new TextRun({ text: '', break: 1 })); return }
      walk(el as Node, b || tag === 'strong' || tag === 'b',
           i || tag === 'em' || tag === 'i',
           u || tag === 'u')
    }
  }
  for (const child of Array.from(node.childNodes)) walk(child, bold, italics, underline)
  return runs
}

function parseBlock(el: Element): (Paragraph | Table)[] {
  const tag = el.tagName.toLowerCase()
  const inline = () => { const r = parseInline(el); return r.length ? r : [new TextRun('')] }

  if (tag === 'p')  return [new Paragraph({ children: inline() })]
  if (tag === 'h1') return [new Paragraph({ children: inline(), heading: HeadingLevel.HEADING_1 })]
  if (tag === 'h2') return [new Paragraph({ children: inline(), heading: HeadingLevel.HEADING_2 })]
  if (tag === 'h3') return [new Paragraph({ children: inline(), heading: HeadingLevel.HEADING_3 })]
  if (tag === 'h4') return [new Paragraph({ children: inline(), heading: HeadingLevel.HEADING_4 })]
  if (tag === 'h5') return [new Paragraph({ children: inline(), heading: HeadingLevel.HEADING_5 })]
  if (tag === 'h6') return [new Paragraph({ children: inline(), heading: HeadingLevel.HEADING_6 })]

  if (tag === 'ul' || tag === 'ol') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li) =>
      new Paragraph({
        children: parseInline(li),
        bullet: tag === 'ul' ? { level: 0 } : undefined,
        numbering: tag === 'ol' ? { reference: 'ol', level: 0 } : undefined,
      })
    )
  }

  if (tag === 'table') {
    const rows: TableRow[] = []
    for (const tr of Array.from(el.querySelectorAll('tr'))) {
      const cells: TableCell[] = []
      for (const td of Array.from(tr.querySelectorAll('td, th'))) {
        cells.push(new TableCell({ children: [new Paragraph({ children: parseInline(td) })] }))
      }
      if (cells.length) rows.push(new TableRow({ children: cells }))
    }
    if (rows.length) return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })]
  }

  // Generic block: extract text
  const text = el.textContent?.trim()
  return text ? [new Paragraph({ children: [new TextRun(text)] })] : []
}

async function buildDocxBlob(html: string): Promise<Blob> {
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const children: (Paragraph | Table)[] = []
  for (const el of Array.from(dom.body.children)) {
    children.push(...parseBlock(el))
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'ol',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: 'start' }],
      }],
    },
    sections: [{ children: children.length ? children : [new Paragraph('')] }],
  })
  return Packer.toBlob(doc)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TextModule() {
  const [file, setFile]           = useState<OpenFile | null>(null)
  const [txtContent, setTxtContent] = useState('')
  const [docHtml, setDocHtml]     = useState('')
  const [dragging, setDragging]   = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const docRef    = useRef<HTMLDivElement>(null)

  // Sync mammoth HTML into contentEditable only when a new file is loaded
  useEffect(() => {
    if (docRef.current && file?.type === 'docx') {
      docRef.current.innerHTML = docHtml
    }
  }, [docHtml]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpen = useCallback(async (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext === 'txt') {
      setFile({ name: f.name, type: 'txt' })
      setTxtContent(await f.text())
    } else if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }, {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Title']     => h1:fresh",
          "p[style-name='Subtitle']  => h2:fresh",
        ],
      })
      setFile({ name: f.name, type: 'docx' })
      setDocHtml(result.value)
      if (result.messages.some(m => m.type === 'warning')) {
        toast.warning('Algunos elementos del DOCX no pudieron convertirse completamente')
      }
    } else {
      toast.error('Formato no soportado. Usa .txt o .docx')
    }
  }, [])

  const downloadTxt = () => {
    downloadBlob(new Blob([txtContent], { type: 'text/plain;charset=utf-8' }),
      file!.name.replace(/\.[^.]+$/, '.txt'))
    toast.success('Descargado como .txt')
  }

  const downloadDocx = async () => {
    try {
      const html = docRef.current?.innerHTML ?? ''
      const blob = await buildDocxBlob(html)
      downloadBlob(blob, file!.name.endsWith('.docx') ? file!.name : file!.name.replace(/\.[^.]+$/, '.docx'))
      toast.success('Documento descargado')
    } catch (err) {
      console.error(err)
      toast.error('Error al generar el .docx')
    }
  }

  const closeFile = () => { setFile(null); setTxtContent(''); setDocHtml('') }

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
          style={{ background: '#1d4ed8', color: 'white' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e40af')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1d4ed8')}>
          <Upload size={13} /> Abrir archivo
        </button>
        <input ref={inputRef} type="file" accept=".txt,.docx" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleOpen(e.target.files[0]) }} />

        {file && (
          <>
            <div className="flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-md"
              style={{ background: '#1a2332' }}>
              <FileText size={12} className="text-sky-400" />
              <span className="text-xs text-slate-300">{file.name}</span>
            </div>

            <div className="flex-1" />

            {file.type === 'txt' ? (
              <button onClick={downloadTxt}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
                style={{ background: '#065f46', color: '#6ee7b7' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
                onMouseLeave={e => (e.currentTarget.style.background = '#065f46')}>
                <Download size={13} /> Descargar .txt
              </button>
            ) : (
              <button onClick={downloadDocx}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
                style={{ background: '#065f46', color: '#6ee7b7' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
                onMouseLeave={e => (e.currentTarget.style.background = '#065f46')}>
                <Download size={13} /> Descargar .docx
              </button>
            )}

            <button onClick={closeFile}
              className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-md">
              <Trash2 size={14} />
            </button>
          </>
        )}
        {!file && <span className="text-xs text-slate-600 ml-2">Soporta .txt y .docx</span>}
      </div>

      {/* Content area */}
      {!file ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 m-6 rounded-xl cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${dragging ? '#3b82f6' : '#1e293b'}`,
            background: dragging ? 'rgba(59,130,246,0.05)' : 'transparent',
          }}
          onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleOpen(e.dataTransfer.files[0]) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#0f172a' }}>
            <FileText size={26} className="text-sky-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-400">Arrastra tu archivo aquí</p>
            <p className="text-xs text-slate-600 mt-1">o haz clic para buscar · .txt y .docx</p>
          </div>
        </div>

      ) : file.type === 'txt' ? (
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            value={txtContent}
            onChange={v => setTxtContent(v ?? '')}
            theme="vs-dark"
            options={{
              fontSize: 14, lineHeight: 24, wordWrap: 'on',
              minimap: { enabled: false }, scrollBeyondLastLine: false,
              padding: { top: 20, bottom: 20 }, renderLineHighlight: 'none',
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            }}
          />
        </div>

      ) : (
        /* DOCX rendered view */
        <div className="flex-1 overflow-y-auto" style={{ background: '#141920' }}>
          <div className="max-w-[820px] mx-auto my-10 bg-white shadow-2xl"
            style={{ borderRadius: 2, minHeight: 1000 }}>
            <div
              ref={docRef}
              contentEditable
              suppressContentEditableWarning
              className="doc-body outline-none"
              style={{ padding: '72px 80px', minHeight: 900 }}
            />
          </div>
        </div>
      )}

      <style>{`
        .doc-body {
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #1a1a1a;
        }
        .doc-body h1 { font-size: 2em;    font-weight: 700; margin: .4em 0 .3em; color: #111; }
        .doc-body h2 { font-size: 1.5em;  font-weight: 700; margin: .5em 0 .3em; color: #222; }
        .doc-body h3 { font-size: 1.17em; font-weight: 700; margin: .5em 0 .3em; color: #333; }
        .doc-body h4 { font-size: 1em;    font-weight: 700; margin: .5em 0 .3em; }
        .doc-body p  { margin: 0 0 .7em; }
        .doc-body p:last-child { margin-bottom: 0; }
        .doc-body strong, .doc-body b { font-weight: 700; }
        .doc-body em, .doc-body i     { font-style: italic; }
        .doc-body u                    { text-decoration: underline; }
        .doc-body ul { list-style: disc;    padding-left: 1.5em; margin: 0 0 .7em; }
        .doc-body ol { list-style: decimal; padding-left: 1.5em; margin: 0 0 .7em; }
        .doc-body li { margin-bottom: .25em; }
        .doc-body table {
          border-collapse: collapse; width: 100%; margin: 1em 0;
          font-size: .95em;
        }
        .doc-body td, .doc-body th {
          border: 1px solid #d1d5db; padding: 6px 10px; vertical-align: top;
        }
        .doc-body th { background: #f3f4f6; font-weight: 600; }
        .doc-body img { max-width: 100%; height: auto; display: block; margin: .5em 0; }
        .doc-body a   { color: #2563eb; }
        .doc-body blockquote {
          border-left: 3px solid #d1d5db; margin: .7em 0; padding-left: 1em; color: #555;
        }
      `}</style>
    </div>
  )
}
