export interface OcrBlock {
  text: string
  confidence: number
  /** Normalized [0,1] relative to page */
  x: number
  y: number
  width: number
  height: number
}

export interface PositionedOcrBlock extends OcrBlock {
  id: number
  /** Column index (0-based) for reading order */
  column?: number
  /** Paragraph group index within the column */
  paragraphGroup?: number
}

export interface TranslatedBlock {
  id: number
  text: string
}

export interface PageOcrData {
  blocks: PositionedOcrBlock[]
  timestamp: number
}

export interface PageTranslationData {
  blocks: TranslatedBlock[]
  targetLang: string
  timestamp: number
}

export interface LlmConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
}

export interface AppSettings {
  llm: LlmConfig
  ocr: {
    enabled: boolean
    renderScale: number
  }
  translation: {
    targetLanguage: string
  }
  reader: {
    defaultZoom: number
    theme: 'light' | 'dark'
  }
}

export type ViewMode = 'normal' | 'ocr' | 'translation'

export interface PdfState {
  filePath: string | null
  fileName: string | null
  pdfHash: string | null
  totalPages: number
  currentPage: number
  zoom: number
  viewMode: ViewMode
  outline: OutlineItem[]
}

export interface OutlineItem {
  title: string
  pageNumber: number
  children?: OutlineItem[]
  level: number
}

export interface ColumnLayout {
  numColumns: number
  columnBoundaries: number[] // x-positions of column dividers (normalized)
}
