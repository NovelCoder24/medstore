import React, { useState } from 'react'
import { X, Loader2, Save } from 'lucide-react'
import { useCreateProduct, useUpdateProduct } from '../../hooks/useProducts'
import type { Product } from '../../../main/services/product.service'

interface ProductFormModalProps {
  isOpen: boolean
  onClose: () => void
  product?: Product // If provided, we are in edit mode (not fully used yet but good for future)
}

export function ProductFormModal({ isOpen, onClose, product }: ProductFormModalProps) {
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateProduct()
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProduct()

  const [formData, setFormData] = useState({
    brand_name: product?.brand_name || '',
    generic_name: product?.generic_name || '',
    manufacturer: product?.manufacturer || '',
    category: product?.category || 'GENERIC',
    pack_size: String(product?.pack_size || 1),
    barcode: product?.barcode || '',
    hsn_code: product?.hsn_code || '',
    gst_rate_pct: String(product?.gst_rate_pct ?? 12),
    schedule_flag: product?.schedule_flag || 'NONE',
    shelf_rack: product?.shelf_rack || '',
    // Initial Stock fields (optional)
    initial_batch_number: '',
    initial_expiry_date: '',
    initial_quantity: '',
    initial_mrp: '',
    initial_purchase_rate: ''
  })
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        brand_name: product?.brand_name || '',
        generic_name: product?.generic_name || '',
        manufacturer: product?.manufacturer || '',
        category: product?.category || 'GENERIC',
        pack_size: String(product?.pack_size || 1),
        barcode: product?.barcode || '',
        hsn_code: product?.hsn_code || '',
        gst_rate_pct: String(product?.gst_rate_pct ?? 12),
        schedule_flag: product?.schedule_flag || 'NONE',
        shelf_rack: product?.shelf_rack || '',
        initial_batch_number: '',
        initial_expiry_date: '',
        initial_quantity: '',
        initial_mrp: '',
        initial_purchase_rate: ''
      })
      setError(null)
    }
  }, [isOpen, product])

  if (!isOpen) return null

  const isPending = isCreating || isUpdating

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.brand_name.trim()) {
      setError('Brand name is required')
      setTimeout(() => setError(null), 5000)
      return
    }

    try {
      let initial_batch = undefined
      if (!product && formData.initial_batch_number.trim() && formData.initial_quantity) {
        // Expiry defaults to 1 year ahead if empty
        let expiryDate = formData.initial_expiry_date
        if (!expiryDate) {
          const d = new Date()
          d.setFullYear(d.getFullYear() + 1)
          expiryDate = d.toISOString().slice(0, 7)
        }
        
        initial_batch = {
          batch_number: formData.initial_batch_number.trim().toUpperCase(),
          expiry_date: `${expiryDate}-28`, // SQLite format
          quantity: parseInt(formData.initial_quantity) || 0,
          mrp_paise: Math.round((parseFloat(formData.initial_mrp) || 0) * 100),
          purchase_rate_paise: Math.round((parseFloat(formData.initial_purchase_rate) || 0) * 100)
        }
      }

      const {
        initial_batch_number,
        initial_expiry_date,
        initial_quantity,
        initial_mrp,
        initial_purchase_rate,
        ...baseData
      } = formData

      const payload = {
        ...baseData,
        pack_size: parseInt(formData.pack_size) || 1,
        gst_rate_pct: parseFloat(formData.gst_rate_pct) || 0,
        // Convert empty strings to null for backend
        generic_name: formData.generic_name.trim() || null,
        manufacturer: formData.manufacturer.trim() || null,
        barcode: formData.barcode.trim() || null,
        hsn_code: formData.hsn_code.trim() || null,
        shelf_rack: formData.shelf_rack.trim() || null,
        initial_batch
      }

      if (product) {
        const { initial_batch: _, ...updatePayload } = payload
        await updateProduct({ id: product.id, data: updatePayload })
      } else {
        await createProduct(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save product')
      setTimeout(() => setError(null), 5000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-background rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <h2 className="text-lg font-semibold tracking-tight">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium">Brand Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="brand_name"
                  value={formData.brand_name}
                  onChange={handleChange}
                  placeholder="e.g. ALCINAC-RB CAP"
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium">Generic Name / Composition</label>
                <input 
                  type="text" 
                  name="generic_name"
                  value={formData.generic_name}
                  onChange={handleChange}
                  placeholder="e.g. Aceclofenac + Rabeprazole"
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Vendor</label>
                <input 
                  type="text" 
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  placeholder="e.g. Unicare"
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category <span className="text-red-500">*</span></label>
                <select 
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                  required
                >
                  <option value="GENERIC">Generic</option>
                  <option value="ETHICAL">Ethical</option>
                  <option value="SURGICAL">Surgical</option>
                  <option value="OTC">OTC / General</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pack Size (Units/Strip) <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  name="pack_size"
                  min="1"
                  value={formData.pack_size}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">GST % <span className="text-red-500">*</span></label>
                <select 
                  name="gst_rate_pct"
                  value={formData.gst_rate_pct}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                  required
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Schedule Flag</label>
                <select 
                  name="schedule_flag"
                  value={formData.schedule_flag}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                >
                  <option value="NONE">None</option>
                  <option value="H">Schedule H</option>
                  <option value="H1">Schedule H1</option>
                  <option value="X">Schedule X</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Shelf / Rack</label>
                <input 
                  type="text" 
                  name="shelf_rack"
                  value={formData.shelf_rack}
                  onChange={handleChange}
                  placeholder="e.g. A3"
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Barcode / EAN</label>
                <input 
                  type="text" 
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder="Scan or enter barcode"
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">HSN Code</label>
                <input 
                  type="text" 
                  name="hsn_code"
                  value={formData.hsn_code}
                  onChange={handleChange}
                  placeholder="e.g. 3004"
                  className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                />
              </div>

            </div>

            {/* Initial Stock Section */}
            {!product && (
              <>
                <div className="pt-2 pb-1 border-t mt-4">
                  <h3 className="text-sm font-semibold text-foreground">Initial Stock (Optional)</h3>
                  <p className="text-xs text-muted-foreground mb-2">Add initial stock to make this product available immediately.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Batch Number</label>
                    <input 
                      type="text" 
                      name="initial_batch_number"
                      value={formData.initial_batch_number}
                      onChange={handleChange}
                      placeholder="e.g. BATCH001"
                      className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Expiry Date (YYYY-MM)</label>
                    <input 
                      type="month" 
                      name="initial_expiry_date"
                      value={formData.initial_expiry_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Quantity (Units)</label>
                    <input 
                      type="number" 
                      name="initial_quantity"
                      min="0"
                      value={formData.initial_quantity}
                      onChange={handleChange}
                      placeholder="Total units (e.g. 100)"
                      className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">MRP (₹ per unit)</label>
                    <input 
                      type="number" 
                      name="initial_mrp"
                      min="0"
                      step="0.01"
                      value={formData.initial_mrp}
                      onChange={handleChange}
                      placeholder="e.g. 5.50"
                      className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Purchase Rate (₹ per unit)</label>
                    <input 
                      type="number" 
                      name="initial_purchase_rate"
                      min="0"
                      step="0.01"
                      value={formData.initial_purchase_rate}
                      onChange={handleChange}
                      placeholder="e.g. 3.20"
                      className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:ring-2 focus:ring-primary bg-background"
                    />
                  </div>
                </div>
              </>
            )}

          </form>
        </div>

        <div className="p-4 border-t bg-muted/20 flex justify-end gap-2">
          <button 
            type="button" 
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="product-form"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {product ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
