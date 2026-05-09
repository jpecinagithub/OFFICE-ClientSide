import { mkdirSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src  = resolve(root, 'node_modules/@ffmpeg/core/dist/esm')
const dest = resolve(root, 'public/ffmpeg')

mkdirSync(dest, { recursive: true })
copyFileSync(`${src}/ffmpeg-core.js`,   `${dest}/ffmpeg-core.js`)
copyFileSync(`${src}/ffmpeg-core.wasm`, `${dest}/ffmpeg-core.wasm`)
console.log('✓ FFmpeg core copied to public/ffmpeg/')
