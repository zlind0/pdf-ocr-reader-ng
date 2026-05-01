// Global type augmentations for the Electron API exposed via preload
import type { OcrBlock, TranslatedBlock, LlmConfig, AppSettings } from './types'

declare global {
  interface Window {
    electron: {
      openFileDialog(): Promise<string | null>
      readFile(filePath: string): Promise<Buffer>
      hashFile(filePath: string): Promise<string>
      getUserDataPath(): Promise<string>
      runOcr(imageData: Uint8Array): Promise<{ blocks?: OcrBlock[]; error?: string }>
      translate(
        blocks: { id: number; text: string }[],
        targetLang: string,
        llmConfig: LlmConfig
      ): Promise<{ blocks?: { id: number; text: string }[]; error?: string }>
      getSettings(): Promise<AppSettings>
      saveSettings(settings: AppSettings): Promise<{ success: boolean }>
      getCachedOcr(pdfHash: string, pageNum: number): Promise<OcrBlock[] | null>
      saveCachedOcr(pdfHash: string, pageNum: number, data: OcrBlock[]): Promise<void>
      getCachedTranslation(
        pdfHash: string,
        pageNum: number,
        targetLang: string
      ): Promise<TranslatedBlock[] | null>
      saveCachedTranslation(
        pdfHash: string,
        pageNum: number,
        targetLang: string,
        data: TranslatedBlock[]
      ): Promise<void>
      clearOcrCache(pdfHash?: string): Promise<{ deleted: number }>
      clearTranslationCache(pdfHash?: string): Promise<{ deleted: number }>
    }
  }
}

export {}
