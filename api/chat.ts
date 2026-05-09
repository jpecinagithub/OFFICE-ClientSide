export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const apiKey = process.env.QWEN_API_KEY
  if (!apiKey) return new Response(JSON.stringify({ error: { message: 'QWEN_API_KEY no configurada en el servidor' } }), { status: 500 })

  const { messages, model } = await req.json() as { messages: unknown[]; model: string }

  const upstream = await fetch(
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: model || 'qwen-plus-2025-07-28', messages, stream: true }),
    }
  )

  if (!upstream.ok) {
    const err = await upstream.text()
    return new Response(err, { status: upstream.status, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}
