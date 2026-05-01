<template>
  <div class="app-layout" :class="{ 'sidebar-open': sidebarOpen }">
    <Toolbar
      :sidebar-open="sidebarOpen"
      @toggle-sidebar="sidebarOpen = !sidebarOpen"
      @open-settings="showSettings = true"
    />
    <div class="app-body">
      <Sidebar v-if="sidebarOpen" @close="sidebarOpen = false" />
      <main class="app-main">
        <DropZone v-if="!pdfStore.isFileOpen" @file-opened="onFileOpened" />
        <PDFViewer v-else />
      </main>
    </div>
    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePdfStore } from './stores/pdf'
import { useSettingsStore } from './stores/settings'
import Toolbar from './components/Toolbar.vue'
import Sidebar from './components/Sidebar.vue'
import PDFViewer from './components/PDFViewer.vue'
import SettingsModal from './components/SettingsModal.vue'
import DropZone from './components/DropZone.vue'

const pdfStore = usePdfStore()
const settingsStore = useSettingsStore()
const sidebarOpen = ref(true)
const showSettings = ref(false)

onMounted(async () => {
  pdfStore.loadProgress()
  await settingsStore.load()
})

function onFileOpened() {
  sidebarOpen.value = true
}
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
