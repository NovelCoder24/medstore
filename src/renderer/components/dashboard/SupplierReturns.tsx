import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PackageMinus, AlertCircle, Clock } from 'lucide-react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { formatPaise } from '../../../shared/utils/paise'

export function SupplierReturns() {
  const { data: returnedBatches = [], isLoading } = useQuery({
    queryKey: ['supplierReturns'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.BATCHES_GET_RETURNED)
    }
  })

  if (isLoading) {
    return (
      <div className="bg-card border rounded-lg shadow-sm p-6 flex flex-col h-full animate-pulse">
        <div className="h-6 w-1/3 bg-muted rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted/50 rounded"></div>)}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg shadow-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between bg-muted/20">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <PackageMinus className="w-5 h-5" />
          <h3 className="font-semibold">Supplier Returns (Drafts)</h3>
        </div>
        <span className="text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
          {returnedBatches.length} Pending
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {returnedBatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <PackageMinus className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No pending supplier returns</p>
          </div>
        ) : (
          <div className="space-y-2">
            {returnedBatches.map((batch: any) => {
              const totalValue = batch.purchase_rate_paise * batch.quantity
              
              return (
                <div key={batch.id} className="p-3 bg-background border rounded hover:border-blue-200 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm truncate pr-2">
                        {batch.product_name}
                      </h4>
                      <span className="font-semibold text-sm whitespace-nowrap">
                        {formatPaise(totalValue as any)}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Batch:</span> {batch.batch_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Qty:</span> {batch.quantity} {batch.pack_size > 1 ? 'Units' : 'Strips'}
                      </span>
                      <span className="flex items-center gap-1 truncate max-w-[150px]">
                        <span className="font-medium">Vendor:</span> {batch.vendor_name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
