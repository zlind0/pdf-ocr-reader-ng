import type { IpcMain } from 'electron'
import { execFile, execFileSync } from 'child_process'
import { writeFile, writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { createHash } from 'crypto'

const execFileAsync = promisify(execFile)
const writeFileAsync = promisify(writeFile)

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

function getOcrPaths() {
  const cacheDir = join(app.getPath('userData'), 'bin')
  return {
    cacheDir,
    swiftSource: join(cacheDir, 'ocr.swift'),
    binary: join(cacheDir, 'ocr-engine'),
    hashFile: join(cacheDir, 'ocr.hash')
  }
}

/** A short hash of the embedded Swift source, used to detect source changes. */
function currentSourceHash(): string {
  return createHash('md5').update(OCR_SWIFT_SOURCE).digest('hex')
}

/**
 * Synchronous fast-path used inside the IPC handler.
 * By the time an OCR request arrives, warmUpOcrBinary() should already
 * have run, so this is almost always just a single null-check + return.
 */
function ensureOcrBinary(): string {
  // Fast path: resolved this session (ocrBinaryPath is set)
  if (ocrBinaryPath) return ocrBinaryPath

  const { cacheDir, swiftSource, binary, hashFile } = getOcrPaths()
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

  // If binary exists on disk AND source hash matches, reuse it
  if (existsSync(binary)) {
    const stored = existsSync(hashFile) ? readFileSync(hashFile, 'utf8').trim() : ''
    if (stored === currentSourceHash()) {
      ocrBinaryPath = binary
      return binary
    }
  }

  // Fallback: compile synchronously (only if warmUpOcrBinary wasn't awaited)
  writeFileSync(swiftSource, OCR_SWIFT_SOURCE, 'utf8')
  execFileSync('swiftc', [
    '-O', '-o', binary, swiftSource,
    '-framework', 'Vision', '-framework', 'AppKit'
  ], { timeout: 60000 })
  chmodSync(binary, 0o755)
  writeFileSync(hashFile, currentSourceHash(), 'utf8')
  ocrBinaryPath = binary
  return binary
}

/**
 * Called once at app startup.
 * Compiles (or validates) the OCR binary **asynchronously** so the main
 * process is never blocked and the first OCR request is instant.
 */
export async function warmUpOcrBinary(): Promise<void> {
  const { cacheDir, swiftSource, binary, hashFile } = getOcrPaths()
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true })

  const hash = currentSourceHash()

  // Binary exists and source unchanged → just cache the path, nothing to do
  if (existsSync(binary)) {
    const stored = existsSync(hashFile) ? readFileSync(hashFile, 'utf8').trim() : ''
    if (stored === hash) {
      ocrBinaryPath = binary
      return
    }
  }

  // Compile asynchronously — does NOT block the main process
  console.log('[OCR] Compiling OCR binary...')
  writeFileSync(swiftSource, OCR_SWIFT_SOURCE, 'utf8')
  try {
    await execFileAsync('swiftc', [
      '-O', '-o', binary, swiftSource,
      '-framework', 'Vision', '-framework', 'AppKit'
    ], { timeout: 60000 })
    chmodSync(binary, 0o755)
    writeFileSync(hashFile, hash, 'utf8')
    ocrBinaryPath = binary
    console.log('[OCR] Binary ready.')
  } catch (err) {
    console.error('[OCR] Failed to compile binary:', err)
  }
}

export function registerOcrHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ocr:run', async (_event, imageData: Buffer) => {
    try {
      const tmpImg = join(tmpdir(), `ocr_input_${Date.now()}.png`)
      // Async write: does not block the main process event loop
      await writeFileAsync(tmpImg, Buffer.from(imageData))

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
