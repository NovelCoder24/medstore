import React, { useState } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { 
  LayoutDashboard, CreditCard, PackageSearch, Users, 
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
  const { isOwner } = useAuthStore()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const allowedNavItems = mainNavItems.filter(
    (item) => item.role === 'CASHIER' || isOwner()
  )

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-slate-300 flex flex-col justify-between transition-all duration-300 z-30 flex-shrink-0 select-none border-r border-slate-800`}>
        <div>
          {/* Brand Header: Logo button toggles expand/collapse */}
          <div className={`h-16 flex items-center ${
            isCollapsed ? 'justify-center px-2' : 'px-5'
          } bg-slate-950 border-b border-slate-800`}>
            <div className="flex items-center space-x-3 overflow-hidden">
              <button
                type="button"
                onClick={toggleCollapsed}
                title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1 shadow-lg shadow-blue-500/10 overflow-hidden shrink-0 hover:border-slate-700 transition cursor-pointer"
              >
                <img src={appIcon} alt="MedStore" className="w-full h-full object-contain" />
              </button>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <h1 className="font-bold text-white text-lg tracking-tight leading-none truncate">MedStore</h1>
                  <span className="text-[10px] font-medium text-blue-400 tracking-wider uppercase block truncate">Rx Pharmacy ERP</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className={`px-2 space-y-1 pt-3 pb-1 text-xs font-medium overflow-y-auto ${
            isCollapsed ? 'max-h-[calc(100vh-140px)]' : 'max-h-[calc(100vh-150px)] px-3'
          }`}>
            {allowedNavItems.map((item) => {
              const isActive = activeTab === item.label
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  onClick={() => onTabChange(item.label)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } rounded-lg font-medium transition duration-150 group relative cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
                    <Icon className={`w-4 h-4 transition shrink-0 ${
                      isCollapsed ? '' : 'mr-3'
                    } ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>

                  {item.badge && (
                    isCollapsed ? (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-900" />
                    ) : (
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                        item.badge === 'F2'
                          ? isActive ? 'bg-white text-blue-700' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : isActive ? 'bg-white text-red-700' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    )
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section: Settings */}
        {isOwner() && (
          <div className="p-2 border-t border-slate-800">
            <button
              onClick={() => onTabChange('Settings')}
              title={isCollapsed ? 'Settings' : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'
              } rounded-lg text-xs font-medium transition duration-150 group cursor-pointer ${
                activeTab === 'Settings'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className={`w-4 h-4 transition shrink-0 ${
                isCollapsed ? '' : 'mr-3'
              } ${activeTab === 'Settings' ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
              {!isCollapsed && <span>Settings</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
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

