import { useEffect, useRef } from 'react'

const SCANNER_THRESHOLD_MS = 30 // Keystrokes faster than this are assumed to be from a hardware scanner

/**
 * Hook to listen for hardware barcode scanner inputs globally.
 * Hardware scanners emulate a keyboard, typing characters very quickly
 * and ending with an 'Enter' key press.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled: boolean = true) {
  const buffer = useRef<string>('')
  const lastKeyTime = useRef<number>(Date.now())

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an actual input field (unless we want to allow it)
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Exception: If they are focused on a specific "search" input, we might still want it.
        // But generally, a hardware scanner intercepts globally.
        // We'll let it pass if the input is a text field, but scanners usually fire too fast anyway.
      }

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime.current

      // If it's been too long since the last key, reset the buffer (human typing)
      if (timeDiff > SCANNER_THRESHOLD_MS && buffer.current.length > 0) {
        buffer.current = ''
      }

      if (e.key === 'Enter') {
        if (buffer.current.length > 3) {
          // Looks like a valid barcode length
          onScan(buffer.current)
          e.preventDefault() // prevent form submissions
        }
        buffer.current = ''
      } else if (e.key.length === 1) { // Ignore meta keys like Shift, Ctrl
        buffer.current += e.key
      }

      lastKeyTime.current = currentTime
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan, enabled])
}
