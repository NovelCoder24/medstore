import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { 
  LogOut, LayoutDashboard, CreditCard, PackageSearch, Users, 
  ShoppingCart, Truck, History, Pill, BadgeCheck, FileText, Settings 
} from 'lucide-react'
import { ErrorBoundary } from './ErrorBoundary'

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', role: 'OWNER' },
  { icon: CreditCard, label: 'POS Billing', role: 'CASHIER' },
  { icon: PackageSearch, label: 'Inventory', role: 'CASHIER' },
  { icon: Users, label: 'Customers', role: 'CASHIER' },
  { icon: ShoppingCart, label: 'Purchases', role: 'OWNER' },
  { icon: Truck, label: 'Suppliers', role: 'OWNER' },
  { icon: History, label: 'Sales History', role: 'OWNER' },
  { icon: Pill, label: 'Drug Register', role: 'OWNER' },
  { icon: BadgeCheck, label: 'Staff', role: 'OWNER' },
  { icon: FileText, label: 'Audit Trail', role: 'OWNER' },
]

interface LayoutProps {
  children: React.ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, logout, isOwner } = useAuthStore()

  const allowedNavItems = mainNavItems.filter(
    (item) => item.role === 'CASHIER' || isOwner()
  )

  const userInitial = (user?.display_name || user?.username || 'P').charAt(0).toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* SideNavBar */}
      <aside className="w-[280px] bg-[#F2F4F6] border-r border-border flex flex-col py-6 gap-2 z-50 select-none">
        {/* Brand Header */}
        <div className="px-6 mb-2">
          <h1 className="text-2xl font-black text-primary tracking-tight">MedStore</h1>
        </div>

        {/* Pharmacist / User Profile Strip */}
        <div className="px-6 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shadow-xs">
              {userInitial}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground line-clamp-1">
                Welcome, {user?.display_name || 'Pharmacist'}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                {isOwner() ? 'Central Pharmacy Branch' : 'Cashier Staff'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto px-4 flex flex-col gap-1 custom-scrollbar">
          {allowedNavItems.map((item) => {
            const isActive = activeTab === item.label
            const Icon = item.icon
            return (
              <button
                key={item.label}
                onClick={() => onTabChange(item.label)}
                className={`w-full px-4 py-3 flex items-center gap-3 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                  isActive
                    ? 'bg-primary/15 text-primary shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </button>
            )
          })}

          {/* Settings Tab - Fixed at Bottom */}
          {isOwner() && (
            <button
              onClick={() => onTabChange('Settings')}
              className={`w-full px-4 py-3 flex items-center gap-3 rounded-xl text-xs font-bold transition-all active:scale-[0.98] mt-auto ${
                activeTab === 'Settings'
                  ? 'bg-primary/15 text-primary shadow-xs'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium'
              }`}
            >
              <Settings className={`w-4 h-4 ${activeTab === 'Settings' ? 'text-primary' : 'text-muted-foreground'}`} />
              Settings
            </button>
          )}
        </nav>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 overflow-y-auto bg-background/50 p-6">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  )
}
