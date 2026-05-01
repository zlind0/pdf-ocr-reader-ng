<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>设置</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="settings-nav">
          <button v-for="s in sections" :key="s.id" :class="{ active: activeSection === s.id }" @click="activeSection = s.id">
            {{ s.label }}
          </button>
        </div>

        <div class="settings-content">
          <!-- LLM Settings -->
          <div v-if="activeSection === 'llm'" class="section">
            <h3>LLM 翻译配置</h3>
            <div class="field">
              <label>API Key</label>
              <input type="password" v-model="s.llm.apiKey" placeholder="sk-..." />
            </div>
            <div class="field">
              <label>Base URL</label>
              <input type="text" v-model="s.llm.baseUrl" placeholder="https://api.openai.com/v1" />
            </div>
            <div class="field">
              <label>模型</label>
              <input type="text" v-model="s.llm.model" placeholder="gpt-4o-mini" />
              <div class="hint">兼容 OpenAI API 格式的所有服务</div>
            </div>
            <div class="field">
              <label>温度 ({{ s.llm.temperature }})</label>
              <input type="range" v-model.number="s.llm.temperature" min="0" max="1" step="0.05" />
            </div>
          </div>

          <!-- OCR Settings -->
          <div v-if="activeSection === 'ocr'" class="section">
            <h3>OCR 设置</h3>
            <div class="field">
              <label>识别精度（渲染倍率）</label>
              <select v-model.number="s.ocr.renderScale">
                <option :value="1">1x（快速）</option>
                <option :value="2">2x（推荐）</option>
                <option :value="3">3x（高精度）</option>
              </select>
              <div class="hint">更高倍率识别更准，但速度较慢</div>
            </div>
            <div class="field-row">
              <button class="btn-danger" @click="clearOcrCache">清除 OCR 缓存</button>
              <span v-if="cacheMsg" class="cache-msg">{{ cacheMsg }}</span>
            </div>
          </div>

          <!-- Translation Settings -->
          <div v-if="activeSection === 'translation'" class="section">
            <h3>翻译设置</h3>
            <div class="field">
              <label>目标语言</label>
              <select v-model="s.translation.targetLanguage">
                <option>中文</option>
                <option>英文</option>
                <option>日本語</option>
                <option>한국어</option>
                <option>Deutsch</option>
                <option>Français</option>
                <option>Español</option>
                <option>Русский</option>
              </select>
            </div>
            <div class="field-row">
              <button class="btn-danger" @click="clearTranslationCache">清除翻译缓存</button>
              <span v-if="cacheMsg" class="cache-msg">{{ cacheMsg }}</span>
            </div>
          </div>

          <!-- Reader Settings -->
          <div v-if="activeSection === 'reader'" class="section">
            <h3>阅读器设置</h3>
            <div class="field">
              <label>默认缩放</label>
              <select v-model.number="s.reader.defaultZoom">
                <option :value="0.5">50%</option>
                <option :value="0.75">75%</option>
                <option :value="1.0">100%</option>
                <option :value="1.25">125%</option>
                <option :value="1.5">150%</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="emit('close')">取消</button>
        <button class="btn-primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { usePdfStore } from '../stores/pdf'
import type { AppSettings } from '../types'

const emit = defineEmits<{ (e: 'close'): void }>()

const settingsStore = useSettingsStore()
const pdfStore = usePdfStore()

const sections = [
  { id: 'llm', label: 'LLM' },
  { id: 'ocr', label: 'OCR' },
  { id: 'translation', label: '翻译' },
  { id: 'reader', label: '阅读器' }
]
const activeSection = ref('llm')
const cacheMsg = ref('')

// Deep copy for local editing
const s = reactive<AppSettings>(JSON.parse(JSON.stringify(settingsStore.settings)))

async function save() {
  Object.assign(settingsStore.settings, s)
  await settingsStore.save()
  emit('close')
}

async function clearOcrCache() {
  const result = await window.electron.clearOcrCache(pdfStore.pdfHash ?? undefined)
  cacheMsg.value = `已清除 ${result.deleted} 条 OCR 缓存`
  setTimeout(() => { cacheMsg.value = '' }, 3000)
}

async function clearTranslationCache() {
  const result = await window.electron.clearTranslationCache(pdfStore.pdfHash ?? undefined)
  cacheMsg.value = `已清除 ${result.deleted} 条翻译缓存`
  setTimeout(() => { cacheMsg.value = '' }, 3000)
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.modal-header h2 { font-size: 16px; font-weight: 600; }

.close-btn {
  background: transparent;
  color: var(--color-text-muted);
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
}
.close-btn:hover { color: var(--color-text); background: var(--color-border); }

.modal-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.settings-nav {
  width: 110px;
  border-right: 1px solid var(--color-border);
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}
.settings-nav button {
  background: transparent;
  color: var(--color-text-muted);
  text-align: left;
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 4px;
  margin: 0 6px;
  transition: all 0.1s;
}
.settings-nav button:hover { color: var(--color-text); background: var(--color-surface-2); }
.settings-nav button.active { color: var(--color-text); background: var(--color-surface-2); font-weight: 500; }

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
}

.field {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field label {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}
.field input, .field select {
  width: 100%;
  font-size: 13px;
}
.field input[type="range"] {
  border: none;
  background: transparent;
  padding: 4px 0;
}

.hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.cache-msg {
  font-size: 12px;
  color: #4caf50;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
  padding: 8px 20px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
}
.btn-primary:hover { background: var(--color-accent-hover); }

.btn-secondary {
  background: transparent;
  color: var(--color-text-muted);
  padding: 8px 20px;
  border-radius: var(--radius);
  font-size: 13px;
  border: 1px solid var(--color-border);
}
.btn-secondary:hover { color: var(--color-text); background: var(--color-surface-2); }

.btn-danger {
  background: transparent;
  color: #e57373;
  padding: 6px 14px;
  border-radius: var(--radius);
  font-size: 12px;
  border: 1px solid #e57373;
}
.btn-danger:hover { background: rgba(229, 115, 115, 0.1); }
</style>
