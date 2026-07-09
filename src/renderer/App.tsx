import React, { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { useAuthStore } from './store/auth.store'
import { FirstRunSetup } from './components/auth/FirstRunSetup'
import { PinPad } from './components/auth/PinPad'
import { Layout } from './components/layout/Layout'
import { ProductList } from './components/catalog/ProductList'
import { VendorList } from './components/catalog/VendorList'
import { PosBilling } from './components/pos/PosBilling'
import { PurchaseForm } from './components/purchases/PurchaseForm'
import { Dashboard } from './components/dashboard/Dashboard'
import { CustomerList } from './components/customers/CustomerList'
import { SalesHistory } from './components/sales/SalesHistory'
import { Loader2 } from 'lucide-react'

import { SettingsForm } from './components/settings/SettingsForm'
import { StaffList } from './components/staff/StaffList'
import { AuditLogs } from './components/settings/AuditLogs'

export function App() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState('POS Billing')
  const user = useAuthStore((s) => s.user)

  const checkFirstRun = async () => {
    try {
      const isFirst = await window.api.invoke(IPC_CHANNELS.USERS_CHECK_FIRST_RUN)
      setIsFirstRun(isFirst)
    } catch (err) {
      console.error('Failed to check first run status', err)
    }
  }

  useEffect(() => {
    checkFirstRun()
  }, [])

  if (isFirstRun === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isFirstRun) {
    return <FirstRunSetup onComplete={checkFirstRun} />
  }

  if (!user) {
    return <PinPad />
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'POS Billing' && <PosBilling />}
      {activeTab === 'Inventory' && <ProductList />}
      {activeTab === 'Purchases' && <PurchaseForm />}
      {activeTab === 'Suppliers' && <VendorList />}
      {activeTab === 'Customers' && <CustomerList />}
      {activeTab === 'Sales History' && <SalesHistory />}
      {activeTab === 'Dashboard' && <Dashboard />}
      {activeTab === 'Staff' && <StaffList />}
      {activeTab === 'Audit Trail' && <AuditLogs />}
      {activeTab === 'Settings' && <SettingsForm />}
    </Layout>
  )
}


