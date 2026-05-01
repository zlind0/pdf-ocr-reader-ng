import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TranslatedBlock } from '../types'

export const useTranslationStore = defineStore('translation', () => {
  const isRunning = ref(false)
  const error = ref<string | null>(null)
  // Map of pageNum -> Map of blockId -> translated text
  const pageTranslations = ref<Map<number, Map<number, string>>>(new Map())

  function setPageTranslations(pageNum: number, blocks: TranslatedBlock[]) {
    const map = new Map<number, string>()
    for (const b of blocks) map.set(b.id, b.text)
    pageTranslations.value.set(pageNum, map)
  }

  function getTranslatedText(pageNum: number, blockId: number): string | undefined {
    return pageTranslations.value.get(pageNum)?.get(blockId)
  }

  function hasPage(pageNum: number): boolean {
    return pageTranslations.value.has(pageNum)
  }

  function clearAll() {
    pageTranslations.value.clear()
  }

  return {
    isRunning, error, pageTranslations,
    setPageTranslations, getTranslatedText, hasPage, clearAll
  }
})
