import React, { useState } from 'react'
import { useStaff } from '../../hooks/useStaff'
import { StaffFormModal } from './StaffFormModal'
import { Users, UserPlus, ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export function StaffList() {
  const { staff, isLoading, deactivateStaff, isDeactivating } = useStaff()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const queryClient = useQueryClient()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Management</h1>
            <p className="text-sm text-muted-foreground">Manage your POS operators and owner accounts</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-primary hover:bg-primary/90"
        >
          <UserPlus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="border rounded-md shadow-sm bg-card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Joined Date</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {user.display_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-foreground text-foreground">
                      {user.role === 'OWNER' ? <ShieldAlert className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.is_active && user.role !== 'OWNER' && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to deactivate ${user.display_name}? They will no longer be able to log in.`)) {
                            deactivateStaff(user.id)
                          }
                        }}
                        disabled={isDeactivating}
                        className="text-red-600 hover:text-red-700 font-medium text-sm disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No staff members found.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <StaffFormModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['staff'] })
          }}
        />
      )}
    </div>
  )
}
