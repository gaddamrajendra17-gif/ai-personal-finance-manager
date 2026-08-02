import { useEffect, useState } from 'react'
import api from '../services/api'
import BankLinkModal, { BankLogo } from '../components/BankLinkModal'

const BANK_NAMES = ['SBI','HDFC','ICICI','Axis','Kotak','PNB','Canara','BOB','Union Bank','IndusInd','Yes Bank','IDBI','Other']
const ACCOUNT_TYPES = ['savings','current','salary','fixed_deposit']

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showBankLinkModal, setShowBankLinkModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [syncing, setSyncing] = useState({})
  const [form, setForm] = useState({
    bank_name: 'SBI', account_last4: '', account_type: 'savings',
    balance: '', account_token: ''
  })

  const fetchAccounts = () => {
    setLoading(true)
    api.get('/api/accounts/')
      .then(r => setAccounts(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  // Auto-refresh balances on real-time transaction ingestion
  useEffect(() => {
    const handler = () => {
      fetchAccounts()
    }
    window.addEventListener('new-transaction-event', handler)
    return () => {
      window.removeEventListener('new-transaction-event', handler)
    }
  }, [])

  const showSuccess = (msg) => { 
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4500) 
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = 'manual_' + Date.now()
      await api.post('/api/accounts/', {
        bank_name: form.bank_name,
        account_token: token,
        account_last4: form.account_last4,
        account_type: form.account_type,
        balance: parseFloat(form.balance) || 0
      })
      setForm({ bank_name: 'SBI', account_last4: '', account_type: 'savings', balance: '', account_token: '' })
      setShowAdd(false)
      showSuccess('Manual bank account added successfully!')
      fetchAccounts()
    } catch (e) {
      alert('Failed to add account: ' + (e.response?.data?.detail || 'Unknown error'))
    } finally { 
      setSaving(false) 
    }
  }

  const handleSyncAccount = async (accId) => {
    setSyncing(prev => ({ ...prev, [accId]: true }))
    try {
      const res = await api.post('/api/plaid/sync-simulated', { account_id: accId })
      showSuccess(`Sync Complete! Simulated ${res.data.transactions_added} new transaction(s). New Balance: Rs. ${res.data.new_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`)
      fetchAccounts()
    } catch (e) {
      alert('Sync failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSyncing(prev => ({ ...prev, [accId]: false }))
    }
  }

  const handleAutoAdd = async () => {
    setSaving(true)
    try {
      const bankOpts = BANK_NAMES.filter(b => b !== 'Other')
      const randomBank = bankOpts[Math.floor(Math.random() * bankOpts.length)]
      const randomType = ACCOUNT_TYPES[Math.floor(Math.random() * ACCOUNT_TYPES.length)]
      const randomLast4 = Math.floor(1000 + Math.random() * 9000).toString()
      const randomBalance = Math.floor(10000 + Math.random() * 140000)
      
      const token = 'simulated:' + randomBank.toLowerCase() + '_' + Date.now()
      
      await api.post('/api/accounts/', {
        bank_name: randomBank,
        account_token: token,
        account_last4: randomLast4,
        account_type: randomType,
        balance: randomBalance
      })
      
      showSuccess(`Automatically added a simulated ${randomBank} account!`)
      fetchAccounts()
    } catch (e) {
      alert('Failed to auto-add account: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (accId) => {
    if (!window.confirm('Are you sure you want to delete this bank account? All associated transaction history and simulation configurations will be removed.')) {
      return
    }
    try {
      await api.delete(`/api/accounts/${accId}`)
      showSuccess('Account deleted successfully!')
      fetchAccounts()
    } catch (e) {
      alert('Failed to delete account: ' + (e.response?.data?.detail || e.message))
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0)

  const getAccountBadge = (token) => {
    if (!token) return { text: 'Manual', style: 'bg-slate-700/35 text-slate-400 border-slate-800' }
    if (token.startsWith('plaid:')) return { text: 'Plaid Sync', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    if (token.startsWith('simulated:plaid:')) return { text: 'Plaid (Simulated)', style: 'bg-teal-500/10 text-teal-400 border-teal-500/20' }
    if (token.startsWith('simulated:')) return { text: 'Direct Sync', style: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' }
    return { text: 'Manual', style: 'bg-slate-700/35 text-slate-400 border-slate-800' }
  }

  const getBankStyle = (token, bankName) => {
    if (!token) return 'generic'
    if (token.startsWith('simulated:')) {
      const parts = token.split(':')
      if (parts[1] && parts[1] !== 'plaid') {
        return parts[1] // sbi, hdfc, icici, chase, wells, bofa
      }
    }
    const nameLower = bankName.toLowerCase()
    if (nameLower.includes('sbi')) return 'sbi'
    if (nameLower.includes('hdfc')) return 'hdfc'
    if (nameLower.includes('icici')) return 'icici'
    if (nameLower.includes('chase')) return 'chase'
    if (nameLower.includes('wells')) return 'wells'
    if (nameLower.includes('america') || nameLower.includes('bofa')) return 'bofa'
    return 'generic'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-slide-in">
          <span>✅</span>
          <span className="font-semibold text-sm">{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Bank Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">{accounts.length} linked accounts</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={handleAutoAdd}
            disabled={saving}
            className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-teal-950/40"
          >
            ⚡ Auto Add Account
          </button>
          <button 
            onClick={() => setShowAdd(true)} 
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-slate-755"
          >
            + Add Manually
          </button>
          <button 
            onClick={() => setShowBankLinkModal(true)} 
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-950/40"
          >
            🔌 Link Bank Account
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 glass">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Balance Across All Accounts</div>
        <div className="text-3xl font-extrabold text-indigo-400 mt-2 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          Rs.{Math.round(totalBalance).toLocaleString()}
        </div>
        <div className="text-xs text-slate-500 mt-1">{accounts.length} linked and verified credentials</div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Add Manual Account</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Bank Name</label>
                <select value={form.bank_name} onChange={e=>setForm({...form,bank_name:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                  {BANK_NAMES.map(b=><option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Last 4 digits of Account Number</label>
                <input value={form.account_last4} onChange={e=>setForm({...form,account_last4:e.target.value.slice(0,4)})} placeholder="e.g. 1234" maxLength={4} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Account Type</label>
                <select value={form.account_type} onChange={e=>setForm({...form,account_type:e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                  {ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1 block">Current Balance (Rs.)</label>
                <input type="number" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="e.g. 50000" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition-colors">
                  {saving ? 'Adding...' : 'Add Account'}
                </button>
                <button type="button" onClick={()=>setShowAdd(false)} className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-400 py-2.5 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-12 flex flex-col items-center gap-2">
          <div className="animate-spin text-2xl">⏳</div>
          <div className="text-sm">Loading synchronized accounts...</div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center glass">
          <div className="text-5xl mb-4">🏦</div>
          <p className="text-white font-semibold text-lg">No Linked Bank Accounts</p>
          <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">Link your real-time bank feeds or simulated portals to dynamically parse transaction streams.</p>
          <button 
            onClick={() => setShowBankLinkModal(true)} 
            className="mt-6 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg"
          >
            + Link Bank Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {accounts.map((acc) => {
            const badge = getAccountBadge(acc.account_token || '')
            const logoType = getBankStyle(acc.account_token || '', acc.bank_name)
            const isSimulated = acc.account_token && acc.account_token.startsWith('simulated:')
            
            return (
              <div key={acc.id} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-950/5">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3.5">
                      <BankLogo type={logoType} className="w-12 h-12 rounded-2xl shadow-lg border border-slate-800" />
                      <div>
                        <p className="text-white font-extrabold text-base tracking-tight">{acc.bank_name}</p>
                        <p className="text-slate-400 text-xs mt-0.5 font-medium">
                          {acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1)} {acc.account_last4 ? '• • • • ' + acc.account_last4 : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${badge.style}`}>
                        {badge.text}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
                        <span className="text-[10px] text-slate-500 font-semibold">{acc.is_active ? 'Connected' : 'Offline'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-4 text-center mt-2">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Current Balance</div>
                    <div className="text-2xl font-black text-indigo-400 mt-1">
                      Rs.{Math.round(acc.balance || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-850 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="text-rose-500 hover:text-rose-450 hover:bg-rose-500/10 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98]"
                  >
                    🗑️ Delete Account
                  </button>
                  {isSimulated ? (
                    <button
                      onClick={() => handleSyncAccount(acc.id)}
                      disabled={syncing[acc.id]}
                      className="bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      {syncing[acc.id] ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <span>🔄</span>
                          <span>Sync Now</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">
                      {acc.account_token ? 'External Feed' : 'Manual Entry'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-slate-900/40 border border-amber-500/10 rounded-3xl p-5 glass">
        <h4 className="text-amber-400 font-bold text-sm mb-2.5 flex items-center gap-1.5">
          <span>✨</span>
          <span>Sync & Real-time Integration Notes</span>
        </h4>
        <ul className="text-slate-400 text-xs space-y-1.5 leading-relaxed">
          <li>• **Plaid Integration**: Syncs real bank credentials and downloads real transactions using production/sandbox OAuth environments.</li>
          <li>• **Simulated Sync**: Runs background ticks every 60 seconds. New debits and credits occur dynamically, complete with AI categorizations and anomaly flags.</li>
          <li>• **Sync Now**: Force immediate ingestion of 1 to 3 simulated transactions to instantly verify ledger updating, charts, and budget limits.</li>
          <li>• **WebSocket Broadcast**: Web clients receive pushes globally, rendering sliding alerts regardless of the tab you are viewing.</li>
        </ul>
      </div>

      <BankLinkModal 
        isOpen={showBankLinkModal} 
        onClose={() => setShowBankLinkModal(false)} 
        onSuccess={() => {
          setShowBankLinkModal(false)
          fetchAccounts()
        }}
        onManualClick={() => {
          setShowAdd(true)
        }}
      />
    </div>
  )
}
