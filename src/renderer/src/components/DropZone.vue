<template>
  <div class="drop-zone" @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="onDrop" :class="{ dragging: isDragging }">
    <div class="drop-content">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
      <h2>PDF OCR 阅读器</h2>
      <p>拖放 PDF 文件到此处，或</p>
      <button class="btn-open" @click="openFile">选择文件</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePdfStore } from '../stores/pdf'
import { useOcrStore } from '../stores/ocr'
import { useTranslationStore } from '../stores/translation'

const emit = defineEmits<{ (e: 'file-opened'): void }>()

const pdfStore = usePdfStore()
const ocrStore = useOcrStore()
const translationStore = useTranslationStore()
const isDragging = ref(false)

async function openFile() {
  const path = await window.electron.openFileDialog()
  if (path) await loadPdf(path)
}

async function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) return
  // In Electron, file.path is available
  const path = (file as File & { path?: string }).path
  if (path) await loadPdf(path)
}

async function loadPdf(path: string) {
  ocrStore.clearAll()
  translationStore.clearAll()
  const name = path.split('/').pop() ?? path
  const hash = await window.electron.hashFile(path)
  pdfStore.setFile(path, name, hash)
  emit('file-opened')
}
</script>

<style scoped>
.drop-zone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  border: 2px dashed var(--color-border);
  margin: 20px;
  border-radius: 12px;
  transition: border-color 0.2s, background 0.2s;
}

.drop-zone.dragging {
  border-color: var(--color-accent);
  background: rgba(233, 69, 96, 0.08);
}

.drop-content {
  text-align: center;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.drop-content svg {
  opacity: 0.4;
}

.drop-content h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text);
}

.drop-content p {
  font-size: 14px;
}

.btn-open {
  background: var(--color-accent);
  color: white;
  padding: 10px 28px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s;
}
.btn-open:hover { background: var(--color-accent-hover); }
</style>
