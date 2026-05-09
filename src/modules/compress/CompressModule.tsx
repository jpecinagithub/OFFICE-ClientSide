import { useState, useCallback, useRef } from 'react'
import { Archive, Upload, Trash2, Download, File } from 'lucide-react'
import { toast } from 'sonner'
import JSZip from 'jszip'
import { downloadBlob, formatBytes } from '../../lib/utils'

interface FileItem { file: File; id: string }

export default function CompressModule() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [zipName, setZipName] = useState('archivo')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    setFiles(prev => [
      ...prev,
      ...Array.from(incoming).map(f => ({ file: f, id: `${f.name}-${f.size}-${Date.now()}` }))
    ])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const remove = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const compress = async () => {
    if (!files.length) { toast.error('Añade al menos un archivo'); return }
    setLoading(true)
    setProgress(0)
    try {
      const zip = new JSZip()
      for (const { file } of files) zip.file(file.name, file)
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        meta => setProgress(Math.round(meta.percent))
      )
      downloadBlob(blob, `${zipName || 'archivo'}.zip`)
      toast.success(`ZIP creado — ${formatBytes(blob.size)}`)
    } catch {
      toast.error('Error al comprimir los archivos')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const totalSize = files.reduce((acc, { file }) => acc + file.size, 0)

  const extColor: Record<string, string> = {
    pdf: 'text-orange-400', txt: 'text-sky-400', docx: 'text-blue-400',
    jpg: 'text-pink-400', jpeg: 'text-pink-400', png: 'text-pink-400',
    mp4: 'text-purple-400', zip: 'text-violet-400',
  }
  const getColor = (name: string) => extColor[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'text-slate-400'

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 no-print" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Nombre:</label>
          <input
            value={zipName}
            onChange={e => setZipName(e.target.value)}
            className="text-sm text-slate-200 w-40 outline-none rounded-md px-2.5 py-1.5"
            style={{ background: '#1a2332', border: '1px solid #2d3f55' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e => (e.currentTarget.style.borderColor = '#2d3f55')}
          />
          <span className="text-xs text-slate-600">.zip</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all text-slate-300"
          style={{ background: '#1a2332', border: '1px solid #2d3f55' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#475569')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2d3f55')}
        >
          <Upload size={13} /> Añadir archivos
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
      </div>

      {/* Drop zone */}
      <div
        className="flex-1 overflow-y-auto m-4 rounded-xl transition-all duration-200"
        style={{
          border: `2px dashed ${dragging ? '#7c3aed' : files.length ? '#1e293b' : '#1a2332'}`,
          background: dragging ? 'rgba(124,58,237,0.05)' : 'transparent',
        }}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 cursor-pointer" onClick={() => inputRef.current?.click()}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#0f172a' }}>
              <Archive size={26} className="text-violet-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Arrastra archivos aquí</p>
              <p className="text-xs text-slate-600 mt-1">o haz clic para seleccionarlos · cualquier formato</p>
            </div>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-1.5">
            {files.map(({ file, id }) => (
              <div key={id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                style={{ background: '#111827', border: '1px solid #1e293b' }}>
                <File size={15} className={cn('shrink-0', getColor(file.name))} />
                <span className="text-sm text-slate-300 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-slate-600">{formatBytes(file.size)}</span>
                <button onClick={() => remove(id)}
                  className="text-slate-700 hover:text-red-400 transition-colors ml-1 opacity-0 group-hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 pb-4">
        <span className="text-xs text-slate-600">
          {files.length > 0 ? `${files.length} archivo${files.length !== 1 ? 's' : ''} · ${formatBytes(totalSize)}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {files.length > 0 && (
            <button onClick={() => setFiles([])}
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors rounded-md">
              Limpiar todo
            </button>
          )}
          <button onClick={compress} disabled={loading || files.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#1d4ed8', color: 'white' }}
            onMouseEnter={e => { if (!loading && files.length) e.currentTarget.style.background = '#1e40af' }}
            onMouseLeave={e => (e.currentTarget.style.background = '#1d4ed8')}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {progress}%
              </>
            ) : (
              <><Download size={14} /> Crear ZIP y descargar</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// pequeña helper inline para no importar cn
function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ')
}
