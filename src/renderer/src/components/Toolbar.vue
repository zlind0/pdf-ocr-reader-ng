<template>
  <div class="toolbar">
    <!-- Left: file controls -->
    <div class="toolbar-left">
      <button class="tb-btn" title="切换侧边栏" @click="emit('toggle-sidebar')">
        <IconMenu />
      </button>
      <button class="tb-btn" title="打开文件" @click="openFile">
        <IconFolder />
      </button>
      <span v-if="pdfStore.fileName" class="file-name" :title="pdfStore.filePath ?? ''">
        {{ pdfStore.fileName }}
      </span>
    </div>
    <div class="drag-fill" />

    <!-- Center: page nav + zoom -->
    <div class="toolbar-center" v-if="pdfStore.isFileOpen">
      <button class="tb-btn" :disabled="pdfStore.currentPage <= 1" @click="pdfStore.goToPage(pdfStore.currentPage - 1)">‹</button>
      <input
        class="page-input"
        type="number"
        :min="1"
        :max="pdfStore.totalPages"
        :value="pdfStore.currentPage"
        @change="onPageInput"
        @keydown.enter.prevent="onPageInput"
      />
      <span class="page-sep">/ {{ pdfStore.totalPages }}</span>
      <button class="tb-btn" :disabled="pdfStore.currentPage >= pdfStore.totalPages" @click="pdfStore.goToPage(pdfStore.currentPage + 1)">›</button>

      <div class="divider" />

      <button class="tb-btn" @click="pdfStore.setZoom(pdfStore.zoom - 0.1)">−</button>
      <div class="zoom-wrap" ref="zoomWrapRef">
        <button class="zoom-label-btn" @click="showZoomMenu = !showZoomMenu">
          {{ Math.round(pdfStore.zoom * 100) }}%
        </button>
        <div v-if="showZoomMenu" class="zoom-menu">
          <button
            v-for="pct in [100, 120, 150, 200, 250]"
            :key="pct"
            class="zoom-menu-item"
            :class="{ active: Math.round(pdfStore.zoom * 100) === pct }"
            @click="selectZoom(pct)"
          >{{ pct }}%</button>
        </div>
      </div>
      <button class="tb-btn" @click="pdfStore.setZoom(pdfStore.zoom + 0.1)">+</button>
      <button class="tb-btn zoom-fit" title="适合页面宽度" @click="pdfStore.requestFitWidth()">适</button>
    </div>
    <div class="drag-fill" />

    <!-- Right: mode toggles + settings -->
    <div class="toolbar-right">
      <template v-if="pdfStore.isFileOpen">
        <div class="mode-group">
          <button
            class="mode-btn"
            :class="{ active: pdfStore.viewMode === 'normal' }"
            @click="pdfStore.setViewMode('normal')"
            title="普通模式"
          >普通</button>
          <button
            class="mode-btn"
            :class="{ active: pdfStore.viewMode === 'ocr', loading: ocrStore.isRunning }"
            @click="toggleOcr"
            title="OCR 文字识别"
          >
            <span v-if="ocrStore.isRunning" class="spinner" />
            OCR
          </button>
          <button
            class="mode-btn"
            :class="{ active: pdfStore.viewMode === 'translation', loading: translationStore.isRunning }"
            @click="toggleTranslation"
            title="翻译模式"
          >
            <span v-if="translationStore.isRunning" class="spinner" />
            译文
          </button>
        </div>
      </template>

      <button class="tb-btn" title="设置" @click="emit('open-settings')">
        <IconSettings />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, ref, onMounted, onUnmounted } from 'vue'
import { usePdfStore } from '../stores/pdf'
import { useOcrStore } from '../stores/ocr'
import { useTranslationStore } from '../stores/translation'

defineProps<{ sidebarOpen: boolean }>()
const emit = defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'open-settings'): void
}>()

const pdfStore = usePdfStore()
const ocrStore = useOcrStore()
const translationStore = useTranslationStore()

async function openFile() {
  const path = await window.electron.openFileDialog()
  if (!path) return
  ocrStore.clearAll()
  translationStore.clearAll()
  const name = path.split('/').pop() ?? path
  const hash = await window.electron.hashFile(path)
  pdfStore.setFile(path, name, hash)
}

function onPageInput(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (!isNaN(val)) pdfStore.goToPage(val)
}

function toggleOcr() {
  if (pdfStore.viewMode === 'ocr') pdfStore.setViewMode('normal')
  else pdfStore.setViewMode('ocr')
}

function toggleTranslation() {
  if (pdfStore.viewMode === 'translation') pdfStore.setViewMode('normal')
  else pdfStore.setViewMode('translation')
}

// Zoom dropdown
const showZoomMenu = ref(false)
const zoomWrapRef = ref<HTMLElement | null>(null)

function selectZoom(pct: number) {
  pdfStore.setZoom(pct / 100)
  showZoomMenu.value = false
}

function onDocMouseDown(e: MouseEvent) {
  if (showZoomMenu.value && zoomWrapRef.value && !zoomWrapRef.value.contains(e.target as Node)) {
    showZoomMenu.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocMouseDown))
onUnmounted(() => document.removeEventListener('mousedown', onDocMouseDown))

// Icon components — defined in setup scope so the template can use them directly
const IconMenu = defineComponent({
  render: () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
    h('line', { x1: 3, y1: 6, x2: 21, y2: 6 }),
    h('line', { x1: 3, y1: 12, x2: 21, y2: 12 }),
    h('line', { x1: 3, y1: 18, x2: 21, y2: 18 })
  ])
})

const IconFolder = defineComponent({
  render: () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
    h('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' })
  ])
})

const IconSettings = defineComponent({
  render: () => h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
    h('circle', { cx: 12, cy: 12, r: 3 }),
    h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })
  ])
})
</script>


<style scoped>
.toolbar {
  height: var(--toolbar-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  -webkit-app-region: drag;
  flex-shrink: 0;
  padding-left: 80px; /* macOS traffic lights */
}

.toolbar-left, .toolbar-center, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.toolbar-center { gap: 2px; }
.toolbar-right { justify-content: flex-end; gap: 8px; }
.drag-fill { flex: 1; }

.tb-btn {
  background: transparent;
  color: var(--color-text-muted);
  padding: 4px 8px;
  border-radius: var(--radius);
  font-size: 16px;
  display: flex;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
.tb-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-2);
}
.tb-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.file-name {
  font-size: 13px;
  color: var(--color-text);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 4px;
}

.page-input {
  width: 52px;
  text-align: center;
  padding: 3px 6px;
  font-size: 13px;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
}
/* Remove spinner arrows */
.page-input::-webkit-inner-spin-button,
.page-input::-webkit-outer-spin-button { -webkit-appearance: none; }

.page-sep {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 0 4px;
}

.zoom-label {
  font-size: 13px;
  width: 44px;
  text-align: center;
  color: var(--color-text);
}

.zoom-wrap {
  position: relative;
}

.zoom-label-btn {
  font-size: 13px;
  width: 52px;
  text-align: center;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 3px 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.zoom-label-btn:hover {
  background: var(--color-surface-2);
}

.zoom-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  z-index: 1000;
  min-width: 72px;
  overflow: hidden;
}

.zoom-menu-item {
  display: block;
  width: 100%;
  padding: 6px 16px;
  font-size: 13px;
  text-align: center;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.12s;
}
.zoom-menu-item:hover {
  background: var(--color-surface-2);
}
.zoom-menu-item.active {
  color: var(--color-accent);
  font-weight: 600;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 4px;
}

.mode-group {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}

.mode-btn {
  background: transparent;
  color: var(--color-text-muted);
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
  border-right: 1px solid var(--color-border);
}
.mode-btn:last-child { border-right: none; }
.mode-btn:hover { background: var(--color-surface-2); color: var(--color-text); }
.mode-btn.active {
  background: var(--color-accent);
  color: white;
}

.spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
