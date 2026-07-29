import { formatPaise } from '../../shared/utils/paise'

const FIELD_LABELS: Record<string, string> = {
  mrp_paise: 'MRP',
  purchase_rate_paise: 'Purchase Rate',
  net_rate_paise: 'Net Rate',
  batch_number: 'Batch No',
  expiry_date: 'Expiry Date',
  status: 'Status',
  quantity: 'Stock Qty',
  discount_pct: 'Discount %',
  pack_size: 'Pack Size',
}

export function getAuditLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').toUpperCase()
}

export function formatAuditValue(key: string, value: any): string {
  if (value === null || value === undefined) return 'N/A'
  
  // Convert paise to Rupees automatically
  if (key.endsWith('_paise') && typeof value === 'number') {
    return formatPaise(value)
  }
  
  // Format dates automatically
  if (key.includes('date') || key.includes('_at')) {
    try {
      return new Date(value).toLocaleDateString('en-IN')
    } catch {
      return String(value)
    }
  }

  // Format percentages
  if (key.endsWith('_pct') && typeof value === 'number') {
    return `${value}%`
  }

  return String(value)
}
