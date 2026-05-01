<template>
  <div class="sidebar">
    <div class="sidebar-tabs">
      <button :class="{ active: tab === 'outline' }" @click="tab = 'outline'">目录</button>
      <button :class="{ active: tab === 'thumbnails' }" @click="tab = 'thumbnails'">缩略图</button>
    </div>

    <div class="sidebar-content">
      <!-- Outline / TOC -->
      <div v-if="tab === 'outline'" class="outline-panel">
        <div v-if="pdfStore.outline.length === 0" class="empty-hint">
          此文件无目录
        </div>
        <OutlineItem
          v-for="(item, i) in pdfStore.outline"
          :key="i"
          :item="item"
          @navigate="pdfStore.goToPage($event)"
        />
      </div>

      <!-- Thumbnails -->
      <div v-if="tab === 'thumbnails'" class="thumbnails-panel" ref="thumbnailsContainer">
        <div
          v-for="n in pdfStore.totalPages"
          :key="n"
          class="thumbnail-item"
          :class="{ active: n === pdfStore.currentPage }"
          @click="pdfStore.goToPage(n)"
        >
          <div class="thumbnail-canvas-wrapper">
            <canvas :ref="(el) => setThumbnailRef(n, el as HTMLCanvasElement)" />
          </div>
          <span class="thumbnail-label">{{ n }}</span>
        </div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="sidebar-footer">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: pdfStore.progress + '%' }" />
      </div>
      <span class="progress-text">{{ pdfStore.progress }}% · 第 {{ pdfStore.currentPage }} / {{ pdfStore.totalPages }} 页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { usePdfStore } from '../stores/pdf'
import OutlineItem from './OutlineItem.vue'
import { getPdfDocument } from '../utils/pdf-loader'

const pdfStore = usePdfStore()
const tab = ref<'outline' | 'thumbnails'>('outline')
const thumbnailRefs = new Map<number, HTMLCanvasElement>()
const renderedThumbnails = new Set<number>()

function setThumbnailRef(n: number, el: HTMLCanvasElement | null) {
  if (el) {
    thumbnailRefs.set(n, el)
    renderThumbnail(n)
  }
}

async function renderThumbnail(n: number) {
  if (renderedThumbnails.has(n)) return
  const canvas = thumbnailRefs.get(n)
  if (!canvas || !pdfStore.filePath) return

  try {
    const pdf = await getPdfDocument(pdfStore.filePath)
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 0.2 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    renderedThumbnails.add(n)
  } catch { /* ignore */ }
}

watch(tab, (t) => {
  if (t === 'thumbnails') {
    // Render visible thumbnails
    for (const [n, canvas] of thumbnailRefs) {
      if (canvas && !renderedThumbnails.has(n)) renderThumbnail(n)
    }
  }
})

watch(() => pdfStore.filePath, () => {
  renderedThumbnails.clear()
})
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sidebar-tabs button {
  flex: 1;
  background: transparent;
  color: var(--color-text-muted);
  padding: 10px 0;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
}
.sidebar-tabs button.active {
  color: var(--color-text);
  border-bottom-color: var(--color-accent);
}
.sidebar-tabs button:hover { color: var(--color-text); }

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.empty-hint {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
  padding: 32px 16px;
}

.outline-panel {
  padding: 8px 0;
}

.thumbnails-panel {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.thumbnail-item {
  cursor: pointer;
  border-radius: var(--radius);
  border: 2px solid transparent;
  padding: 4px;
  transition: border-color 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.thumbnail-item:hover { border-color: var(--color-border); }
.thumbnail-item.active { border-color: var(--color-accent); }

.thumbnail-canvas-wrapper {
  width: 100%;
  background: #fff;
  border-radius: 2px;
  overflow: hidden;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumbnail-canvas-wrapper canvas {
  width: 100%;
  height: auto;
  display: block;
}

.thumbnail-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.sidebar-footer {
  border-top: 1px solid var(--color-border);
  padding: 8px 12px;
  flex-shrink: 0;
}

.progress-bar {
  height: 3px;
  background: var(--color-border);
  border-radius: 2px;
  margin-bottom: 6px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s;
}
.progress-text {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
