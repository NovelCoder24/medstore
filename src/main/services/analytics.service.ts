import { getDatabase } from './db.service'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'

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
  todaySalesPaise: number
  todayProfitPaise: number
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
      b.expiry_month as expiryMonth,
      b.expiry_year as expiryYear,
      b.quantity,
      CAST(
        julianday(
          date(printf('%04d-%02d-01', b.expiry_year, b.expiry_month), '+1 month', '-1 day')
        ) - julianday(date('now', 'localtime')) 
      AS INTEGER) as daysUntilExpiry
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.status = 'ACTIVE' 
      AND b.quantity > 0
      AND daysUntilExpiry <= 180 -- Alert starting 6 months out (typical for pharmacy)
    ORDER BY daysUntilExpiry ASC
  `
  
  return db.prepare(query).all() as ExpiryAlert[]
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
        ((si.unit_price_paise * si.quantity) - si.discount_paise) - (b.purchase_rate_paise * si.quantity)
      ), 0) as todayProfitPaise
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN batches b ON si.batch_id = b.id
    WHERE date(s.created_at, 'localtime') = date('now', 'localtime')
  `
  
  const profitResult = db.prepare(profitQuery).get() as { todayProfitPaise: number }
  
  // 3. Low Stock Items (Active products with total stock <= pack_size * 2)
  // For simplicity, let's just count products with 0 stock.
  const lowStockQuery = `
    SELECT COUNT(p.id) as lowStockItemsCount
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING COALESCE(SUM(b.quantity), 0) <= (p.pack_size * 2)
  `
  
  // We need to count the rows returned by the GROUP BY
  const lowStockRows = db.prepare(lowStockQuery).all()
  
  return {
    todaySalesPaise: salesResult.todaySalesPaise,
    todayBillsCount: salesResult.todayBillsCount,
    todayProfitPaise: profitResult.todayProfitPaise,
    lowStockItemsCount: lowStockRows.length
  }
}

export function registerAnalyticsHandlers() {
  ipcMain.handle(IPC_CHANNELS.EXPIRY_DASHBOARD, () => {
    return getExpiryAlerts()
  })
  
  ipcMain.handle(IPC_CHANNELS.REPORTS_DAILY_SUMMARY, () => {
    return getDashboardMetrics()
  })
}
