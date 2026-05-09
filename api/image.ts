export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const apiKey = process.env.QWEN_API_KEY
  if (!apiKey)
    return new Response(JSON.stringify({ error: 'QWEN_API_KEY no configurada en el servidor' }), { status: 500 })

  const { prompt, negativePrompt, model, size } = await req.json() as {
    prompt: string; negativePrompt?: string; model: string; size: string
  }

  // 1 — Generate via DashScope
  const genRes = await fetch(
    'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen-image-2.0',
        input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
        parameters: {
          size: size || '1024*1024',
          n: 1,
          watermark: false,
          ...(negativePrompt?.trim() ? { negative_prompt: negativePrompt.trim() } : {}),
        },
      }),
    }
  )

  if (!genRes.ok) {
    const err = await genRes.json() as { message?: string }
    return new Response(JSON.stringify({ error: err.message ?? `Error ${genRes.status}` }), { status: genRes.status })
  }

  const data = await genRes.json() as {
    output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }> }
  }
  const content = data.output?.choices?.[0]?.message?.content
  const imageUrl = Array.isArray(content) ? content.find(c => c.image)?.image : null

  if (!imageUrl)
    return new Response(JSON.stringify({ error: 'No se recibió imagen del modelo' }), { status: 502 })

  // 2 — Proxy image binary so the browser receives it same-origin (COEP safe)
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok)
    return new Response(JSON.stringify({ error: 'No se pudo descargar la imagen generada' }), { status: 502 })

  const contentType = imgRes.headers.get('Content-Type') ?? 'image/png'
  return new Response(imgRes.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
