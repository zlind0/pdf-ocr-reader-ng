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

function blockStyle(block: { x: number; y: number; width: number; height: number }) {
  // The canvas is rendered at devicePixelRatio scale, but CSS size is normalized
  // Blocks are in [0,1] range relative to page dimensions
  const fontSize = Math.max(8, block.height * (props.canvasHeight / window.devicePixelRatio) * 0.75)
  return {
    left: `${block.x * 100}%`,
    top: `${block.y * 100}%`,
    width: `${block.width * 100}%`,
    height: `${block.height * 100}%`,
    fontSize: `${fontSize}px`,
    lineHeight: `${block.height * (props.canvasHeight / window.devicePixelRatio)}px`
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
  font-family: -apple-system, 'Noto Sans CJK SC', 'Source Han Sans', sans-serif;
}
</style>
