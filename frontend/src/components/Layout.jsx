import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import NotificationBell from './NotificationBell'
import ToastNotification from './ToastNotification'

const navItems = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/transactions', icon: '💳', label: 'Transactions' },
  { to: '/receipt-scan', icon: '🧾', label: 'Receipt Scan' },
  { to: '/accounts', icon: '🏦', label: 'Accounts' },
  { to: '/budgets', icon: '🎯', label: 'Budgets' },
  { to: '/goals', icon: '🏆', label: 'Goals' },
  { to: '/forecast', icon: '📈', label: 'Forecast' },
  { to: '/chat', icon: '🤖', label: 'AI Chat' },
  { to: '/gamification', icon: '🎖️', label: 'Rewards' },
  { to: '/predictions', icon: '🔮', label: 'ML Predict' },
  { to: '/sms-import', icon: '📱', label: 'SMS Import' },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
  { to: '/voice', icon: '🎙️', label: 'Voice' },
  { to: '/real-time-agent', icon: '✨', label: 'Voice Agent' },
  { to: '/expense-map', icon: '🗺️', label: 'Expense Map' },
  { to: '/split', icon: '👥', label: 'Split' },
  { to: '/robo-advisor', icon: '🤖', label: 'Robo-Advisor' },
  { to: '/investments', icon: '💼', label: 'AI Investments' },
  { to: '/trading', icon: '⚡', label: 'Algo Trading' },
  { to: '/financial-advisor', icon: '🧠', label: 'AI Advisor' },
  { to: '/security', icon: '🔒', label: 'Security & Trust' },
]

export default function Layout() {
  const { user, token, logout } = useAuthStore()
  const navigate = useNavigate()
  const [toasts, setToasts] = useState([])

  const addToast = (toast) => {
    setToasts((prev) => [...prev, toast])
  }

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    if (!token || !user?.id) return
    let ws = null
    let reconnectTimeout = null
    let currentDelay = 3000

    const connect = () => {
      ws = new WebSocket(`ws://localhost:8000/api/notifications/ws/${user.id}`)
      
      ws.onopen = () => {
        console.log('Global Layout WebSocket connected')
        currentDelay = 3000
        if (reconnectTimeout) clearTimeout(reconnectTimeout)
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'new_transaction') {
            // Dispatch event for pages (Dashboard and Transactions)
            window.dispatchEvent(new CustomEvent('new-transaction-event', { detail: data.transaction }))
            
            // Add transaction toast
            const amountStr = Math.abs(data.transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            const isCredit = data.transaction.transaction_type === 'CREDIT'
            
            addToast({
              id: data.transaction.id || Date.now().toString(),
              title: isCredit ? '💸 Money Received' : '💰 Money Spent',
              message: `${isCredit ? 'Received' : 'Spent'} Rs. ${amountStr} at ${data.transaction.merchant}`,
              type: isCredit ? 'success' : 'info',
              category: data.transaction.category
            })
          } else if (data.type === 'notification') {
            // Dispatch event for NotificationBell
            window.dispatchEvent(new CustomEvent('new-notification-event', { detail: data.notification }))
            
            // Only toast warnings and dangers (anomalies, budget limit alerts) to avoid duplication of standard spends
            if (data.notification.notif_type === 'danger' || data.notification.notif_type === 'warning') {
              addToast({
                id: data.notification.id || Date.now().toString(),
                title: data.notification.title,
                message: data.notification.message,
                type: data.notification.notif_type
              })
            }
          }
        } catch (err) {
          console.error('Error parsing WS message:', err)
        }
      }

      ws.onclose = () => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(() => {
          currentDelay = Math.min(currentDelay * 2, 30000)
          connect()
        }, currentDelay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (ws) ws.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [token, user?.id])

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-dark-800 border-r border-dark-500 flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-dark-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm">💎</div>
            <div>
              <div className="text-sm font-bold text-white">PFM AI</div>
              <div className="text-xs text-gray-500">Finance Manager</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                }`
              }
            >
              <span>{icon}</span>
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-500">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-700">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xs font-bold text-white">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.full_name}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} className="text-gray-500 hover:text-red-400 text-xs transition-colors" title="Logout">⏻</button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 h-12 bg-dark-800 border-b border-dark-500 flex items-center justify-end px-4">
          <NotificationBell token={token} userId={user?.id} />
        </header>
        <main className="flex-1 overflow-y-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
      <ToastNotification toasts={toasts} removeToast={removeToast} />
    </div>
  )
}


