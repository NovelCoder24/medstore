import { contextBridge, ipcRenderer } from 'electron'
import { ALLOWED_CHANNELS, IpcChannel } from '../shared/ipc-channels'

// Custom APIs for renderer
const api = {
  /**
   * Send a message to the main process and expect a response via Promise.
   */
  invoke: (channel: IpcChannel, ...args: any[]): Promise<any> => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`))
  },

  /**
   * Send a one-way message to the main process.
   */
  send: (channel: IpcChannel, ...args: any[]): void => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    } else {
      console.error(`Unauthorized IPC channel: ${channel}`)
    }
  },

  /**
   * Listen for messages from the main process.
   * Returns an unsubscribe function.
   */
  on: (
    channel: IpcChannel,
    listener: (...args: any[]) => void
  ): (() => void) => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => listener(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    }
    console.error(`Unauthorized IPC channel: ${channel}`)
    return () => {}
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
