import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

import type { Paise } from '../../shared/utils/paise'

export interface ExpiryAlert {
  batchId: number
  productId: number
  brandName: string
  batchNumber: string
  expiryMonth: number
  expiryYear: number
  quantity: number
  daysUntilExpiry: number
}

export interface DashboardMetrics {
  todaySalesPaise: Paise
  todayProfitPaise: Paise
  todayBillsCount: number
  lowStockItemsCount: number
}

export function getExpiryAlerts(): ExpiryAlert[] {
  const db = getDatabase()
  
  // We need to calculate the difference between the expiry date (End of Month) and today.
  // SQLite date functions: date('now')
  // We construct the expiry date string as 'YYYY-MM-01', then add 1 month, subtract 1 day to get the last day of the month.
  
  const query = `
    SELECT 
      b.id as batchId,
      p.id as productId,
      p.brand_name as brandName,
      b.batch_number as batchNumber,
      b.expiry_date as expiryDate,
      b.quantity,
      CAST(
        julianday(b.expiry_date) - julianday(date('now', 'localtime')) 
      AS INTEGER) as daysUntilExpiry
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.status = 'ACTIVE' 
      AND b.quantity > 0
      AND CAST(julianday(b.expiry_date) - julianday(date('now', 'localtime')) AS INTEGER) <= 180 -- Alert starting 6 months out
    ORDER BY daysUntilExpiry ASC
  `
  
  return db.prepare(query).all() as ExpiryAlert[]
}

export interface LowStockAlert {
  productId: number
  brandName: string
  shelfRack: string | null
  totalQuantity: number
  packSize: number
}

export function getLowStockAlerts(): LowStockAlert[] {
  const db = getDatabase()
  
  const query = `
    SELECT 
      p.id as productId,
      p.brand_name as brandName,
      p.shelf_rack as shelfRack,
      p.pack_size as packSize,
      COALESCE(SUM(b.quantity), 0) as totalQuantity
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING totalQuantity <= (p.pack_size * 2)
    ORDER BY totalQuantity ASC
    LIMIT 10
  `
  
  return db.prepare(query).all() as LowStockAlert[]
}

export function getDashboardMetrics(): DashboardMetrics {
  const db = getDatabase()
  
  // 1. Sales and Bills Count for Today
  const salesQuery = `
    SELECT 
      COUNT(id) as todayBillsCount,
      COALESCE(SUM(total_paise), 0) as todaySalesPaise
    FROM sales
    WHERE date(created_at, 'localtime') = date('now', 'localtime')
  `
  
  const salesResult = db.prepare(salesQuery).get() as { todayBillsCount: number, todaySalesPaise: number }
  
  // 2. Profit for Today
  // Profit = Sum of (sale_price - purchase_rate) * quantity - total discount for all items sold today
  // Wait, in our schema: sale_items has unit_price_paise, discount_paise. 
  // But where is purchase_rate? We need to join with batches to get the purchase_rate_paise.
  const profitQuery = `
    SELECT 
      COALESCE(SUM(
        ((si.unit_price_paise * si.quantity) - si.discount_paise) - ((b.purchase_rate_paise / p.pack_size) * si.quantity)
      ), 0) as todayProfitPaise
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN batches b ON si.batch_id = b.id
    JOIN products p ON b.product_id = p.id
    WHERE date(s.created_at, 'localtime') = date('now', 'localtime')
  `
  
  const profitResult = db.prepare(profitQuery).get() as { todayProfitPaise: number }
  
  // 3. Low Stock Items (Active products with total stock <= pack_size * 2)
  // For simplicity, let's just count products with 0 stock.
  const lowStockQuery = `
    SELECT COUNT(*) as count FROM (
      SELECT p.id
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING COALESCE(SUM(b.quantity), 0) <= (p.pack_size * 2)
    )
  `
  const lowStockRow = db.prepare(lowStockQuery).get() as { count: number }

  return {
    todaySalesPaise: salesResult.todaySalesPaise as Paise,
    todayProfitPaise: profitResult.todayProfitPaise as Paise,
    todayBillsCount: salesResult.todayBillsCount,
    lowStockItemsCount: lowStockRow.count
  }
}

export function registerAnalyticsHandlers() {
  ipcMain.handle(IPC_CHANNELS.EXPIRY_DASHBOARD, () => {
    return getExpiryAlerts()
  })
  
  ipcMain.handle(IPC_CHANNELS.REPORTS_DAILY_SUMMARY, () => {
    return getDashboardMetrics()
  })

  ipcMain.handle(IPC_CHANNELS.REPORTS_LOW_STOCK, () => {
    return getLowStockAlerts()
  })
}
