import { IpcChannel } from '../shared/ipc-channels'

declare global {
  interface Window {
    api: {
      invoke(channel: IpcChannel, ...args: any[]): Promise<any>
      send(channel: IpcChannel, ...args: any[]): void
      on(channel: IpcChannel, listener: (...args: any[]) => void): () => void
    }
  }
}

export {}
