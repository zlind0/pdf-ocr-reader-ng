import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Configure the worker
// In Electron renderer, we use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const docCache = new Map<string, PDFDocumentProxy>()

export async function getPdfDocument(filePath: string): Promise<PDFDocumentProxy> {
  if (docCache.has(filePath)) return docCache.get(filePath)!

  const data = await window.electron.readFile(filePath)
  // data is a Buffer-like object; pdfjs needs Uint8Array
  const uint8 = new Uint8Array(data)

  const loadingTask = pdfjsLib.getDocument({ data: uint8 })
  const doc = await loadingTask.promise
  docCache.set(filePath, doc)
  return doc
}

export function clearDocCache() {
  docCache.clear()
}
