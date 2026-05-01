import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { OutlineItem, ViewMode } from '../types'

export const usePdfStore = defineStore('pdf', () => {
  const filePath = ref<string | null>(null)
  const fileName = ref<string | null>(null)
  const pdfHash = ref<string | null>(null)
  const totalPages = ref(0)
  const currentPage = ref(1)
  const zoom = ref(1.0)
  const viewMode = ref<ViewMode>('normal')
  const outline = ref<OutlineItem[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  // Reading progress persisted per file
  const progressMap = ref<Record<string, number>>({})
  // Incremented each time the user requests a fit-to-width zoom
  const fitWidthTick = ref(0)

  const isFileOpen = computed(() => filePath.value !== null)
  const progress = computed(() => {
    if (totalPages.value === 0) return 0
    return Math.round((currentPage.value / totalPages.value) * 100)
  })

  function setFile(path: string, name: string, hash: string) {
    filePath.value = path
    fileName.value = name
    pdfHash.value = hash
    loadError.value = null
    // Restore progress
    const saved = progressMap.value[hash]
    if (saved) currentPage.value = saved
    else currentPage.value = 1
  }

  function setTotalPages(n: number) {
    totalPages.value = n
  }

  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(page, totalPages.value))
    currentPage.value = clamped
    if (pdfHash.value) {
      progressMap.value[pdfHash.value] = clamped
      // Persist to localStorage
      localStorage.setItem('pdfProgress', JSON.stringify(progressMap.value))
    }
  }

  function setZoom(z: number) {
    zoom.value = Math.max(0.25, Math.min(5.0, z))
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  function setOutline(items: OutlineItem[]) {
    outline.value = items
  }

  function requestFitWidth() {
    fitWidthTick.value++
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem('pdfProgress')
      if (raw) progressMap.value = JSON.parse(raw)
    } catch { /* ignore */ }
  }

  return {
    filePath, fileName, pdfHash, totalPages, currentPage, zoom,
    viewMode, outline, isLoading, loadError, isFileOpen, progress, fitWidthTick,
    setFile, setTotalPages, goToPage, setZoom, setViewMode, setOutline, loadProgress, requestFitWidth
  }
})
