import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { Loader2, ArrowLeft, ArrowRight, Eye, Filter, ShieldCheck, Calendar, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { AuditDetailsModal } from './AuditDetailsModal'

function formatDateTime(isoString: string) {
  return new Date(isoString).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  })
}

export function AuditLogs() {
  const [page, setPage] = useState(1)
  const pageSize = 20
  
  const [actionFilter, setActionFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
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

  const ACTION_TYPES = [
    'ALL',
    'UPDATE_BATCH',
    'VOID_SALE',
    'PRODUCT_UPDATE',
    'STOCK_OVERRIDE'
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Activity Audit Log</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">
              Immutable Log
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically chained record of batch price adjustments, voids, and inventory overrides.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          Refresh Log
        </button>
      </div>

      {/* Filter Bar Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action Type</label>
            <select 
              value={actionFilter} 
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">End Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(actionFilter !== 'ALL' || startDate || endDate) && (
            <button 
              onClick={() => { setActionFilter('ALL'); setStartDate(''); setEndDate(''); setPage(1); }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 underline"
            >
              Reset Filters
            </button>
          )}
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            {data?.total || 0} Total Events
          </span>
        </div>
      </div>

      {/* Log Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        {error ? (
          <div className="p-8 text-center text-xs font-semibold text-rose-600 bg-rose-50/50">
            Failed to load audit logs from database.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action & Target</th>
                    <th className="py-3 px-4">User / Actor</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4 text-center">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                        <span>Loading audit records...</span>
                      </td>
                    </tr>
                  ) : !data || data.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                        <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <span className="font-semibold text-slate-700">No audit events match your filter</span>
                      </td>
                    </tr>
                  ) : (
                    data.data.map((log: any) => {
                      const isModified = log.action?.includes('UPDATE') || log.action?.includes('MODIFY')
                      const isVoid = log.action?.includes('VOID') || log.action?.includes('DELETE')
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-blue-600 font-semibold">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isVoid
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : isModified
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {log.action}
                              </span>
                              <span className="font-bold text-slate-900">
                                {log.entity_name || `${log.entity_type} #${log.entity_id}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">{log.actor_name || `User ${log.actor_user_id}`}</span>
                              {log.override_name && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded">
                                  Override
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.reason || '-'}>
                            {log.reason || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button 
                              onClick={() => setSelectedLog(log)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                              title="Inspect JSON Snapshot"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data && data.total > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
                <div className="text-slate-500 font-medium">
                  Showing <strong className="text-slate-800">{(page - 1) * pageSize + 1}</strong> to <strong className="text-slate-800">{Math.min(page * pageSize, data.total)}</strong> of <strong className="text-slate-800">{data.total}</strong> events
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="px-2 font-bold text-slate-700">Page {page}</span>
                  <button
                    disabled={!data || data.data.length < pageSize}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Diff Table Modal */}
      {selectedLog && (
        <AuditDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  )
}

