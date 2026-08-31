import React from 'react'
import { useAuthStore } from '../../store/auth.store'
import { 
  LogOut, LayoutDashboard, CreditCard, PackageSearch, Users, 
  ShoppingCart, Truck, History, Pill, BadgeCheck, FileText, Settings 
} from 'lucide-react'
import { ErrorBoundary } from './ErrorBoundary'
import { UpdateNotification } from './UpdateNotification'
import appIcon from '../../assets/icon.ico'

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', role: 'OWNER', badge: null },
  { icon: CreditCard, label: 'POS Billing', role: 'CASHIER', badge: null },
  { icon: PackageSearch, label: 'Inventory', role: 'CASHIER', badge: null },
  { icon: Users, label: 'Customers', role: 'CASHIER', badge: null },
  { icon: ShoppingCart, label: 'Purchases', role: 'OWNER', badge: null },
  { icon: Truck, label: 'Suppliers', role: 'OWNER', badge: null },
  { icon: History, label: 'Sales History', role: 'OWNER', badge: null },
  { icon: Pill, label: 'Drug Register', role: 'OWNER', badge: 'Sch H1' },
  { icon: BadgeCheck, label: 'Staff', role: 'OWNER', badge: null },
  { icon: FileText, label: 'Audit Trail', role: 'OWNER', badge: null },
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
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between transition-all duration-300 z-30 flex-shrink-0 select-none border-r border-slate-800">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-6 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1 shadow-lg shadow-blue-500/10 overflow-hidden shrink-0">
                <img src={appIcon} alt="MedStore" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-white text-lg tracking-tight leading-none">MedStore</h1>
                <span className="text-[10px] font-medium text-blue-400 tracking-wider uppercase">Rx Pharmacy ERP</span>
              </div>
            </div>
          </div>

          {/* User Info Card */}
          <div className="p-3 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-blue-600/30 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                {userInitial}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {user?.display_name || user?.username || 'Pharmacist'}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 py-1 text-xs font-medium overflow-y-auto max-h-[calc(100vh-230px)]">
            {allowedNavItems.map((item) => {
              const isActive = activeTab === item.label
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => onTabChange(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition duration-150 group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className={`w-4 h-4 mr-3 transition ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      item.badge === 'F2'
                        ? isActive ? 'bg-white text-blue-700' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : isActive ? 'bg-white text-red-700' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Bottom Settings Link */}
        {isOwner() && (
          <div className="p-3 border-t border-slate-800">
            <button
              onClick={() => onTabChange('Settings')}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-xs font-medium transition duration-150 group ${
                activeTab === 'Settings'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className={`w-4 h-4 mr-3 transition ${activeTab === 'Settings' ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
              Settings
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
        {/* Top Header - Clean Page Name Only */}
        <header className="h-14 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-20 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-3">
            <span className="font-bold text-slate-900 text-sm tracking-tight">{activeTab}</span>
            <span className="text-slate-300">/</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Terminal 01 (Online)
            </span>
          </div>
        </header>

        {/* Dynamic View Canvas */}
        <div className="flex-1 overflow-y-auto p-6" id="main-scroll-area">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>

        {/* Global In-App Update Notifications */}
        <UpdateNotification />
      </main>
    </div>
  )
}

