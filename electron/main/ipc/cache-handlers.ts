import type { IpcMain } from 'electron'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

function getCacheDir(type: 'ocr' | 'translation'): string {
  const dir = join(app.getPath('userData'), 'cache', type)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function ocrCacheKey(pdfHash: string, pageNum: number): string {
  return join(getCacheDir('ocr'), `${pdfHash}_p${pageNum}.json`)
}

function translationCacheKey(pdfHash: string, pageNum: number, targetLang: string): string {
  const safeLang = targetLang.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')
  return join(getCacheDir('translation'), `${pdfHash}_p${pageNum}_${safeLang}.json`)
}

export function registerCacheHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('cache:get-ocr', (_event, pdfHash: string, pageNum: number) => {
    const path = ocrCacheKey(pdfHash, pageNum)
    if (!existsSync(path)) return null
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return null
    }
  })

  ipcMain.handle('cache:save-ocr', (_event, pdfHash: string, pageNum: number, data: unknown) => {
    const path = ocrCacheKey(pdfHash, pageNum)
    writeFileSync(path, JSON.stringify(data), 'utf8')
    return { success: true }
  })

  ipcMain.handle(
    'cache:get-translation',
    (_event, pdfHash: string, pageNum: number, targetLang: string) => {
      const path = translationCacheKey(pdfHash, pageNum, targetLang)
      if (!existsSync(path)) return null
      try {
        return JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        return null
      }
    }
  )

  ipcMain.handle(
    'cache:save-translation',
    (_event, pdfHash: string, pageNum: number, targetLang: string, data: unknown) => {
      const path = translationCacheKey(pdfHash, pageNum, targetLang)
      writeFileSync(path, JSON.stringify(data), 'utf8')
      return { success: true }
    }
  )

  ipcMain.handle('cache:clear-ocr', (_event, pdfHash?: string) => {
    const dir = getCacheDir('ocr')
    const { readdirSync, unlinkSync } = require('fs')
    const files = readdirSync(dir) as string[]
    let count = 0
    for (const f of files) {
      if (!pdfHash || f.startsWith(pdfHash)) {
        unlinkSync(join(dir, f))
        count++
      }
    }
    return { deleted: count }
  })

  ipcMain.handle('cache:clear-translation', (_event, pdfHash?: string) => {
    const dir = getCacheDir('translation')
    const { readdirSync, unlinkSync } = require('fs')
    const files = readdirSync(dir) as string[]
    let count = 0
    for (const f of files) {
      if (!pdfHash || f.startsWith(pdfHash)) {
        unlinkSync(join(dir, f))
        count++
      }
    }
    return { deleted: count }
  })
}
