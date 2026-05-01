import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // File operations
  openFileDialog: (): Promise<string | null> => ipcRenderer.invoke('file:open-dialog'),
  readFile: (filePath: string): Promise<Buffer> => ipcRenderer.invoke('file:read', filePath),
  hashFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:hash', filePath),
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('file:get-user-data-path'),

  // OCR
  runOcr: (imageData: Uint8Array): Promise<{ blocks?: OcrBlock[]; error?: string }> =>
    ipcRenderer.invoke('ocr:run', imageData),

  // Translation
  translate: (
    blocks: { id: number; text: string }[],
    targetLang: string,
    llmConfig: LlmConfig
  ): Promise<{ blocks?: { id: number; text: string }[]; error?: string }> =>
    ipcRenderer.invoke('translation:translate', { blocks, targetLang, llmConfig }),

  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('settings:save', settings),

  // Cache
  getCachedOcr: (pdfHash: string, pageNum: number): Promise<OcrBlock[] | null> =>
    ipcRenderer.invoke('cache:get-ocr', pdfHash, pageNum),
  saveCachedOcr: (pdfHash: string, pageNum: number, data: OcrBlock[]): Promise<void> =>
    ipcRenderer.invoke('cache:save-ocr', pdfHash, pageNum, data),
  getCachedTranslation: (
    pdfHash: string,
    pageNum: number,
    targetLang: string
  ): Promise<TranslatedBlock[] | null> =>
    ipcRenderer.invoke('cache:get-translation', pdfHash, pageNum, targetLang),
  saveCachedTranslation: (
    pdfHash: string,
    pageNum: number,
    targetLang: string,
    data: TranslatedBlock[]
  ): Promise<void> =>
    ipcRenderer.invoke('cache:save-translation', pdfHash, pageNum, targetLang, data),
  clearOcrCache: (pdfHash?: string): Promise<{ deleted: number }> =>
    ipcRenderer.invoke('cache:clear-ocr', pdfHash),
  clearTranslationCache: (pdfHash?: string): Promise<{ deleted: number }> =>
    ipcRenderer.invoke('cache:clear-translation', pdfHash)
}

contextBridge.exposeInMainWorld('electron', api)

// Type declarations for the renderer
interface OcrBlock {
  text: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

interface TranslatedBlock {
  id: number
  text: string
}

interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

interface AppSettings {
  llm: LlmConfig
  ocr: { enabled: boolean; renderScale: number }
  translation: { targetLanguage: string }
  reader: { defaultZoom: number; theme: 'light' | 'dark' }
}

export type { OcrBlock, TranslatedBlock, LlmConfig, AppSettings }
