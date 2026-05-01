import type { IpcMain } from 'electron'
import { execFile, execFileSync } from 'child_process'
import { writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { promisify } from 'util'
import { tmpdir } from 'os'

const execFileAsync = promisify(execFile)

const OCR_SWIFT_SOURCE = `
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
guard args.count > 1 else {
    print("{\\"error\\": \\"No image path provided\\"}")
    exit(1)
}

let imagePath = args[1]
guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("{\\"error\\": \\"Could not load image from \\(imagePath)\\"}")
    exit(1)
}

struct TextBlock: Codable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "ja", "ko", "en-US", "de", "fr", "es", "ru"]

try? requestHandler.perform([request])

var blocks: [TextBlock] = []
if let observations = request.results {
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let bbox = observation.boundingBox
        // Vision: origin bottom-left. Convert to top-left origin.
        blocks.append(TextBlock(
            text: candidate.string,
            confidence: candidate.confidence,
            x: bbox.origin.x,
            y: 1.0 - bbox.origin.y - bbox.size.height,
            width: bbox.size.width,
            height: bbox.size.height
        ))
    }
}

let encoder = JSONEncoder()
let data = try! encoder.encode(["blocks": blocks])
print(String(data: data, encoding: .utf8)!)
`

let ocrBinaryPath: string | null = null

function ensureOcrBinary(): string {
  if (ocrBinaryPath && existsSync(ocrBinaryPath)) return ocrBinaryPath

  const cacheDir = join(app.getPath('userData'), 'bin')
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

  const swiftSource = join(cacheDir, 'ocr.swift')
  const binary = join(cacheDir, 'ocr-engine')

  // Write source if not exists or outdated
  writeFileSync(swiftSource, OCR_SWIFT_SOURCE, 'utf8')

  // Compile
  execFileSync('swiftc', [
    '-O',
    '-o', binary,
    swiftSource,
    '-framework', 'Vision',
    '-framework', 'AppKit'
  ], { timeout: 60000 })

  chmodSync(binary, 0o755)
  return binary
}

export function registerOcrHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ocr:run', async (_event, imageDataUrl: string) => {
    try {
      // Save image data to a temp file
      const tmpDir = tmpdir()
      const tmpImg = join(tmpDir, `ocr_input_${Date.now()}.png`)

      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
      writeFileSync(tmpImg, Buffer.from(base64Data, 'base64'))

      const binary = ensureOcrBinary()
      const { stdout } = await execFileAsync(binary, [tmpImg], { timeout: 30000 })

      try {
        const result = JSON.parse(stdout.trim())
        return result
      } catch {
        return { error: 'Failed to parse OCR output', raw: stdout }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  })
}
