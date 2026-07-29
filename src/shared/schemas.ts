import { z } from 'zod'

export const SaleItemSchema = z.object({
  productId: z.number().int().positive(),
  batchId: z.number().int().positive(),
  quantityUnits: z.number().int().positive(),
  mrpPaise: z.number().int().nonnegative(),
  salePricePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative(),
  cgstPaise: z.number().int().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
  lineTotalPaise: z.number().int().nonnegative()
})

export const SalePayloadSchema = z.object({
  userId: z.number().int().positive(),
  patientName: z.string().nullable().optional(),
  patientPhone: z.string().nullable().optional(),
  doctorName: z.string().nullable().optional(),
  doctorRegNo: z.string().nullable().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'CREDIT']),
  subtotalPaise: z.number().int().nonnegative(),
  totalDiscountPaise: z.number().int().nonnegative(),
  cgstPaise: z.number().int().nonnegative(),
  sgstPaise: z.number().int().nonnegative(),
  igstPaise: z.number().int().nonnegative(),
  grandTotalPaise: z.number().int().nonnegative(),
  customerId: z.number().int().positive().optional(),
  ownerPin: z.string().optional(),
  isInterState: z.boolean().optional(),
  items: z.array(SaleItemSchema).min(1, 'Sale must contain at least one item')
})

export const PurchaseItemSchema = z.object({
  productId: z.number().int().positive(),
  batchNumber: z.string().min(1),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
  quantityPacks: z.number().int().positive(),
  quantityUnits: z.number().int().positive(),
  mrpPaise: z.number().int().nonnegative(),
  purchaseRatePaise: z.number().int().nonnegative(),
  netRatePaise: z.number().int().nonnegative(),
  gstRatePct: z.number().nonnegative(),
  totalPaise: z.number().int().nonnegative()
})

export const PurchasePayloadSchema = z.object({
  userId: z.number().int().positive(),
  vendorId: z.number().int().positive(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date must be in YYYY-MM-DD format'),
  totalAmountPaise: z.number().int().nonnegative(),
  items: z.array(PurchaseItemSchema).min(1, 'Purchase invoice must contain at least one item')
})

export const AcceptPaymentSchema = z.object({
  customerId: z.number().int().positive(),
  amountPaise: z.number().int().positive('Payment amount must be greater than zero'),
  referenceId: z.string().optional()
})
