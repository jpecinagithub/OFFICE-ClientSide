import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Settings, Trash2, X, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

// ─── Config ───────────────────────────────────────────────────────────────────
const MODELS = [
  { id: 'qwen-plus-2025-07-28',  label: 'Qwen Plus'         },
  { id: 'qwen2.5-14b-instruct',  label: 'Qwen 2.5 14B'      },
  { id: 'qwq-max-2025-03-25',    label: 'QwQ Max (razonamiento)' },
]

const LS = { model: 'qw_model', system: 'qw_system' }

interface Msg { role: 'user' | 'assistant'; content: string }

// ─── Markdown renderer (sin dangerouslySetInnerHTML) ─────────────────────────
function MsgContent({ text }: { text: string }) {
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g)
  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3).replace(/^[a-z]+\n/, '')
          return (
            <pre key={i} className="my-2 rounded-lg overflow-x-auto text-xs p-3"
              style={{ background: '#0d1117', border: '1px solid #1e293b', color: '#e2e8f0', fontFamily: 'monospace' }}>
              <code>{inner}</code>
            </pre>
          )
        }
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2)
          return (
            <code key={i} className="text-xs px-1 py-0.5 rounded"
              style={{ background: '#1e293b', color: '#93c5fd', fontFamily: 'monospace' }}>
              {seg.slice(1, -1)}
            </code>
          )
        return (
          <span key={i}>
            {seg.split(/(\*\*[^*\n]+\*\*)/g).map((part, j) =>
              part.startsWith('**') && part.endsWith('**') && part.length > 4
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatModule() {
  const [model, setModel]         = useState(() => localStorage.getItem(LS.model)  ?? 'qwen-plus-2025-07-28')
  const [system, setSystem]       = useState(() => localStorage.getItem(LS.system) ?? 'Eres un asistente útil, claro y conciso. Responde en el mismo idioma que el usuario.')
  const [messages, setMessages]   = useState<Msg[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef    = useRef<AbortController | null>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  const saveSettings = () => {
    localStorage.setItem(LS.model,  model)
    localStorage.setItem(LS.system, system)
    setShowSettings(false)
    toast.success('Preferencias guardadas')
  }

  const clearChat = () => { abortRef.current?.abort(); setMessages([]) }

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Msg = { role: 'user', content: text }
    const history: Msg[] = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, ...history],
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message ?? `Error ${res.status}`)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue
          try {
            const delta = JSON.parse(raw).choices?.[0]?.delta?.content ?? ''
            full += delta
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: full }])
          } catch { /* chunk parcial */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      toast.error(err instanceof Error ? err.message : 'Error al contactar con el servidor')
      setMessages(prev => prev.at(-1)?.content === '' ? prev.slice(0, -1) : prev)
    } finally {
      setLoading(false)
    }
  }, [input, loading, model, system, messages])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const activeLabel = MODELS.find(m => m.id === model)?.label ?? model

  return (
    <div className="flex flex-col h-full" style={{ background: '#080d14' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <Bot size={15} className="text-purple-400" />
        <span className="text-xs font-medium text-slate-300">Asistente IA</span>
        <div className="flex items-center gap-1 ml-2 px-2 py-1 rounded-md text-xs text-slate-500"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          {activeLabel}
        </div>
        <div className="flex-1" />
        {messages.length > 0 && (
          <button onClick={clearChat} title="Limpiar conversación"
            className="p-1.5 rounded-md text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
        <button onClick={() => setShowSettings(s => !s)} title="Preferencias"
          className="p-1.5 rounded-md transition-colors"
          style={{ color: showSettings ? '#a78bfa' : '#475569' }}>
          <Settings size={14} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="shrink-0 p-4 flex flex-col gap-3"
          style={{ background: '#0b1120', borderBottom: '1px solid #1a2332' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preferencias</span>
            <button onClick={() => setShowSettings(false)}
              className="text-slate-600 hover:text-slate-400 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-1 w-40">
              <label className="text-[11px] text-slate-600 uppercase tracking-wider">Modelo</label>
              <div className="relative">
                <select value={model} onChange={e => setModel(e.target.value)}
                  className="w-full appearance-none text-xs text-slate-300 rounded-md px-3 py-2 outline-none pr-7"
                  style={{ background: '#111827', border: '1px solid #1e293b' }}>
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] text-slate-600 uppercase tracking-wider">Prompt de sistema</label>
              <input value={system} onChange={e => setSystem(e.target.value)}
                className="text-xs text-slate-300 rounded-md px-3 py-2 outline-none"
                style={{ background: '#111827', border: '1px solid #1e293b' }} />
            </div>
          </div>

          <button onClick={saveSettings}
            className="self-start px-4 py-1.5 text-xs font-medium rounded-md"
            style={{ background: '#6d28d9', color: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#5b21b6')}
            onMouseLeave={e => (e.currentTarget.style.background = '#6d28d9')}>
            Guardar
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)' }}>
              <Bot size={26} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Asistente listo</p>
              <p className="text-xs text-slate-700 mt-1">Powered by Alibaba Qwen · {activeLabel}</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
              style={{ background: msg.role === 'user' ? '#1d4ed8' : '#4c1d95' }}>
              {msg.role === 'user'
                ? <User size={13} className="text-white" />
                : <Bot  size={13} className="text-purple-200" />}
            </div>
            <div className="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={msg.role === 'user'
                ? { background: '#1e3a5f', color: '#e2e8f0', borderTopRightRadius: 4 }
                : { background: '#111827', color: '#cbd5e1', border: '1px solid #1e293b', borderTopLeftRadius: 4 }}>
              {msg.content
                ? <MsgContent text={msg.content} />
                : <span className="inline-flex gap-1 items-center">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid #1a2332', background: '#0d1117' }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: '#111827', border: '1px solid #1e293b' }}>
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown} rows={1} disabled={loading}
            placeholder="Escribe tu mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
            className="flex-1 resize-none bg-transparent text-sm text-slate-200 outline-none placeholder-slate-700 leading-relaxed"
            style={{ maxHeight: 160 }} />
          <button onClick={send} disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: '#6d28d9' }}
            onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.background = '#5b21b6' }}
            onMouseLeave={e => (e.currentTarget.style.background = '#6d28d9')}>
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
