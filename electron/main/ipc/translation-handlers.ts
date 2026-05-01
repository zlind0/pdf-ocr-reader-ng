import type { IpcMain } from 'electron'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'
import { URL } from 'url'

interface TextBlock {
  id: number
  text: string
}

interface TranslationRequest {
  blocks: TextBlock[]
  targetLang: string
  llmConfig: {
    apiKey: string
    baseUrl: string
    model: string
    temperature?: number
  }
}

function buildPrompt(blocks: TextBlock[], targetLang: string): string {
  const inputJson = JSON.stringify(blocks.map((b) => ({ id: b.id, text: b.text })), null, 2)
  return `You are a professional translator. Translate the following text blocks to ${targetLang}.

Rules:
- Preserve the meaning accurately
- Keep proper nouns, numbers, and punctuation appropriate for the target language
- Return ONLY valid JSON, no markdown, no explanation
- The output must be a JSON array with the same IDs as input

Input JSON:
${inputJson}

Output (JSON array only):
[{"id": <number>, "text": "<translated text>"}, ...]`
}

async function callLLM(
  prompt: string,
  config: TranslationRequest['llmConfig']
): Promise<string> {
  const url = new URL(config.baseUrl.endsWith('/') ? config.baseUrl + 'chat/completions' : config.baseUrl + '/chat/completions')

  const body = JSON.stringify({
    model: config.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: config.temperature ?? 0.3,
    max_tokens: 4096
  })

  const requestFn = url.protocol === 'https:' ? httpsRequest : httpRequest

  return new Promise<string>((resolve, reject) => {
    const req = requestFn(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 120000
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              reject(new Error(parsed.error.message || JSON.stringify(parsed.error)))
            } else {
              resolve(parsed.choices?.[0]?.message?.content || '')
            }
          } catch {
            reject(new Error(`Failed to parse LLM response: ${data.slice(0, 200)}`))
          }
        })
      }
    )

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('LLM request timed out'))
    })

    req.write(body)
    req.end()
  })
}

export function registerTranslationHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('translation:translate', async (_event, req: TranslationRequest) => {
    try {
      if (!req.llmConfig.apiKey) {
        return { error: 'No API key configured. Please set up LLM in Settings.' }
      }

      const prompt = buildPrompt(req.blocks, req.targetLang)
      const responseText = await callLLM(prompt, req.llmConfig)

      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = responseText.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1].trim()

      // Find the JSON array
      const arrayStart = jsonStr.indexOf('[')
      const arrayEnd = jsonStr.lastIndexOf(']')
      if (arrayStart !== -1 && arrayEnd !== -1) {
        jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1)
      }

      const translated = JSON.parse(jsonStr) as TextBlock[]
      return { blocks: translated }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  })
}
