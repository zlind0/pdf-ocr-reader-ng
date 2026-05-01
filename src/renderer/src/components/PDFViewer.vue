<template>
  <div class="pdf-viewer" ref="viewerEl" @wheel.prevent="onWheel" @scroll="onScroll">
    <div class="pages-container" :style="{ paddingBottom: '40px' }">
      <div
        v-for="n in pdfStore.totalPages"
        :key="n"
        class="page-wrapper"
        :data-page="n"
        :ref="(el) => setPageRef(n, el as HTMLElement)"
      >
        <div class="page-inner" :style="pageInnerStyle(n)">
          <!-- PDF Canvas -->
          <canvas
            :ref="(el) => setCanvasRef(n, el as HTMLCanvasElement)"
            class="pdf-canvas"
          />
          <!-- OCR / Translation Overlay -->
          <OCROverlay
            v-if="pdfStore.viewMode !== 'normal' && ocrStore.hasPage(n)"
            :page-num="n"
            :view-mode="pdfStore.viewMode"
            :canvas-width="canvasWidths.get(n) ?? 0"
            :canvas-height="canvasHeights.get(n) ?? 0"
          />
          <!-- Loading indicator for OCR -->
          <div v-if="pdfStore.viewMode !== 'normal' && !ocrStore.hasPage(n) && ocrRunningPages.has(n)" class="page-loading">
            <span class="spinner-large" /> 识别中…
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, reactive } from 'vue'
import { usePdfStore } from '../stores/pdf'
import { useOcrStore } from '../stores/ocr'
import { useTranslationStore } from '../stores/translation'
import { useSettingsStore } from '../stores/settings'
import OCROverlay from './OCROverlay.vue'
import { getPdfDocument } from '../utils/pdf-loader'
import type * as PDFJS from 'pdfjs-dist'
import type { PositionedOcrBlock, OutlineItem, TranslatedBlock } from '../types'

const pdfStore = usePdfStore()
const ocrStore = useOcrStore()
const translationStore = useTranslationStore()
const settingsStore = useSettingsStore()

const viewerEl = ref<HTMLElement | null>(null)
const pageRefs = new Map<number, HTMLElement>()
const canvasRefs = new Map<number, HTMLCanvasElement>()
const canvasWidths = reactive(new Map<number, number>())
const canvasHeights = reactive(new Map<number, number>())
const pageDimensions = reactive(new Map<number, { width: number; height: number }>())
const renderedPages = new Set<number>()
const ocrRunningPages = reactive(new Set<number>())
// In-flight pdfjs RenderTask per page — allows cancellation when zoom changes rapidly
const renderTasks = new Map<number, { cancel: () => void }>()

let pdfDoc: PDFJS.PDFDocumentProxy | null = null
let intersectionObserver: IntersectionObserver | null = null

// --- Scheduler helpers ---
/** Yield control back to the browser so it can paint / handle input. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// OCR scheduler: only 1 page executes OCR at a time (semaphore), with a
// LIFO queue capped at MAX_OCR_QUEUE. LIFO ensures the page the user is
// currently reading is served first; the cap prevents scroll animations from
// filling an unbounded queue with stale pages.
const MAX_OCR_QUEUE = 5
const OCR_CANCELLED = Symbol('ocrCancelled')

interface OcrWaiter {
  pageNum: number
  resolve: () => void
  reject: (reason: unknown) => void
}

let _ocrSemaphoreFree = true
const _ocrWaiters: OcrWaiter[] = []

function acquireOcrSlot(pageNum: number): Promise<void> {
  if (_ocrSemaphoreFree) {
    _ocrSemaphoreFree = false
    return Promise.resolve()
  }
  // Drop the oldest (front) waiter if the queue is at capacity.
  if (_ocrWaiters.length >= MAX_OCR_QUEUE) {
    const dropped = _ocrWaiters.shift()!
    ocrRunningPages.delete(dropped.pageNum)
    dropped.reject(OCR_CANCELLED)
  }
  return new Promise<void>((resolve, reject) => {
    _ocrWaiters.push({ pageNum, resolve, reject })
  })
}

function releaseOcrSlot(): void {
  // LIFO: pop from the back so the most-recently-enqueued page runs next.
  const next = _ocrWaiters.pop()
  if (next) next.resolve()
  else _ocrSemaphoreFree = true
}

function setPageRef(n: number, el: HTMLElement | null) {
  if (el) {
    pageRefs.set(n, el)
    intersectionObserver?.observe(el)
  }
}

function setCanvasRef(n: number, el: HTMLCanvasElement | null) {
  if (el) canvasRefs.set(n, el)
}

function pageInnerStyle(n: number) {
  const dim = pageDimensions.get(n)
  if (!dim) return { width: '600px', minHeight: '800px' }
  return {
    width: `${dim.width * pdfStore.zoom}px`,
    height: `${dim.height * pdfStore.zoom}px`
  }
}

async function loadDocument() {
  if (!pdfStore.filePath) return
  renderedPages.clear()
  pageDimensions.clear()
  canvasWidths.clear()
  canvasHeights.clear()
  intersectionObserver?.disconnect()

  try {
    pdfDoc = await getPdfDocument(pdfStore.filePath)
    pdfStore.setTotalPages(pdfDoc.numPages)

    // Load outline
    const rawOutline = await pdfDoc.getOutline()
    if (rawOutline) {
      const items = await parseOutline(rawOutline, pdfDoc, 0)
      pdfStore.setOutline(items)
    } else {
      pdfStore.setOutline([])
    }

    // Pre-load dimensions for all pages, yielding every 10 pages so the
    // browser stays responsive during initial load of large documents.
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
      const vp = page.getViewport({ scale: 1 })
      pageDimensions.set(n, { width: vp.width, height: vp.height })
      if (n % 10 === 0) await yieldToMain()
    }

    setupIntersectionObserver()
  } catch (err) {
    console.error('Failed to load PDF:', err)
  }
}

async function parseOutline(
  items: PDFJS.OutlineNode[],
  pdf: PDFJS.PDFDocumentProxy,
  level: number
): Promise<OutlineItem[]> {
  const result: OutlineItem[] = []
  for (const item of items) {
    let pageNum = 1
    try {
      if (item.dest) {
        const dest = typeof item.dest === 'string'
          ? await pdf.getDestination(item.dest)
          : item.dest
        if (dest && dest[0]) {
          const idx = await pdf.getPageIndex(dest[0])
          pageNum = idx + 1
        }
      }
    } catch { /* ignore */ }

    result.push({
      title: item.title,
      pageNumber: pageNum,
      level,
      children: item.items?.length ? await parseOutline(item.items as PDFJS.OutlineNode[], pdf, level + 1) : []
    })
  }
  return result
}

function setupIntersectionObserver() {
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const n = parseInt((entry.target as HTMLElement).dataset.page ?? '0')
          if (n > 0) {
            renderPage(n)
            if (pdfStore.viewMode !== 'normal') runOcrForPage(n)
          }
        }
      }
    },
    { root: viewerEl.value, rootMargin: '200px 0px', threshold: 0.01 }
  )

  for (const [n, el] of pageRefs) {
    intersectionObserver.observe(el)
  }
}

async function renderPage(n: number) {
  if (!pdfDoc) return
  const canvas = canvasRefs.get(n)
  if (!canvas) return

  // Cancel any in-flight render for this page to prevent a stale viewport from
  // corrupting the canvas when zoom changes rapidly.
  const existing = renderTasks.get(n)
  if (existing) {
    try { existing.cancel() } catch {}
    renderTasks.delete(n)
  }
  renderedPages.delete(n)

  try {
    const page = await pdfDoc.getPage(n)
    const scale = pdfStore.zoom * window.devicePixelRatio
    const viewport = page.getViewport({ scale })
    canvas.width = viewport.width
    canvas.height = viewport.height
    canvas.style.width = `${viewport.width / window.devicePixelRatio}px`
    canvas.style.height = `${viewport.height / window.devicePixelRatio}px`

    canvasWidths.set(n, viewport.width)
    canvasHeights.set(n, viewport.height)

    const ctx = canvas.getContext('2d')!
    const task = page.render({ canvasContext: ctx, viewport })
    renderTasks.set(n, task)
    await task.promise
    renderTasks.delete(n)
    renderedPages.add(n)
  } catch (err: unknown) {
    renderTasks.delete(n)
    const msg = err instanceof Error ? err.message : String(err)
    // Ignore expected cancellation errors from rapid zoom changes
    if (!msg.includes('cancelled') && !msg.includes('Rendering cancelled')) {
      console.error(`Error rendering page ${n}:`, err)
    }
  }
}

async function runOcrForPage(n: number) {
  if (!pdfDoc || !pdfStore.pdfHash) return
  if (ocrStore.hasPage(n) || ocrRunningPages.has(n)) return

  // Check cache first
  const cached = await window.electron.getCachedOcr(pdfStore.pdfHash, n)
  if (cached) {
    ocrStore.setPageBlocks(n, cached as PositionedOcrBlock[])
    if (pdfStore.viewMode === 'translation') runTranslationForPage(n)
    return
  }

  ocrRunningPages.add(n)
  ocrStore.isRunning = true

  // Acquire semaphore slot. The queue is LIFO and bounded (MAX_OCR_QUEUE);
  // if this page gets dropped because newer pages pushed it out, bail early.
  try {
    await acquireOcrSlot(n)
  } catch (reason) {
    if (reason === OCR_CANCELLED) {
      // Already removed from ocrRunningPages by acquireOcrSlot's drop logic.
      ocrStore.isRunning = ocrRunningPages.size > 0
      return
    }
    throw reason
  }
  try {
    // Render page at high scale for OCR using OffscreenCanvas.
    // OffscreenCanvas.convertToBlob() is async and does NOT block the main
    // thread, unlike HTMLCanvasElement.toDataURL() which is synchronous and
    // can stall the UI for hundreds of milliseconds on large pages.
    const page = await pdfDoc.getPage(n)
    const scale = settingsStore.settings.ocr.renderScale
    const viewport = page.getViewport({ scale })
    const offscreen = new OffscreenCanvas(viewport.width, viewport.height)
    const ctx = offscreen.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise

    // Async PNG encoding — yields to the browser between render and encode
    await yieldToMain()
    const blob = await offscreen.convertToBlob({ type: 'image/png' })
    const arrayBuffer = await blob.arrayBuffer()
    // Send raw binary via IPC (no base64 overhead)
    const result = await window.electron.runOcr(new Uint8Array(arrayBuffer))

    if (result.error) {
      ocrStore.error = result.error
    } else if (result.blocks) {
      const blocks = result.blocks as PositionedOcrBlock[]
      ocrStore.setPageBlocks(n, blocks)
      await window.electron.saveCachedOcr(pdfStore.pdfHash!, n, blocks)
      if (pdfStore.viewMode === 'translation') runTranslationForPage(n)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    ocrStore.error = message
  } finally {
    releaseOcrSlot()
    ocrRunningPages.delete(n)
    ocrStore.isRunning = ocrRunningPages.size > 0
  }
}

async function runTranslationForPage(n: number) {
  if (!pdfStore.pdfHash) return
  if (translationStore.hasPage(n) || translationStore.isRunning) return

  const targetLang = settingsStore.settings.translation.targetLanguage

  // Check cache
  const cached = await window.electron.getCachedTranslation(pdfStore.pdfHash, n, targetLang)
  if (cached) {
    translationStore.setPageTranslations(n, cached as TranslatedBlock[])
    return
  }

  const blocks = ocrStore.getPageBlocks(n)
  if (blocks.length === 0) return

  translationStore.isRunning = true

  try {
    const result = await window.electron.translate(
      blocks.map((b) => ({ id: b.id, text: b.text })),
      targetLang,
      settingsStore.settings.llm
    )

    if (result.error) {
      translationStore.error = result.error
    } else if (result.blocks) {
      translationStore.setPageTranslations(n, result.blocks)
      await window.electron.saveCachedTranslation(pdfStore.pdfHash!, n, targetLang, result.blocks)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    translationStore.error = message
  } finally {
    translationStore.isRunning = false
  }
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Pinch-to-zoom or Ctrl+scroll
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    pdfStore.setZoom(pdfStore.zoom + delta)
    e.preventDefault()
  } else {
    viewerEl.value!.scrollTop += e.deltaY
  }
}

function onScroll() {
  // Suppress scroll-based page tracking while a programmatic scrollIntoView is animating.
  // Without this, onScroll fires during the animation and overwrites the navigation target.
  if (Date.now() < programmaticScrollUntil) return
  if (!viewerEl.value || pdfStore.totalPages === 0) return
  // Find which page is most visible
  const scrollTop = viewerEl.value.scrollTop
  const viewerHeight = viewerEl.value.clientHeight

  let bestPage = pdfStore.currentPage
  let bestOverlap = 0

  for (const [n, el] of pageRefs) {
    const rect = el.getBoundingClientRect()
    const viewerRect = viewerEl.value!.getBoundingClientRect()
    const top = rect.top - viewerRect.top
    const bottom = rect.bottom - viewerRect.top
    const overlap = Math.min(bottom, viewerHeight) - Math.max(top, 0)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestPage = n
    }
  }

  if (bestPage !== pdfStore.currentPage) {
    pdfStore.goToPage(bestPage)
  }
}

// Watch for page navigation (from sidebar/toolbar).
// Only trigger scrollIntoView when the target is not already in the viewport —
// this naturally breaks the onScroll ↔ watcher feedback loop.
let programmaticScrollUntil = 0
watch(() => pdfStore.currentPage, (newPage) => {
  const el = pageRefs.get(newPage)
  if (!el || !viewerEl.value) return
  const rect = el.getBoundingClientRect()
  const viewerRect = viewerEl.value.getBoundingClientRect()
  const alreadyInView = rect.top >= viewerRect.top - 10 && rect.top <= viewerRect.bottom - 60
  if (!alreadyInView) {
    programmaticScrollUntil = Date.now() + 900
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

// Fit page width to 80% of the viewer container when requested from toolbar
watch(() => pdfStore.fitWidthTick, () => {
  const page = pageDimensions.get(pdfStore.currentPage) ?? pageDimensions.get(1)
  if (!page || !viewerEl.value) return
  pdfStore.setZoom((viewerEl.value.clientWidth * 0.8) / page.width)
})

// Watch for zoom changes — cancel all stale in-flight renders first to prevent
// corrupted canvases, then re-render visible pages at the new zoom level.
watch(() => pdfStore.zoom, () => {
  for (const [, task] of renderTasks) { try { task.cancel() } catch {} }
  renderTasks.clear()
  renderedPages.clear()
  for (const [n] of pageRefs) renderPage(n)
})

// Watch for view mode changes
watch(() => pdfStore.viewMode, (mode) => {
  if (mode !== 'normal') {
    // Trigger OCR for visible pages
    for (const [n, el] of pageRefs) {
      const rect = el.getBoundingClientRect()
      const viewerRect = viewerEl.value?.getBoundingClientRect()
      if (viewerRect && rect.top < viewerRect.bottom + 200 && rect.bottom > viewerRect.top - 200) {
        runOcrForPage(n)
      }
    }
  }
})

// Load document when file changes
watch(() => pdfStore.filePath, (path) => {
  if (path) loadDocument()
})

onMounted(() => {
  if (pdfStore.filePath) loadDocument()
})

onUnmounted(() => {
  intersectionObserver?.disconnect()
})
</script>

<style scoped>
.pdf-viewer {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  background: #2a2a3e;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pages-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
  min-width: 100%;
}

.page-wrapper {
  display: flex;
  justify-content: center;
}

.page-inner {
  position: relative;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  border-radius: 2px;
  overflow: hidden;
  background: white;
  transition: width 0.15s, height 0.15s;
}

.pdf-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.page-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.7);
  color: #333;
  font-size: 13px;
  pointer-events: none;
}

.spinner-large {
  width: 18px;
  height: 18px;
  border: 3px solid rgba(0,0,0,0.15);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
