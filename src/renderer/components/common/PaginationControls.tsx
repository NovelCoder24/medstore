import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationControlsProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (newPage: number) => void
}

export function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  if (totalItems <= pageSize && currentPage === 1) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 border-t border-slate-100 bg-slate-50/50">
        <span>Showing all {totalItems} records</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-600 border-t border-slate-200/80 bg-slate-50/60 select-none">
      <div>
        Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-900">{totalItems}</span> records
      </div>

      <div className="flex items-center gap-2">
        <span className="text-slate-500 font-medium mr-1">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
