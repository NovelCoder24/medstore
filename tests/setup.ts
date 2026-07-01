import { vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'

// Mock electron so tests can run without installing the electron binary
vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return join(tmpdir(), 'medstore-pos-test')
        }
        return ''
      },
      whenReady: () => Promise.resolve(),
      on: vi.fn(),
      quit: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    },
    contextBridge: {
      exposeInMainWorld: vi.fn(),
    },
    BrowserWindow: vi.fn(),
  }
})
