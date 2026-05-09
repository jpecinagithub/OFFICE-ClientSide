import { NavLink } from 'react-router-dom'
import { FileText, FileType2, Archive, Newspaper, Printer, TableProperties, Bot, Sparkles, Clapperboard } from 'lucide-react'
import { cn } from '../lib/utils'

const modules = [
  { path: '/text',        label: 'Editor de Texto',  icon: FileText,        color: 'text-sky-400' },
  { path: '/spreadsheet', label: 'Hoja de Cálculo',  icon: TableProperties, color: 'text-emerald-400' },
  { path: '/pdf',         label: 'Editor PDF',        icon: FileType2,       color: 'text-orange-400' },
  { path: '/compress',    label: 'Compresor ZIP',     icon: Archive,         color: 'text-violet-400' },
  { path: '/news',        label: 'Noticias',          icon: Newspaper,       color: 'text-cyan-400' },
  { path: '/print',       label: 'Impresión',         icon: Printer,         color: 'text-rose-400' },
  { path: '/chat',        label: 'Asistente IA',      icon: Bot,             color: 'text-purple-400' },
  { path: '/image',       label: 'Crear Imágenes',    icon: Sparkles,        color: 'text-amber-400'  },
  { path: '/video',       label: 'Editor de Vídeo',  icon: Clapperboard,    color: 'text-fuchsia-400'},
]

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-[220px] shrink-0" style={{ background: '#0d1117', borderRight: '1px solid #1a2332' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-12 shrink-0" style={{ borderBottom: '1px solid #1a2332' }}>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
            <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
            <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
            <rect x="8" y="8" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
          </svg>
        </div>
        <span className="text-sm font-semibold text-white tracking-tight">Office Web</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1 pt-4">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Módulos</p>
        {modules.map(({ path, label, icon: Icon, color }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-[#1a2540] text-white font-medium'
                  : 'text-slate-500 hover:bg-[#131c2e] hover:text-slate-300'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r-full" />
                )}
                <Icon size={16} className={cn('shrink-0 transition-colors', isActive ? color : 'text-slate-600 group-hover:text-slate-400')} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid #1a2332' }}>
        <span className="text-[11px] text-slate-700">v1.0.0</span>
      </div>
    </aside>
  )
}
