<template>
  <div class="outline-node">
    <div
      class="outline-row"
      :style="{ paddingLeft: `${8 + item.level * 12}px` }"
      @click="emit('navigate', item.pageNumber)"
    >
      <span v-if="item.children?.length" class="expand-icon" @click.stop="expanded = !expanded">
        {{ expanded ? '▾' : '▸' }}
      </span>
      <span v-else class="expand-spacer" />
      <span class="outline-title">{{ item.title }}</span>
      <span class="outline-page">{{ item.pageNumber }}</span>
    </div>
    <template v-if="expanded && item.children?.length">
      <OutlineItem
        v-for="(child, i) in item.children"
        :key="i"
        :item="child"
        @navigate="emit('navigate', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { OutlineItem } from '../types'

const props = defineProps<{ item: OutlineItem }>()
const emit = defineEmits<{ (e: 'navigate', page: number): void }>()
const expanded = ref(props.item.level < 2)
</script>

<style scoped>
.outline-node { font-size: 12px; }

.outline-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: 4px;
  transition: background 0.1s, color 0.1s;
  margin: 0 4px;
}
.outline-row:hover {
  background: var(--color-surface-2);
  color: var(--color-text);
}

.expand-icon {
  font-size: 10px;
  width: 12px;
  flex-shrink: 0;
  color: var(--color-text-muted);
}
.expand-spacer { width: 12px; flex-shrink: 0; }

.outline-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-page {
  color: var(--color-text-muted);
  font-size: 11px;
  margin-left: 4px;
  flex-shrink: 0;
}
</style>
