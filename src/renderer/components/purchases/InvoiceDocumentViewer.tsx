import React, { useState, useEffect, useRef } from 'react'
import { RotateCw, X } from 'lucide-react'

interface InvoiceDocumentViewerProps {
  preview: {
    dataUrl: string
    mimeType: string
    fileName: string
  } | null
  onClose?: () => void
}

export function InvoiceDocumentViewer({ preview, onClose }: InvoiceDocumentViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const isPdf = preview?.mimeType === 'application/pdf' || preview?.fileName.toLowerCase().endsWith('.pdf')

  // Handle trackpad pinch-to-zoom and two-finger pan
  useEffect(() => {
    const container = containerRef.current
    if (!container || isPdf) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // Trackpad pinch-to-zoom (Chromium sets ctrlKey = true during trackpad pinch gesture)
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        setScale((prev) => Math.min(Math.max(0.4, prev * factor), 5.0))
      } else {
        // Trackpad 2-finger scroll/pan
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY
        }))
      }
    }

    const handleGestureChange = (e: any) => {
      e.preventDefault()
      if (e.scale) {
        setScale((prev) => Math.min(Math.max(0.4, prev * e.scale), 5.0))
      }
    }

    const handleGestureStart = (e: any) => e.preventDefault()

    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('gesturestart', handleGestureStart, { passive: false })
    container.addEventListener('gesturechange', handleGestureChange, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('gesturestart', handleGestureStart)
      container.removeEventListener('gesturechange', handleGestureChange)
    }
  }, [isPdf])

  if (!preview) return null

  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  // Mouse drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isPdf) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (isPdf) return
    if (scale > 1.2) {
      setScale(1.0)
      setPan({ x: 0, y: 0 })
    } else {
      setScale(2.0)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden">
      {/* Minimal Header: Only Rotate and Close buttons */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-2 bg-slate-800/90 border-b border-slate-700/70 shrink-0 select-none">
        {!isPdf && (
          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition cursor-pointer"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
            title="Close Preview"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Viewer Content Canvas with Gesture Support */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className={`flex-1 overflow-hidden bg-slate-950 p-4 flex items-center justify-center relative select-none ${
          !isPdf ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        {isPdf ? (
          <iframe
            src={preview.dataUrl}
            className="w-full h-full rounded-lg border-0 bg-white"
            title="Invoice PDF Preview"
          />
        ) : (
          <div
            className="origin-center will-change-transform transition-[transform] duration-75 flex items-center justify-center max-w-full max-h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <img
              src={preview.dataUrl}
              alt="Source Invoice"
              className="max-h-[72vh] max-w-full object-contain rounded shadow-2xl select-none pointer-events-none"
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
