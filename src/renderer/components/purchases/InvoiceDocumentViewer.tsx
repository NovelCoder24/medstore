import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCw, X, Maximize2 } from 'lucide-react'

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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const isPdf = preview?.mimeType === 'application/pdf' || preview?.fileName.toLowerCase().endsWith('.pdf')

  // Always reset view state when a new preview is loaded
  useEffect(() => {
    setScale(1.0)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }, [preview?.dataUrl])

  // Measure container dimensions reactively so the image can calculate exact fit
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const resetFit = useCallback(() => {
    setScale(1.0)
    setPan({ x: 0, y: 0 })
  }, [])

  // Handle mouse wheel: smooth zoom and bounded pan
  useEffect(() => {
    const container = containerRef.current
    if (!container || isPdf) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // Trackpad pinch-to-zoom or Ctrl+Wheel
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        setScale((prev) => {
          const next = Math.min(Math.max(0.5, prev * factor), 5.0)
          if (next <= 1.05) {
            setPan({ x: 0, y: 0 })
            return 1.0
          }
          return next
        })
      } else {
        // Standard mouse wheel
        setScale((prevScale) => {
          if (prevScale > 1.05) {
            // Pan when zoomed in, with boundary clamping
            setPan((prevPan) => {
              const maxPanX = Math.max(80, (containerSize.width || 400) * (prevScale - 1) * 0.5)
              const maxPanY = Math.max(80, (containerSize.height || 400) * (prevScale - 1) * 0.5)
              return {
                x: Math.max(-maxPanX, Math.min(maxPanX, prevPan.x - e.deltaX * 0.8)),
                y: Math.max(-maxPanY, Math.min(maxPanY, prevPan.y - e.deltaY * 0.8))
              }
            })
            return prevScale
          } else {
            // If at 1.0x, scrolling up zooms in smoothly
            if (e.deltaY < 0) {
              return Math.min(5.0, prevScale * 1.15)
            }
            // Keep centered at fit
            setPan({ x: 0, y: 0 })
            return 1.0
          }
        })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [isPdf, containerSize])

  if (!preview) return null

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
    setPan({ x: 0, y: 0 })
  }

  // Mouse drag panning (bounded)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isPdf) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const maxPanX = Math.max(80, (containerSize.width || 400) * Math.max(0.2, scale - 0.8))
    const maxPanY = Math.max(80, (containerSize.height || 400) * Math.max(0.2, scale - 0.8))
    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, e.clientX - dragStartRef.current.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, e.clientY - dragStartRef.current.y))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    if (isPdf) return
    if (scale > 1.1 || pan.x !== 0 || pan.y !== 0) {
      resetFit()
    } else {
      setScale(2.0)
    }
  }

  const isRotated = rotation % 180 !== 0
  const pad = 24
  const availWidth = Math.max(100, containerSize.width - pad)
  const availHeight = Math.max(100, containerSize.height - pad)

  // Swap target box dimensions when rotated 90 or 270 deg so it fits inside the container
  const boxWidth = containerSize.width > 0 ? (isRotated ? availHeight : availWidth) : undefined
  const boxHeight = containerSize.height > 0 ? (isRotated ? availWidth : availHeight) : undefined

  const isModified = scale !== 1.0 || pan.x !== 0 || pan.y !== 0

  return (
    <div className="relative w-full h-full bg-slate-950 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Floating Action Controls: Rotate, Fit to Screen, and Close */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-xl p-1 shadow-lg select-none"
      >
        {!isPdf && (
          <>
            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {isModified && (
              <button
                type="button"
                onClick={resetFit}
                className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Fit to Screen (Reset Zoom & Pan)"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
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
        className={`w-full h-full overflow-hidden p-3 flex items-center justify-center relative select-none ${
          !isPdf ? (isDragging ? 'cursor-grabbing' : scale > 1.05 ? 'cursor-grab' : 'cursor-zoom-in') : ''
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
            className="origin-center will-change-transform transition-[transform] duration-75 flex items-center justify-center shrink-0"
            style={{
              width: boxWidth ? `${boxWidth}px` : '100%',
              height: boxHeight ? `${boxHeight}px` : '100%',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center'
            }}
          >
            <img
              src={preview.dataUrl}
              alt="Source Invoice"
              className="w-full h-full object-contain rounded shadow-lg select-none pointer-events-none"
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
