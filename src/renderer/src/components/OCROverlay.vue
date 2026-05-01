<template>
  <div class="ocr-overlay" :class="viewMode">
    <div
      v-for="block in blocks"
      :key="block.id"
      class="text-block"
      :class="{ translated: viewMode === 'translation' && hasTranslation(block.id) }"
      :style="blockStyle(block)"
      :title="block.text"
    >
      <span class="block-text">{{ displayText(block) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOcrStore } from '../stores/ocr'
import { useTranslationStore } from '../stores/translation'
import type { ViewMode } from '../types'

const props = defineProps<{
  pageNum: number
  viewMode: ViewMode
  canvasWidth: number
  canvasHeight: number
}>()

const ocrStore = useOcrStore()
const translationStore = useTranslationStore()

const blocks = computed(() => ocrStore.getPageBlocks(props.pageNum))

/**
 * Compute a stable "body text" font size for the page by taking the median of
 * the lower 75 % of block heights (sorted ascending). This excludes outliers
 * like chapter headings that sit at the tall end, so the result reliably
 * represents the most common body-text size. Computed once per page — O(n log n).
 */
const pageBaseFontPx = computed<number>(() => {
  if (!blocks.value.length) return 16
  const cssPageH = props.canvasHeight / window.devicePixelRatio
  const sorted = blocks.value
    .map(b => b.height * cssPageH)
    .sort((a, b) => a - b)
  // Take the median of the bottom 75 % to exclude large headings
  const upper = Math.ceil(sorted.length * 0.75)
  const slice = sorted.slice(0, upper)
  const median = slice[Math.floor(slice.length / 2)]
  // 0.75: typical cap-height-to-em ratio; clamp to a legible minimum
  return Math.max(8, median * 0.75)
})

function blockStyle(block: { x: number; y: number; width: number; height: number }) {
  const cssPageH = props.canvasHeight / window.devicePixelRatio
  const rawFontPx = block.height * cssPageH * 0.9
  // Snap body text (anything smaller than 1.5× baseline) to the page baseline so
  // all body copy renders at a consistent size. Genuine headings (>= 1.5× baseline)
  // are left at their raw size to preserve the visual hierarchy.
  const fontSize = rawFontPx < pageBaseFontPx.value * 1.5
    ? pageBaseFontPx.value
    : rawFontPx
  return {
    left: `${block.x * 100}%`,
    top: `${block.y * 100}%`,
    width: `${block.width * 100}%`,
    height: `${block.height * 100}%`,
    fontSize: `${Math.max(8, fontSize)}px`,
    lineHeight: `${block.height * cssPageH}px`
  }
}

function hasTranslation(id: number): boolean {
  return translationStore.getTranslatedText(props.pageNum, id) !== undefined
}

function displayText(block: { id: number; text: string }): string {
  if (props.viewMode === 'translation') {
    return translationStore.getTranslatedText(props.pageNum, block.id) ?? block.text
  }
  return block.text
}
</script>

<style scoped>
.ocr-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.text-block {
  position: absolute;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  pointer-events: auto;
  cursor: text;
  user-select: text;
  border-radius: 1px;
  box-sizing: border-box;
  transition: background 0.15s;
}

/* OCR mode: white background with dark text, overlays original */
.ocr .text-block {
  background: var(--color-ocr-bg);
  color: var(--color-ocr-text);
}
.ocr .text-block:hover {
  background: rgba(255, 255, 255, 0.98);
  outline: 1px solid rgba(233, 69, 96, 0.5);
  z-index: 1;
}

/* Translation mode: light green background */
.translation .text-block.translated {
  background: var(--color-trans-bg);
  color: var(--color-trans-text);
}
.translation .text-block:not(.translated) {
  background: var(--color-ocr-bg);
  color: var(--color-ocr-text);
  opacity: 0.7;
}
.translation .text-block:hover {
  opacity: 1;
  outline: 1px solid rgba(0, 150, 0, 0.5);
  z-index: 1;
}

.block-text {
  display: block;
  width: 100%;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.2;
  font-family: Helvetica, -apple-system, 'Noto Sans CJK SC', 'Source Han Sans', sans-serif;
}
</style>
