import React from 'react'
import { useVendors } from '../../hooks/useVendors'
import { Plus, Building2, Loader2 } from 'lucide-react'

export function VendorList() {
  const { data, isLoading, error } = useVendors()

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Suppliers & Vendors</h2>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="p-4 text-red-500 bg-red-500/10 rounded-md">Failed to load vendors</div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((vendor) => (
            <div key={vendor.id} className="flex flex-col p-4 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{vendor.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    GSTIN: {vendor.gstin || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t text-sm space-y-1 text-muted-foreground">
                <p>Phone: {vendor.contact_phone || 'N/A'}</p>
                <p>Email: {vendor.contact_email || 'N/A'}</p>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="col-span-full p-8 text-center text-muted-foreground border rounded-lg border-dashed">
              No vendors added yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
