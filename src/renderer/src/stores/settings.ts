import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '../types'

const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.3
  },
  ocr: { enabled: false, renderScale: 2 },
  translation: { targetLanguage: '中文' },
  reader: { defaultZoom: 1.0, theme: 'dark' }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const isLoaded = ref(false)

  async function load() {
    try {
      const s = await window.electron.getSettings()
      settings.value = { ...DEFAULT_SETTINGS, ...s }
      isLoaded.value = true
    } catch {
      settings.value = { ...DEFAULT_SETTINGS }
      isLoaded.value = true
    }
  }

  async function save() {
    await window.electron.saveSettings(settings.value)
  }

  return { settings, isLoaded, load, save }
})
