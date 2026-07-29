import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { LogOut, LayoutDashboard, ShoppingCart, PackageSearch, Users, Settings, ShoppingBag, FileDown, ShieldCheck, ClipboardList } from 'lucide-react'
import { ErrorBoundary } from './ErrorBoundary'

const navItems = [
  { icon: ShoppingCart, label: 'POS Billing', role: 'CASHIER' },
  { icon: PackageSearch, label: 'Inventory', role: 'CASHIER' },
  { icon: Users, label: 'Customers', role: 'CASHIER' },
  { icon: FileDown, label: 'Purchases', role: 'OWNER' },
  { icon: Users, label: 'Suppliers', role: 'OWNER' },
  { icon: LayoutDashboard, label: 'Dashboard', role: 'OWNER' },
  { icon: ShoppingBag, label: 'Sales History', role: 'OWNER' },
  { icon: ClipboardList, label: 'Drug Register', role: 'OWNER' },
  { icon: Users, label: 'Staff', role: 'OWNER' },
  { icon: ShieldCheck, label: 'Audit Trail', role: 'OWNER' },
  { icon: Settings, label: 'Settings', role: 'OWNER' },
]

interface LayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, logout, isOwner } = useAuthStore()

  const allowedNavItems = navItems.filter(
    (item) => item.role === 'CASHIER' || isOwner()
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-primary">MedStore</h1>
          <p className="text-xs text-muted-foreground mt-1">Pharmacy POS</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {allowedNavItems.map((item) => (
            <button
              key={item.label}
              onClick={() => onTabChange(item.label)}
              className={`flex items-center w-full gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === item.label 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.display_name}</p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
