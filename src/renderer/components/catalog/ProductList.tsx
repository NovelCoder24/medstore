import React, { useState } from 'react'
import { useProducts } from '../../hooks/useProducts'
import { Search, Plus, Loader2, Upload } from 'lucide-react'
import { formatPaise } from '../../../main/utils/paise'
import { formatStock } from '../../../main/utils/pack-size'
import { ImportCsvModal } from '../import/ImportCsvModal'

export function ProductList() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  
  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading, error } = useProducts({ query: debouncedQuery, page: 1 })

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Inventory</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <ImportCsvModal isOpen={isImportOpen} onOpenChange={setIsImportOpen} />

      <div className="flex items-center gap-2 px-3 py-2 bg-card border rounded-md shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by brand name, generic name, or barcode..."
          className="flex-1 bg-transparent outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {error ? (
        <div className="p-4 text-red-500 bg-red-500/10 rounded-md">Failed to load products</div>
      ) : (
        <div className="flex-1 overflow-auto border rounded-md bg-card">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium">Brand Name</th>
                <th className="px-4 py-3 font-medium">Generic / Composition</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Pack Size</th>
                <th className="px-4 py-3 font-medium text-right">Total Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.map((product) => (
                <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{product.brand_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.composition?.salt_name || product.generic_name || '-'}
                  </td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3">{product.pack_size}</td>
                  <td className="px-4 py-3 text-right">
                    {formatStock(product.total_stock_units || 0, product.pack_size)}
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {data?.data.length || 0} of {data?.total || 0} items</span>
      </div>
    </div>
  )
}
