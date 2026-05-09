import { useState, useRef } from 'react'
import { Sparkles, Download, ChevronDown, X } from 'lucide-react'
import { toast } from 'sonner'

const MODELS = [
  { id: 'qwen-image-2.0',              label: 'Qwen Image 2.0'       },
  { id: 'qwen-image-max-2025-12-30',   label: 'Qwen Image Max'       },
]

const SIZES = [
  { id: '1024*1024', label: 'Cuadrado  1024×1024'  },
  { id: '1280*720',  label: 'Panorama  1280×720'   },
  { id: '720*1280',  label: 'Vertical  720×1280'   },
  { id: '1280*960',  label: 'Paisaje   1280×960'   },
  { id: '960*1280',  label: 'Retrato   960×1280'   },
]

const LS = { model: 'img_model', size: 'img_size' }

function Select({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none text-xs text-slate-300 rounded-md px-3 py-2 outline-none pr-7 h-8"
        style={{ background: '#111827', border: '1px solid #1e293b' }}>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
    </div>
  )
}

export default function ImageModule() {
  const [prompt, setPrompt]           = useState('')
  const [negPrompt, setNegPrompt]     = useState('')
  const [model, setModel]             = useState(() => localStorage.getItem(LS.model) ?? 'qwen-image-2.0')
  const [size, setSize]               = useState(() => localStorage.getItem(LS.size)  ?? '1024*1024')
  const [imageUrl, setImageUrl]       = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [showNeg, setShowNeg]         = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const savePrefs = (m: string, s: string) => {
    localStorage.setItem(LS.model, m)
    localStorage.setItem(LS.size,  s)
  }

  const generate = async () => {
    if (!prompt.trim()) { toast.error('Escribe una descripción'); return }
    setLoading(true)
    setImageUrl(null)
    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), negativePrompt: negPrompt, model, size }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? `Error ${res.status}`)
      }
      // API now returns the image binary directly (same-origin, COEP-safe)
      const blob = await res.blob()
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      setImageUrl(URL.createObjectURL(blob))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar la imagen')
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `imagen-${Date.now()}.png`
    a.click()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate()
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#080d14' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <Select value={model} onChange={v => { setModel(v); savePrefs(v, size) }} options={MODELS} />
        <Select value={size}  onChange={v => { setSize(v);  savePrefs(model, v) }} options={SIZES}  />
        <div className="flex-1" />
        {imageUrl && (
          <button onClick={download}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
            style={{ background: '#065f46', color: '#6ee7b7' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
            onMouseLeave={e => (e.currentTarget.style.background = '#065f46')}>
            <Download size={13} /> Descargar
          </button>
        )}
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Prompt area */}
        <div className="shrink-0 px-6 pt-6 pb-4 flex flex-col gap-3" style={{ borderBottom: '1px solid #1a2332' }}>
          <div className="relative">
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={onKey}
              placeholder="Describe la imagen que quieres generar… (Ctrl+Enter para generar)"
              rows={3}
              className="w-full resize-none text-sm text-slate-200 rounded-xl px-4 py-3 outline-none placeholder-slate-700 leading-relaxed"
              style={{ background: '#111827', border: '1px solid #1e293b' }}
            />
          </div>

          {/* Negative prompt toggle */}
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNeg(s => !s)}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
              {showNeg ? <X size={11} /> : <span>+</span>}
              {showNeg ? 'Ocultar prompt negativo' : 'Añadir prompt negativo'}
            </button>

            <div className="flex-1" />

            <button onClick={generate} disabled={!prompt.trim() || loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #92400e, #b45309)', color: '#fef3c7' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              <Sparkles size={15} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Generando…' : 'Generar imagen'}
            </button>
          </div>

          {showNeg && (
            <input
              value={negPrompt}
              onChange={e => setNegPrompt(e.target.value)}
              placeholder="Lo que NO quieres en la imagen (borroso, feo, texto, marca de agua…)"
              className="text-xs text-slate-400 rounded-lg px-4 py-2.5 outline-none placeholder-slate-700"
              style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            />
          )}
        </div>

        {/* Image display */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {loading ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-amber-900 animate-ping opacity-20" />
                <div className="absolute inset-2 rounded-full border-2 border-amber-700 animate-spin" style={{ borderTopColor: 'transparent' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles size={22} className="text-amber-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Generando imagen…</p>
                <p className="text-xs text-slate-700 mt-1">Puede tardar entre 10 y 30 segundos</p>
              </div>
            </div>
          ) : imageUrl ? (
            <div className="flex flex-col items-center gap-4">
              <img
                src={imageUrl}
                alt={prompt}
                className="rounded-xl shadow-2xl max-w-full max-h-[65vh] object-contain"
                style={{ border: '1px solid #1e293b' }}
              />
              <p className="text-xs text-slate-700 max-w-md text-center line-clamp-2">"{prompt}"</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #451a03, #92400e)' }}>
                <Sparkles size={32} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Escribe una descripción arriba</p>
                <p className="text-xs text-slate-700 mt-1">Powered by Alibaba Qwen Image</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
