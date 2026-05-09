import { useState, useRef, useCallback, useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import * as XLSX from 'xlsx'
import { Upload, Download, Plus, Trash2, TableProperties } from 'lucide-react'
import { toast } from 'sonner'
import { downloadBlob, formatBytes } from '../../lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type CellValue = string | number | null
type SheetData = CellValue[][]
interface SheetTab { name: string; data: SheetData }
interface Sel { row: number; col: number }

const DEFAULT_ROWS = 30
const DEFAULT_COLS = 12
const COL_W = 110

function colLabel(i: number): string {
  let label = ''
  let n = i + 1
  while (n > 0) { label = String.fromCharCode(65 + ((n - 1) % 26)) + label; n = Math.floor((n - 1) / 26) }
  return label
}

function emptySheet(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): SheetData {
  return Array.from({ length: rows }, () => Array(cols).fill(null))
}

// ─── Inline cell editor ───────────────────────────────────────────────────────
function CellInput({ init, onDone }: { init: string; onDone: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.select() }, [])
  return (
    <input ref={ref} defaultValue={init} autoFocus
      onBlur={e => onDone(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); onDone(ref.current!.value) }
        if (e.key === 'Escape') onDone(init)
      }}
      style={{
        width: '100%', height: '100%', border: 'none', outline: 'none', padding: '0 6px',
        background: '#1e3a5f', color: '#e2e8f0', fontSize: 12,
        fontFamily: 'inherit', boxSizing: 'border-box',
      }}
    />
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SpreadsheetModule() {
  const [sheets, setSheets] = useState<SheetTab[]>([{ name: 'Hoja1', data: emptySheet() }])
  const [activeSheet, setActiveSheet] = useState(0)
  const [fileName, setFileName] = useState('')
  const [sel, setSel] = useState<Sel>({ row: 0, col: 0 })
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const sheet = sheets[activeSheet]
  const numRows = sheet.data.length
  const numCols = Math.max(DEFAULT_COLS, ...sheet.data.map(r => r.length))

  const get = (r: number, c: number): CellValue => sheet.data[r]?.[c] ?? null
  const getStr = (r: number, c: number): string => { const v = get(r, c); return v === null ? '' : String(v) }

  const set = useCallback((r: number, c: number, raw: string) => {
    const value: CellValue = raw === '' ? null : (isNaN(Number(raw)) ? raw : Number(raw))
    setSheets(prev => prev.map((s, si) => {
      if (si !== activeSheet) return s
      const data = s.data.map(row => [...row])
      while (data.length <= r) data.push(Array(numCols).fill(null))
      while (data[r].length <= c) data[r].push(null)
      data[r][c] = value
      return { ...s, data }
    }))
  }, [activeSheet, numCols])

  // ── File I/O ──────────────────────────────────────────────────────────────
  const openFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['xlsx', 'xls', 'csv', 'ods'].includes(ext)) { toast.error('Usa .xlsx, .xls o .csv'); return }
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', codepage: 65001 })
    const newSheets: SheetTab[] = wb.SheetNames.map(name => {
      const raw: CellValue[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: false }) as CellValue[][]
      const cols = Math.max(DEFAULT_COLS, ...raw.map(r => r.length))
      const data: SheetData = raw.map(r => { const row = [...r]; while (row.length < cols) row.push(null); return row })
      while (data.length < DEFAULT_ROWS) data.push(Array(cols).fill(null))
      return { name, data }
    })
    setSheets(newSheets); setActiveSheet(0); setFileName(file.name); setSel({ row: 0, col: 0 })
    toast.success(`${file.name} — ${wb.SheetNames.length} hoja${wb.SheetNames.length !== 1 ? 's' : ''}`)
  }

  const downloadXlsx = () => {
    const wb = XLSX.utils.book_new()
    sheets.forEach(s => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.data.map(r => r.map(v => v ?? ''))), s.name))
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    downloadBlob(blob, fileName || 'libro.xlsx')
    toast.success(`Descargado — ${formatBytes(blob.size)}`)
  }

  // ── Sheet management ──────────────────────────────────────────────────────
  const addSheet = () => {
    const name = `Hoja${sheets.length + 1}`
    setSheets(prev => [...prev, { name, data: emptySheet() }])
    setActiveSheet(sheets.length)
  }
  const deleteSheet = (i: number) => {
    if (sheets.length === 1) { toast.error('Debe haber al menos una hoja'); return }
    setSheets(prev => prev.filter((_, si) => si !== i))
    setActiveSheet(Math.max(0, i - 1))
  }
  const renameSheet = (i: number) => {
    const name = prompt('Nombre:', sheets[i].name)
    if (name?.trim()) setSheets(prev => prev.map((s, si) => si === i ? { ...s, name: name.trim() } : s))
  }

  // ── Row / col add/delete ──────────────────────────────────────────────────
  const addRow = () => setSheets(prev => prev.map((s, si) =>
    si !== activeSheet ? s : { ...s, data: [...s.data, Array(numCols).fill(null)] }))
  const delRow = () => {
    if (numRows <= 1) return
    setSheets(prev => prev.map((s, si) =>
      si !== activeSheet ? s : { ...s, data: s.data.filter((_, ri) => ri !== sel.row) }))
    setSel(s => ({ ...s, row: Math.max(0, s.row - 1) }))
  }
  const addCol = () => setSheets(prev => prev.map((s, si) =>
    si !== activeSheet ? s : { ...s, data: s.data.map(r => [...r, null]) }))
  const delCol = () => {
    if (numCols <= 1) return
    setSheets(prev => prev.map((s, si) =>
      si !== activeSheet ? s : { ...s, data: s.data.map(r => r.filter((_, ci) => ci !== sel.col)) }))
    setSel(s => ({ ...s, col: Math.max(0, s.col - 1) }))
  }

  // ── Keyboard nav ──────────────────────────────────────────────────────────
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return
    const { row, col } = sel
    const nav: Record<string, Sel> = {
      ArrowUp:   { row: Math.max(0, row - 1), col },
      ArrowDown: { row: Math.min(numRows - 1, row + 1), col },
      ArrowLeft: { row, col: Math.max(0, col - 1) },
      ArrowRight:{ row, col: Math.min(numCols - 1, col + 1) },
      Tab:       { row, col: Math.min(numCols - 1, col + 1) },
    }
    if (nav[e.key]) { e.preventDefault(); setSel(nav[e.key]); return }
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(true); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); set(row, col, ''); return }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { set(row, col, ''); setEditing(true) }
  }

  const formulaVal = getStr(sel.row, sel.col)

  return (
    <div ref={containerRef} className="flex flex-col h-full" style={{ outline: 'none' }} tabIndex={0} onKeyDown={handleKey}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 no-print flex-wrap"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
          style={{ background: '#1d4ed8', color: 'white' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e40af')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1d4ed8')}>
          <Upload size={13} /> Abrir archivo
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden"
          onChange={e => { if (e.target.files?.[0]) openFile(e.target.files[0]) }} />

        {fileName && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-400"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <TableProperties size={11} className="text-emerald-400" />
            {fileName}
          </div>
        )}

        <div className="w-px h-5 mx-1" style={{ background: '#1e293b' }} />

        {[
          { label: '+ Fila', action: addRow, color: '#64748b' },
          { label: '+ Columna', action: addCol, color: '#64748b' },
          { label: '− Fila', action: delRow, color: '#f87171' },
          { label: '− Columna', action: delCol, color: '#f87171' },
        ].map(({ label, action, color }) => (
          <button key={label} onClick={action}
            className="px-2.5 py-1.5 text-xs rounded-md transition-colors"
            style={{ background: '#111827', border: '1px solid #1e293b', color }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}>
            {label}
          </button>
        ))}

        <div className="flex-1" />
        <button onClick={downloadXlsx}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
          style={{ background: '#065f46', color: '#6ee7b7' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
          onMouseLeave={e => (e.currentTarget.style.background = '#065f46')}>
          <Download size={13} /> Descargar .xlsx
        </button>
      </div>

      {/* Formula bar */}
      <div className="flex items-center shrink-0" style={{ background: '#0b1120', borderBottom: '1px solid #1a2332', height: 30 }}>
        <div className="flex items-center justify-center text-xs font-mono font-semibold text-blue-400 shrink-0"
          style={{ width: 56, borderRight: '1px solid #1a2332', height: '100%' }}>
          {colLabel(sel.col)}{sel.row + 1}
        </div>
        <input value={formulaVal}
          onChange={e => set(sel.row, sel.col, e.target.value)}
          placeholder="Valor de la celda..."
          className="flex-1 text-xs text-slate-300 outline-none px-3 placeholder-slate-700"
          style={{ background: 'transparent', fontFamily: 'monospace', height: '100%' }}
        />
      </div>

      {/* Grid */}
      <div ref={tableRef} className="flex-1 overflow-auto" style={{ background: '#080d14' }}>
        {sheet.data.every(r => r.every(c => c === null)) && !fileName ? (
          /* Empty / drop zone */
          <div className="flex flex-col items-center justify-center h-full gap-4 m-6 rounded-xl cursor-pointer transition-all"
            style={{ border: `2px dashed ${dragging ? '#10b981' : '#1e293b'}`, background: dragging ? 'rgba(16,185,129,0.04)' : 'transparent' }}
            onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]) }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#0f172a' }}>
              <TableProperties size={26} className="text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Arrastra un archivo Excel aquí</p>
              <p className="text-xs text-slate-600 mt-1">o haz clic para abrirlo · .xlsx, .xls, .csv</p>
              <p className="text-xs text-slate-700 mt-3">O empieza a escribir directamente en la hoja vacía de abajo</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setFileName('nuevo.xlsx') }}
              className="px-4 py-2 text-xs font-medium rounded-md text-emerald-400"
              style={{ background: '#064e3b', border: '1px solid #065f46' }}>
              Crear hoja en blanco
            </button>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
            {/* Col widths */}
            <colgroup>
              <col style={{ width: 48 }} />
              {Array.from({ length: numCols }).map((_, ci) => <col key={ci} style={{ width: COL_W }} />)}
            </colgroup>

            {/* Header row */}
            <thead>
              <tr>
                {/* Corner */}
                <th style={{
                  position: 'sticky', top: 0, left: 0, zIndex: 4,
                  background: '#0d1520', border: '1px solid #1e293b',
                  width: 48, height: 26,
                }} />
                {Array.from({ length: numCols }).map((_, ci) => (
                  <th key={ci} onClick={() => setSel(s => ({ ...s, col: ci }))}
                    style={{
                      position: 'sticky', top: 0, zIndex: 3,
                      background: sel.col === ci ? '#1a2a4a' : '#0d1520',
                      border: '1px solid #1e293b',
                      height: 26, fontSize: 11, fontWeight: 600,
                      color: sel.col === ci ? '#93c5fd' : '#475569',
                      cursor: 'pointer', userSelect: 'none', textAlign: 'center',
                    }}>
                    {colLabel(ci)}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {Array.from({ length: numRows }).map((_, ri) => (
                <tr key={ri}>
                  {/* Row number */}
                  <td onClick={() => setSel(s => ({ ...s, row: ri }))}
                    style={{
                      position: 'sticky', left: 0, zIndex: 2,
                      background: sel.row === ri ? '#1a2a4a' : '#0a1020',
                      border: '1px solid #1a2332',
                      width: 48, height: 26, fontSize: 11,
                      color: sel.row === ri ? '#93c5fd' : '#374151',
                      textAlign: 'center', cursor: 'pointer', userSelect: 'none',
                    }}>
                    {ri + 1}
                  </td>

                  {/* Data cells */}
                  {Array.from({ length: numCols }).map((_, ci) => {
                    const isSelected = sel.row === ri && sel.col === ci
                    const val = get(ri, ci)
                    const isNum = typeof val === 'number'
                    return (
                      <td key={ci}
                        onClick={() => { setSel({ row: ri, col: ci }); setEditing(false); containerRef.current?.focus() }}
                        onDoubleClick={() => { setSel({ row: ri, col: ci }); setEditing(true) }}
                        style={{
                          position: 'relative',
                          background: isSelected ? '#0f2040' : (ri % 2 === 0 ? '#080d14' : '#090e16'),
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #1a2332',
                          height: 26, maxWidth: COL_W, overflow: 'hidden',
                          fontSize: 12, cursor: 'default',
                          padding: isSelected && editing ? 0 : '0 6px',
                          color: isNum ? '#86efac' : '#cbd5e1',
                          textAlign: isNum ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                        }}>
                        {isSelected && editing
                          ? <CellInput init={getStr(ri, ci)}
                              onDone={v => { set(ri, ci, v); setEditing(false); containerRef.current?.focus() }} />
                          : (val === null ? '' : String(val))
                        }
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center shrink-0 no-print"
        style={{ background: '#0a0f1a', borderTop: '1px solid #1a2332', height: 34 }}>
        <div className="flex items-center overflow-x-auto flex-1" style={{ height: '100%' }}>
          {sheets.map((s, i) => (
            <div key={i}
              onClick={() => { setActiveSheet(i); setSel({ row: 0, col: 0 }) }}
              onDoubleClick={() => renameSheet(i)}
              className="flex items-center gap-2 shrink-0 cursor-pointer transition-colors group"
              style={{
                height: '100%', padding: '0 14px',
                background: i === activeSheet ? '#0d1117' : 'transparent',
                borderRight: '1px solid #1a2332',
                borderTop: i === activeSheet ? '2px solid #10b981' : '2px solid transparent',
                fontSize: 11, color: i === activeSheet ? '#e2e8f0' : '#475569',
              }}>
              {s.name}
              {sheets.length > 1 && (
                <button onClick={e => { e.stopPropagation(); deleteSheet(i) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all">
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addSheet}
            className="flex items-center gap-1 px-3 text-slate-600 hover:text-emerald-400 transition-colors shrink-0 text-xs"
            style={{ height: '100%' }}>
            <Plus size={11} /> Nueva hoja
          </button>
        </div>
      </div>
    </div>
  )
}
