import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Toaster } from 'sonner'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'

const TextModule        = lazy(() => import('./modules/text/TextModule'))
const SpreadsheetModule = lazy(() => import('./modules/spreadsheet/SpreadsheetModule'))
const PdfModule         = lazy(() => import('./modules/pdf/PdfModule'))
const CompressModule    = lazy(() => import('./modules/compress/CompressModule'))
const NewsModule        = lazy(() => import('./modules/news/NewsModule'))
const PrintModule       = lazy(() => import('./modules/print/PrintModule'))
const ChatModule        = lazy(() => import('./modules/chat/ChatModule'))
const ImageModule       = lazy(() => import('./modules/image/ImageModule'))
const VideoModule       = lazy(() => import('./modules/video/VideoModule'))

function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Cargando módulo...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-hidden flex flex-col">
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Navigate to="/text" replace />} />
                <Route path="/text"        element={<TextModule />} />
                <Route path="/spreadsheet" element={<SpreadsheetModule />} />
                <Route path="/pdf"         element={<PdfModule />} />
                <Route path="/compress" element={<CompressModule />} />
                <Route path="/news"     element={<NewsModule />} />
                <Route path="/print"    element={<PrintModule />} />
                <Route path="/chat"    element={<ChatModule />} />
                <Route path="/image"   element={<ImageModule />} />
                <Route path="/video"   element={<VideoModule />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
      <Toaster position="bottom-right" theme="dark" richColors />
    </BrowserRouter>
  )
}
