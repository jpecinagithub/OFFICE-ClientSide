import { useLocation } from 'react-router-dom'
import { FileText, FileType2, Archive, Newspaper, Printer, TableProperties, Bot, Sparkles, Clapperboard } from 'lucide-react'

const meta: Record<string, { title: string; icon: React.ElementType; color: string }> = {
  '/text':        { title: 'Editor de Texto',    icon: FileText,        color: 'text-sky-400' },
  '/spreadsheet': { title: 'Hoja de Cálculo',    icon: TableProperties, color: 'text-emerald-400' },
  '/pdf':         { title: 'Editor PDF',          icon: FileType2,       color: 'text-orange-400' },
  '/compress':    { title: 'Compresor ZIP',       icon: Archive,         color: 'text-violet-400' },
  '/news':        { title: 'Noticias del Día',    icon: Newspaper,       color: 'text-cyan-400' },
  '/print':       { title: 'Centro de Impresión', icon: Printer,         color: 'text-rose-400' },
  '/chat':        { title: 'Asistente IA',        icon: Bot,             color: 'text-purple-400' },
  '/image':       { title: 'Crear Imágenes',      icon: Sparkles,        color: 'text-amber-400'  },
  '/video':       { title: 'Editor de Vídeo',    icon: Clapperboard,    color: 'text-fuchsia-400'},
}

export default function Topbar() {
  const { pathname } = useLocation()
  const m = meta[pathname]
  const Icon = m?.icon

  return (
    <header
      className="flex items-center justify-between h-12 px-5 shrink-0 no-print"
      style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon size={15} className={m.color} />}
        <h1 className="text-sm font-medium text-slate-300">{m?.title ?? 'Office Web'}</h1>
      </div>
      <span className="text-xs text-slate-700">
        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
    </header>
  )
}
