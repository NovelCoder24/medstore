import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { Loader2, ArrowLeft, ArrowRight, Eye, Filter } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AuditDetailsModal } from './AuditDetailsModal'

function formatDateTime(isoString: string) {
  return new Date(isoString).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function AuditLogs() {
  const [page, setPage] = useState(1)
  const pageSize = 20
  
  const [actionFilter, setActionFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogs', page, actionFilter, startDate, endDate],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.AUDIT_LOG_LIST, { 
        page, 
        pageSize,
        filters: { action: actionFilter, startDate, endDate }
      })
    }
  })

  const [selectedLog, setSelectedLog] = useState<any>(null)

  // Extract unique actions for the filter dropdown if we wanted to make it dynamic, 
  // but let's just use some common ones plus ALL for now.
  const ACTION_TYPES = [
    'ALL',
    'UPDATE_BATCH'
  ]

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Trail</h2>
          <div className="text-sm text-muted-foreground">
            Immutable log of critical system actions
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4 p-4 border rounded-md bg-card/50 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Action Type</label>
          <select 
            value={actionFilter} 
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border rounded-md text-sm bg-background"
          >
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Start Date</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border rounded-md text-sm bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">End Date</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border rounded-md text-sm bg-background"
          />
        </div>
        <div className="flex flex-col justify-end pb-0.5">
          <button 
            onClick={() => { setActionFilter('ALL'); setStartDate(''); setEndDate(''); setPage(1); }}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 text-red-500 bg-red-500/10 rounded-md">Failed to load audit logs</div>
      ) : (
        <div className="flex-1 overflow-auto border rounded-md bg-card flex flex-col">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="sticky top-0 bg-muted/95 backdrop-blur border-b z-10">
              <tr>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Action Details</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium w-16">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y overflow-y-auto">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                data?.data.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{log.action}</span> on {log.entity_name || `${log.entity_type} #${log.entity_id}`}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <span>{log.actor_name || `User ${log.actor_user_id}`}</span>
                      {log.override_name && (
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 border-red-200">
                          Manager Override
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{log.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="p-1 hover:bg-muted rounded text-primary"
                        title="View JSON"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t bg-muted/20 mt-auto">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data?.total || 0)} of {data?.total || 0}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1 rounded hover:bg-muted disabled:opacity-50 border bg-background"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                disabled={!data || data.data.length < pageSize}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded hover:bg-muted disabled:opacity-50 border bg-background"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Table Modal */}
      {selectedLog && (
        <AuditDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}
