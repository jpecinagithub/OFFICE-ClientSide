import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, Newspaper } from 'lucide-react'
import { formatDate } from '../../lib/utils'

interface Article {
  title: string
  description: string
  link: string
  pubDate: string
  thumbnail?: string
  source: string
}

interface Category {
  id: string
  label: string
  feeds: string[]
}

const PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
]

const CATEGORIES: Category[] = [
  {
    id: 'internacional', label: 'Internacional',
    feeds: [
      'https://feeds.bbci.co.uk/mundo/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    ],
  },
  {
    id: 'espana', label: 'España',
    feeds: [
      'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml',
      'https://www.20minutos.es/rss/espana/',
    ],
  },
  {
    id: 'politica', label: 'Política',
    feeds: [
      'https://www.20minutos.es/rss/politica/',
      'https://e00-elmundo.uecdn.es/elmundo/rss/opinion.xml',
    ],
  },
  {
    id: 'deportes', label: 'Deportes',
    feeds: [
      'https://e00-marca.uecdn.es/rss/portada.xml',
      'https://www.20minutos.es/rss/deportes/',
    ],
  },
  {
    id: 'cultura', label: 'Cultura',
    feeds: [
      'https://www.20minutos.es/rss/cultura/',
      'https://feeds.bbci.co.uk/mundo/rss/cultura_y_entretenimiento.xml',
    ],
  },
]

// Map hostname → friendly name
const SOURCE_NAMES: Record<string, string> = {
  'bbci': 'BBC Mundo',
  'nytimes': 'NY Times',
  'elmundo': 'El Mundo',
  '20minutos': '20 Minutos',
  'marca': 'Marca',
}

function friendlySource(hostname: string): string {
  const key = Object.keys(SOURCE_NAMES).find(k => hostname.includes(k))
  return key ? SOURCE_NAMES[key] : hostname
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRSS(xml: string, sourceUrl: string): Article[] {
  const hostname = new URL(sourceUrl).hostname
  const source = friendlySource(hostname)
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  return Array.from(doc.querySelectorAll('item')).slice(0, 12).map(item => {
    const get = (tag: string) => cleanText(item.querySelector(tag)?.textContent ?? '')
    const thumb =
      item.querySelector('media\\:thumbnail, thumbnail')?.getAttribute('url') ??
      item.querySelector('enclosure[type^="image"]')?.getAttribute('url') ??
      item.querySelector('media\\:content')?.getAttribute('url') ??
      ''
    const desc = get('description').slice(0, 180)
    return {
      title: get('title'),
      description: desc,
      link: get('link') || (item.querySelector('link')?.textContent ?? ''),
      pubDate: get('pubDate'),
      thumbnail: thumb || undefined,
      source,
    }
  })
}

async function fetchFeed(url: string): Promise<Article[]> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const text = await res.text()
      if (text.length < 100) continue
      return parseRSS(text, url)
    } catch {
      // try next proxy
    }
  }
  return []
}

export default function NewsModule() {
  const [active, setActive] = useState(CATEGORIES[0])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNews = useCallback(async (cat: Category) => {
    setLoading(true)
    setError('')
    setArticles([])
    try {
      const results = await Promise.all(cat.feeds.map(fetchFeed))
      const all = results.flat()
      if (!all.length) throw new Error('Sin resultados')
      all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      setArticles(all)
    } catch {
      setError('No se pudieron cargar las noticias.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNews(active) }, [active, fetchNews])

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-4 py-2 no-print"
        style={{ background: '#0d1117', borderBottom: '1px solid #1a2332' }}
      >
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActive(cat)}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md transition-all"
            style={active.id === cat.id
              ? { background: '#1d4ed8', color: 'white' }
              : { color: '#64748b' }
            }
            onMouseEnter={e => { if (active.id !== cat.id) e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { if (active.id !== cat.id) e.currentTarget.style.color = '#64748b' }}
          >
            {cat.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => fetchNews(active)} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl h-44 animate-pulse" style={{ background: '#111827', border: '1px solid #1e293b' }} />
            ))}
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <Newspaper size={36} className="text-slate-800" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {articles.map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                className="group flex flex-col rounded-xl overflow-hidden transition-all duration-200"
                style={{ background: '#0f172a', border: '1px solid #1e293b' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#2d4a7a')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
              >
                {a.thumbnail && (
                  <div className="w-full h-36 overflow-hidden shrink-0" style={{ background: '#1a2332' }}>
                    <img src={a.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={e => { e.currentTarget.parentElement!.style.display = 'none' }} />
                  </div>
                )}
                <div className="flex flex-col gap-2 p-4 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium leading-snug text-slate-200 line-clamp-3 group-hover:text-blue-300 transition-colors">
                      {a.title}
                    </h3>
                    <ExternalLink size={11} className="text-slate-700 shrink-0 mt-0.5 group-hover:text-slate-500 transition-colors" />
                  </div>
                  {a.description && a.description.length > 5 && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{a.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <span className="text-[11px] font-medium" style={{ color: '#3b82f6' }}>{a.source}</span>
                    <span className="text-[11px] text-slate-700">{formatDate(a.pubDate)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
