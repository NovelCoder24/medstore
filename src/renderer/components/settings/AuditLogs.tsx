import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { Loader2, ArrowLeft, ArrowRight, Eye } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

function formatDateTime(isoString: string) {
  return new Date(isoString).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function AuditLogs() {
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLogs', page],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.AUDIT_LOG_LIST, { page, pageSize })
    }
  })

  const [selectedLog, setSelectedLog] = useState<any>(null)

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Audit Trail</h2>
        <div className="text-sm text-muted-foreground">
          Immutable log of critical system actions
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
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity Type</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Override Auth</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium w-16">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y overflow-y-auto">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                data?.data.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                    </td>
                    <td className="px-4 py-3">{log.actor_name || `User ${log.actor_user_id}`}</td>
                    <td className="px-4 py-3 text-orange-600">
                      {log.override_name ? `Override: ${log.override_name}` : '-'}
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
          <div className="flex items-center justify-between p-3 border-t bg-muted/20">
            <div className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data?.total || 0)} of {data?.total || 0}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1 rounded hover:bg-muted disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                disabled={!data || data.data.length < pageSize}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded hover:bg-muted disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg">
                Audit Details: {selectedLog.action}
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex gap-4">
              <div className="flex-1 bg-muted/30 p-2 rounded border font-mono text-xs overflow-auto">
                <div className="font-semibold mb-2 text-muted-foreground">BEFORE:</div>
                <pre>{selectedLog.before_json ? JSON.stringify(JSON.parse(selectedLog.before_json), null, 2) : 'null'}</pre>
              </div>
              <div className="flex-1 bg-muted/30 p-2 rounded border font-mono text-xs overflow-auto">
                <div className="font-semibold mb-2 text-muted-foreground">AFTER:</div>
                <pre>{selectedLog.after_json ? JSON.stringify(JSON.parse(selectedLog.after_json), null, 2) : 'null'}</pre>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
