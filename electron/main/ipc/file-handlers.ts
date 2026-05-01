import { dialog, app } from 'electron'
import type { IpcMain } from 'electron'
import { readFile } from 'fs/promises'
import { createReadStream, statSync } from 'fs'
import { createHash } from 'crypto'

export function registerFileHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('file:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const buffer = await readFile(filePath)
    return buffer
  })

  ipcMain.handle('file:hash', async (_event, filePath: string) => {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath, { start: 0, end: 65535 })
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => {
        // Append file size for a quick but effective fingerprint
        const size = statSync(filePath).size
        hash.update(String(size))
        resolve(hash.digest('hex').slice(0, 16))
      })
      stream.on('error', reject)
    })
  })

  ipcMain.handle('file:get-user-data-path', () => {
    return app.getPath('userData')
  })
}
