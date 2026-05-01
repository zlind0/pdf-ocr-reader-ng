import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PositionedOcrBlock, ColumnLayout } from '../types'

/**
 * Detects if a page has multi-column layout and assigns column/paragraph group info.
 */
function analyzeLayout(blocks: PositionedOcrBlock[]): {
  blocks: PositionedOcrBlock[]
  layout: ColumnLayout
} {
  if (blocks.length === 0) return { blocks, layout: { numColumns: 1, columnBoundaries: [] } }

  // Estimate typical block width
  const widths = blocks.map((b) => b.width).sort((a, b) => a - b)
  const medianWidth = widths[Math.floor(widths.length / 2)]

  let numColumns = 1
  let columnBoundaries: number[] = []

  if (medianWidth < 0.45) {
    // Likely multi-column. Try to find the gap around x=0.5
    const midBlocks = blocks.filter((b) => b.x + b.width > 0.4 && b.x < 0.6)
    if (midBlocks.length < blocks.length * 0.15) {
      numColumns = 2
      columnBoundaries = [0.5]
    }
  }

  const result = blocks.map((b, i) => {
    let column = 0
    if (numColumns === 2) {
      column = b.x + b.width / 2 < 0.5 ? 0 : 1
    }
    return { ...b, id: i, column }
  })

  // Sort within columns by y for paragraph grouping
  const grouped = assignParagraphGroups(result, numColumns)

  return { blocks: grouped, layout: { numColumns, columnBoundaries } }
}

function assignParagraphGroups(blocks: PositionedOcrBlock[], numColumns: number): PositionedOcrBlock[] {
  const result = [...blocks]

  for (let col = 0; col < numColumns; col++) {
    const colBlocks = result.filter((b) => b.column === col).sort((a, b) => a.y - b.y)
    let groupIdx = 0
    for (let i = 0; i < colBlocks.length; i++) {
      if (i === 0) {
        colBlocks[i].paragraphGroup = groupIdx
        continue
      }
      const prev = colBlocks[i - 1]
      const gap = colBlocks[i].y - (prev.y + prev.height)
      // If gap is more than 50% of average line height, start new group
      const avgHeight = (prev.height + colBlocks[i].height) / 2
      if (gap > avgHeight * 0.6) groupIdx++
      colBlocks[i].paragraphGroup = groupIdx
    }
  }

  return result
}

export const useOcrStore = defineStore('ocr', () => {
  const isRunning = ref(false)
  const error = ref<string | null>(null)
  // Map of pageNum -> blocks
  const pageBlocks = ref<Map<number, PositionedOcrBlock[]>>(new Map())
  const pageLayouts = ref<Map<number, ColumnLayout>>(new Map())

  function setPageBlocks(pageNum: number, rawBlocks: PositionedOcrBlock[]) {
    const { blocks, layout } = analyzeLayout(rawBlocks)
    pageBlocks.value.set(pageNum, blocks)
    pageLayouts.value.set(pageNum, layout)
  }

  function getPageBlocks(pageNum: number): PositionedOcrBlock[] {
    return pageBlocks.value.get(pageNum) ?? []
  }

  function getPageLayout(pageNum: number): ColumnLayout {
    return pageLayouts.value.get(pageNum) ?? { numColumns: 1, columnBoundaries: [] }
  }

  function hasPage(pageNum: number): boolean {
    return pageBlocks.value.has(pageNum)
  }

  function clearAll() {
    pageBlocks.value.clear()
    pageLayouts.value.clear()
  }

  return {
    isRunning, error, pageBlocks, pageLayouts,
    setPageBlocks, getPageBlocks, getPageLayout, hasPage, clearAll
  }
})
