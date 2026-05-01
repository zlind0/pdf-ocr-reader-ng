import type { IpcMain } from 'electron'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface AppSettings {
  llm: {
    apiKey: string
    baseUrl: string
    model: string
    temperature: number
  }
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

const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.3
  },
  ocr: {
    enabled: false,
    renderScale: 2
  },
  translation: {
    targetLanguage: '中文'
  },
  reader: {
    defaultZoom: 1.0,
    theme: 'dark'
  }
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  const settingsPath = getSettingsPath()
  if (!existsSync(settingsPath)) return { ...DEFAULT_SETTINGS }
  try {
    const raw = readFileSync(settingsPath, 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: AppSettings): void {
  const settingsPath = getSettingsPath()
  const dir = join(settingsPath, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', () => loadSettings())

  ipcMain.handle('settings:save', (_event, settings: AppSettings) => {
    saveSettings(settings)
    return { success: true }
  })
}
