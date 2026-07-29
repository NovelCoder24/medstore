import React from 'react'
import { getAuditLabel, formatAuditValue } from '../../utils/auditFormatter'

export function AuditDetailsModal({ log, onClose }: { log: any, onClose: () => void }) {
  let beforeData: any = {}
  let afterData: any = {}
  
  try { 
    beforeData = log.before_json ? JSON.parse(log.before_json) : {} 
  } catch(e) {
    console.error("Failed to parse before_json")
  }
  
  try { 
    afterData = log.after_json ? JSON.parse(log.after_json) : {} 
  } catch(e) {
    console.error("Failed to parse after_json")
  }
  
  // Generate the diff array
  const changes = Object.keys(afterData).filter(key => {
    // Ignore metadata fields that always change but don't matter to the user
    if (['updated_at', 'created_at'].includes(key)) return false
    return JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="p-6 bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header & Reason */}
        <div className="mb-6 border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{log.action}</h2>
              <p className="text-sm text-gray-500">Affected: {log.entity_name || 'N/A'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-sm">
            <strong>Reason:</strong> {log.reason}
          </div>
        </div>

        {/* The Visual Diff Table */}
        <div className="flex-1 overflow-auto">
          {changes.length > 0 ? (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="px-4 py-2 border-b">Field</th>
                  <th className="px-4 py-2 border-b text-red-600">Previous</th>
                  <th className="px-4 py-2 border-b text-green-600">New</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {changes.map(key => (
                  <tr key={key}>
                    <td className="px-4 py-2 font-medium text-gray-700">
                      {getAuditLabel(key)}
                    </td>
                    <td className="px-4 py-2 bg-red-50/50 text-red-600 line-through">
                      {formatAuditValue(key, beforeData[key])}
                    </td>
                    <td className="px-4 py-2 bg-green-50/50 text-green-700 font-semibold">
                      {formatAuditValue(key, afterData[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 italic p-4 text-center">No exact field changes detected in payload.</p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t pt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
