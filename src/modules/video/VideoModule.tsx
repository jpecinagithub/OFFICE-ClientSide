import { useState, useRef, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { Clapperboard, Upload, Download, Scissors, VolumeX, Music, Zap, Play, Pause, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'
import { formatBytes } from '../../lib/utils'

// ─── FFmpeg singleton ─────────────────────────────────────────────────────────
const ff = new FFmpeg()
let ffReady = false

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VideoModule() {
  const [file, setFile]         = useState<File | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent]   = useState(0)
  const [playing, setPlaying]   = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd]     = useState(0)
  const [dragging, setDragging]   = useState(false)
  const [busy, setBusy]           = useState(false)
  const [ffLoading, setFfLoading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [opLabel, setOpLabel]     = useState('')
  const [result, setResult]       = useState<{ url: string; name: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load FFmpeg (lazy) ────────────────────────────────────────────────────
  const loadFF = useCallback(async (): Promise<boolean> => {
    if (ffReady) return true
    setFfLoading(true)
    try {
      ff.on('progress', ({ progress: p }) => setProgress(Math.round(p * 100)))
      const base = window.location.origin
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${base}/ffmpeg/ffmpeg-core.js`,   'text/javascript'),
        toBlobURL(`${base}/ffmpeg/ffmpeg-core.wasm`, 'application/wasm'),
      ])
      await ff.load({ coreURL, wasmURL })
      ffReady = true
      return true
    } catch (err) {
      console.error('[FFmpeg load error]', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`FFmpeg: ${msg.slice(0, 120)}`, { duration: 8000 })
      return false
    } finally {
      setFfLoading(false)
    }
  }, [])

  // ── Open file ─────────────────────────────────────────────────────────────
  const openFile = useCallback((f: File) => {
    if (!f.type.startsWith('video/') && !f.name.match(/\.(mp4|webm|mov|avi|mkv|mpeg|mpg)$/i)) {
      toast.error('Formato no soportado. Usa MP4, WebM, MOV, AVI o MKV')
      return
    }
    if (videoSrc) URL.revokeObjectURL(videoSrc)
    setFile(f)
    setVideoSrc(URL.createObjectURL(f))
    setResult(null)
    setTrimStart(0)
    toast.success(`${f.name} — ${formatBytes(f.size)}`)
  }, [videoSrc])

  // ── Video element events ──────────────────────────────────────────────────
  const onMeta = () => {
    const v = videoRef.current!
    setDuration(v.duration)
    setTrimEnd(v.duration)
  }

  const togglePlay = () => {
    const v = videoRef.current!
    if (playing) { v.pause(); setPlaying(false) }
    else          { v.play();  setPlaying(true)  }
  }

  const markIn  = () => setTrimStart(Math.min(current, trimEnd - 0.5))
  const markOut = () => setTrimEnd(Math.max(current, trimStart + 0.5))

  // ── FFmpeg runner ─────────────────────────────────────────────────────────
  const run = async (args: string[], outName: string, mime: string, label: string) => {
    if (!file) return
    const ok = await loadFF()
    if (!ok) return
    setBusy(true); setProgress(0); setOpLabel(label)
    try {
      await ff.writeFile('input', await fetchFile(file))
      await ff.exec(args)
      const data = await ff.readFile(outName) as Uint8Array
      const blob = new Blob([data.buffer as ArrayBuffer], { type: mime })
      if (result) URL.revokeObjectURL(result.url)
      setResult({ url: URL.createObjectURL(blob), name: outName })
      toast.success(`${label} — listo`)
    } catch (err) {
      console.error(err)
      toast.error(`Error en ${label}`)
    } finally {
      setBusy(false)
      try { await ff.deleteFile('input') }   catch { /* ignore */ }
      try { await ff.deleteFile(outName) }   catch { /* ignore */ }
    }
  }

  const trim        = () => run(['-i','input','-ss',String(trimStart),'-to',String(trimEnd),'-c','copy','out.mp4'],            'out.mp4',  'video/mp4',  'Recortar')
  const mute        = () => run(['-i','input','-an','-c:v','copy','out.mp4'],                                                   'out.mp4',  'video/mp4',  'Silenciar')
  const extractAudio= () => run(['-i','input','-vn','-acodec','libmp3lame','-q:a','2','out.mp3'],                               'out.mp3',  'audio/mpeg', 'Extraer audio')
  const compress    = () => run(['-i','input','-vcodec','libx264','-crf','28','-preset','fast','-acodec','aac','out.mp4'],       'out.mp4',  'video/mp4',  'Comprimir')
  const toGif       = () => {
    const ss = trimStart > 0 ? ['-ss', String(trimStart)] : []
    const to = trimEnd < duration ? ['-to', String(Math.min(trimEnd, trimStart + 15))] : ['-t', '10']
    run(['-i','input',...ss,...to,'-vf','fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse','out.gif'],
        'out.gif', 'image/gif', 'Convertir a GIF')
  }

  const downloadResult = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url; a.download = result.name; a.click()
  }

  // ── Trim range pct helpers ────────────────────────────────────────────────
  const pct = (v: number) => duration ? `${(v / duration) * 100}%` : '0%'

  const OPERATIONS = [
    { icon: Scissors,      label: 'Recortar',      sub: `${fmt(trimStart)} → ${fmt(trimEnd)}`, action: trim         },
    { icon: VolumeX,       label: 'Silenciar',      sub: 'Elimina el audio',                   action: mute         },
    { icon: Music,         label: 'Extraer audio',  sub: 'Guarda como MP3',                    action: extractAudio },
    { icon: Zap,           label: 'Comprimir',      sub: 'Reduce el peso ~50%',                action: compress     },
    { icon: Clapperboard,  label: 'Hacer GIF',      sub: 'Animación GIF (max 15 s)',           action: toGif        },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: '#080d14' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 shrink-0 flex-wrap"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
          style={{ background: '#1d4ed8', color: 'white' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1e40af')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1d4ed8')}>
          <Upload size={13} /> Abrir vídeo
        </button>
        <input ref={inputRef} type="file" accept="video/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) openFile(e.target.files[0]) }} />

        {file && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-400"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <Clapperboard size={11} className="text-fuchsia-400" />
            <span className="max-w-[200px] truncate">{file.name}</span>
            <span className="text-slate-700">· {formatBytes(file.size)}</span>
          </div>
        )}

        <div className="flex-1" />

        {result && (
          <button onClick={downloadResult}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md"
            style={{ background: '#065f46', color: '#6ee7b7' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#047857')}
            onMouseLeave={e => (e.currentTarget.style.background = '#065f46')}>
            <Download size={13} /> Descargar {result.name}
          </button>
        )}
      </div>

      {/* Content */}
      {!file ? (
        /* Drop zone */
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 m-6 rounded-xl cursor-pointer transition-all"
          style={{ border: `2px dashed ${dragging ? '#d946ef' : '#1e293b'}`, background: dragging ? 'rgba(217,70,239,0.05)' : 'transparent' }}
          onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4a044e, #86198f)' }}>
            <Clapperboard size={26} className="text-fuchsia-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-400">Arrastra un vídeo aquí</p>
            <p className="text-xs text-slate-600 mt-1">o haz clic para buscarlo · MP4, WebM, MOV, AVI, MKV</p>
            <p className="text-xs text-slate-700 mt-3">Procesado 100% local · FFmpeg.wasm · sin subida al servidor</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Player */}
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative" style={{ minHeight: 0 }}>
            <video
              ref={videoRef}
              src={videoSrc ?? undefined}
              onLoadedMetadata={onMeta}
              onTimeUpdate={() => setCurrent(videoRef.current?.currentTime ?? 0)}
              onEnded={() => setPlaying(false)}
              onClick={togglePlay}
              className="max-w-full max-h-full cursor-pointer"
            />
            {!playing && (
              <div onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.2)' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                  <Play size={22} className="text-white ml-1" />
                </div>
              </div>
            )}
          </div>

          {/* Controls + Trim */}
          <div className="shrink-0 px-4 pt-3 pb-2 flex flex-col gap-2"
            style={{ background: '#0b1120', borderTop: '1px solid #1a2332' }}>

            {/* Playback row */}
            <div className="flex items-center gap-3">
              <button onClick={togglePlay}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#1a2332' }}>
                {playing ? <Pause size={13} className="text-slate-300" /> : <Play size={13} className="text-slate-300 ml-0.5" />}
              </button>

              {/* Seek bar */}
              <div className="flex-1 relative h-5 flex items-center group">
                {/* Track */}
                <div className="absolute w-full h-1 rounded-full" style={{ background: '#1e293b' }} />
                {/* Trim region */}
                <div className="absolute h-1 rounded-full"
                  style={{ background: '#7c3aed', left: pct(trimStart), width: `calc(${pct(trimEnd)} - ${pct(trimStart)})` }} />
                {/* Playhead */}
                <div className="absolute h-1 rounded-full" style={{ background: '#6366f1', width: pct(current) }} />
                <input type="range" min={0} max={duration || 100} step={0.1} value={current}
                  onChange={e => { const v = Number(e.target.value); setCurrent(v); if (videoRef.current) videoRef.current.currentTime = v }}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer"
                  style={{ height: 16 }} />
              </div>

              <span className="text-xs text-slate-600 tabular-nums shrink-0">{fmt(current)} / {fmt(duration)}</span>
            </div>

            {/* Trim row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-600 uppercase tracking-wider w-10">Trim</span>

              <div className="flex items-center gap-1.5">
                <button onClick={markIn} title="Marcar inicio en la posición actual"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-500 hover:text-fuchsia-400 transition-colors"
                  style={{ background: '#111827', border: '1px solid #1e293b' }}>
                  <BookmarkCheck size={11} /> IN
                </button>
                <span className="text-xs font-mono text-fuchsia-400 w-14 text-center">{fmt(trimStart)}</span>
                <input type="range" min={0} max={duration || 100} step={0.1} value={trimStart}
                  onChange={e => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.5))}
                  className="w-28" />
              </div>

              <div className="w-px h-4 mx-1" style={{ background: '#1e293b' }} />

              <div className="flex items-center gap-1.5">
                <input type="range" min={0} max={duration || 100} step={0.1} value={trimEnd}
                  onChange={e => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.5))}
                  className="w-28" />
                <span className="text-xs font-mono text-fuchsia-400 w-14 text-center">{fmt(trimEnd)}</span>
                <button onClick={markOut} title="Marcar fin en la posición actual"
                  className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-slate-500 hover:text-fuchsia-400 transition-colors"
                  style={{ background: '#111827', border: '1px solid #1e293b' }}>
                  OUT <BookmarkCheck size={11} />
                </button>
              </div>

              <span className="text-[11px] text-slate-700 ml-auto">
                Selección: {fmt(trimEnd - trimStart)}
              </span>
            </div>
          </div>

          {/* Operations */}
          <div className="shrink-0 px-4 py-3 flex items-center gap-2 flex-wrap"
            style={{ background: '#080d14', borderTop: '1px solid #1a2332' }}>

            {busy ? (
              /* Progress */
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1e293b' }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c3aed, #d946ef)' }} />
                </div>
                <span className="text-xs text-slate-500 shrink-0">{opLabel} · {progress}%</span>
                {ffLoading && <span className="text-xs text-slate-700">Cargando FFmpeg…</span>}
              </div>
            ) : (
              OPERATIONS.map(({ icon: Icon, label, sub, action }) => (
                <button key={label} onClick={action} disabled={busy}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all group disabled:opacity-40"
                  style={{ background: '#111827', border: '1px solid #1e293b' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}>
                  <Icon size={13} className="text-fuchsia-500 shrink-0" />
                  <span className="text-slate-300">{label}</span>
                  <span className="text-slate-700">{sub}</span>
                </button>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  )
}
