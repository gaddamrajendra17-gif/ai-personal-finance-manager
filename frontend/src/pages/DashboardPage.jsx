import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../services/api'
import useRealTimeTransactions from '../hooks/useRealTimeTransactions'

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

export default function DashboardPage() {
   const [data, setData] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [accounts, setAccounts] = useState([])
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickForm, setQuickForm] = useState({ amount: '', merchant: '', transaction_type: 'DEBIT', category: 'Food & Dining' })
  const [roboProfile, setRoboProfile] = useState(null)
  const [portfolioSummary, setPortfolioSummary] = useState(null)
  const [adjustments, setAdjustments] = useState([])
  const [goalPredictions, setGoalPredictions] = useState([])
  const [upcomingBills, setUpcomingBills] = useState([])
  const [simulating, setSimulating] = useState(false)
  const [continuousSpend, setContinuousSpend] = useState(false)
  const [latestSimTx, setLatestSimTx] = useState(null)

  const fetchData = useCallback(() => {
    Promise.all([
      api.get('/api/dashboard/'),
      api.get('/api/transactions/?limit=200'),
      api.get('/api/accounts/').catch(() => ({ data: [] })),
      api.get('/api/robo-advisor/profile').catch(() => ({ data: { configured: false } })),
      api.get('/api/investments/portfolio').catch(() => ({ data: null })),
      api.get('/api/budgets/realtime-adjustments').catch(() => ({ data: [] })),
      api.get('/api/goals/savings-prediction').catch(() => ({ data: [] })),
      api.get('/api/recurring/upcoming').catch(() => ({ data: [] }))
    ]).then(([dash, txns, accs, robo, port, adj, pred, upcoming]) => {
      setData(dash.data)
      setTransactions(txns.data || [])
      setAccounts(accs.data || [])
      setRoboProfile(robo.data?.configured ? robo.data : null)
      setPortfolioSummary(port.data)
      setAdjustments(adj.data || [])
      setGoalPredictions(pred.data || [])
      setUpcomingBills(upcoming.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useRealTimeTransactions(useCallback((newTxn) => {
    fetchData()
  }, [fetchData]))

  const handleAutoSpend = async (accountId) => {
    if (!accountId) return
    setSimulating(true)
    try {
      const res = await api.post(`/api/accounts/${accountId}/auto-spend`)
      setLatestSimTx(res.data)
      fetchData()
    } catch (e) {
      console.error(e)
      alert("Failed to execute auto-spending: " + (e.response?.data?.detail || e.message))
    } finally {
      setSimulating(false)
    }
  }

  const handleAutoSeed = async () => {
    setLoading(true)
    try {
      const bankOpts = ['SBI','HDFC','ICICI','Axis','Kotak']
      const randomBank = bankOpts[Math.floor(Math.random() * bankOpts.length)]
      const randomType = 'savings'
      const randomLast4 = Math.floor(1000 + Math.random() * 9000).toString()
      const randomBalance = Math.floor(30000 + Math.random() * 120000)
      const token = 'simulated:' + randomBank.toLowerCase() + '_' + Date.now()
      
      await api.post('/api/accounts/', {
        bank_name: randomBank,
        account_token: token,
        account_last4: randomLast4,
        account_type: randomType,
        balance: randomBalance
      })
      
      setTimeout(() => {
        fetchData()
      }, 1500)
    } catch (e) {
      console.error(e)
      setLoading(false)
      alert("Failed to auto-seed simulated account.")
    }
  }

  useEffect(() => {
    let interval = null
    if (continuousSpend) {
      const simAcc = accounts.find(a => a.account_token?.startsWith("simulated:"))
      if (simAcc) {
        interval = setInterval(() => {
          handleAutoSpend(simAcc.id)
        }, 5000)
      } else {
        alert("Please create a simulated account first!")
        setContinuousSpend(false)
      }
    } else {
      if (interval) clearInterval(interval)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [continuousSpend, accounts])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => { clearInterval(interval); clearInterval(clock) }
  }, [fetchData])

  const handleQuickAdd = async (e) => {
    e.preventDefault()
    try {
      const acc = accounts[0]
      if (!acc) { alert('Please add a bank account first!'); return }
      await api.post('/api/transactions/', {
        account_id: acc.id,
        amount: parseFloat(quickForm.amount),
        merchant: quickForm.merchant,
        transaction_type: quickForm.transaction_type,
        category: quickForm.category,
        description: '',
        timestamp: new Date().toISOString()
      })
      setShowQuickAdd(false)
      setQuickForm({ amount: '', merchant: '', transaction_type: 'DEBIT', category: 'Food & Dining' })
      fetchData()
    } catch (e) { alert('Failed to add transaction') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-4xl mb-4">💰</div>
        <p className="text-gray-400 text-lg">Loading Dashboard...</p>
      </div>
    </div>
  )

  const today = new Date().toDateString()
  const todayTxns = transactions.filter(t => new Date(t.timestamp || t.created_at).toDateString() === today)
  const todayDebits = todayTxns.filter(t => t.amount < 0)
  const todayCredits = todayTxns.filter(t => t.amount > 0)
  const todaySpent = todayDebits.reduce((s, t) => s + Math.abs(t.amount), 0)
  const todayIncome = todayCredits.reduce((s, t) => s + t.amount, 0)

  const hourlyMap = {}
  for (let h = 0; h < 24; h++) hourlyMap[h] = 0
  todayDebits.forEach(t => {
    const h = new Date(t.timestamp || t.created_at).getHours()
    hourlyMap[h] += Math.abs(t.amount)
  })
  const hourlyData = Object.entries(hourlyMap)
    .filter(([h]) => parseInt(h) <= new Date().getHours())
    .map(([h, amt]) => ({ hour: (parseInt(h)%12||12)+(parseInt(h)<12?'am':'pm'), amount: Math.round(amt) }))

  const todayCatMap = {}
  todayDebits.forEach(t => {
    const c = t.category || 'Others'
    todayCatMap[c] = (todayCatMap[c] || 0) + Math.abs(t.amount)
  })
  const todayCatData = Object.entries(todayCatMap).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a,b) => b.value - a.value)

  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toDateString()
    const spent = transactions.filter(t => t.amount < 0 && new Date(t.timestamp||t.created_at).toDateString()===ds).reduce((s,t)=>s+Math.abs(t.amount),0)
    const income = transactions.filter(t => t.amount > 0 && new Date(t.timestamp||t.created_at).toDateString()===ds).reduce((s,t)=>s+t.amount,0)
    last7.push({ day: d.toLocaleDateString('en',{weekday:'short'}), spent: Math.round(spent), income: Math.round(income) })
  }

  const catMap = {}
  transactions.filter(t => t.amount < 0).forEach(t => {
    const c = t.category || 'Others'
    catMap[c] = (catMap[c] || 0) + Math.abs(t.amount)
  })
  const catData = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a,b) => b.value - a.value).slice(0,6)

  const totalIncome = data?.total_income || 0
  const totalSpent = data?.total_spent || 0
  const totalSavings = data?.total_savings || 0
  const goals = data?.goals || []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-indigo-500/50 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-4">Quick Add Transaction</h3>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={quickForm.merchant} onChange={e=>setQuickForm({...quickForm,merchant:e.target.value})} placeholder="Merchant name" required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
                <input type="number" value={quickForm.amount} onChange={e=>setQuickForm({...quickForm,amount:e.target.value})} placeholder="Amount (Rs.)" required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={quickForm.transaction_type} onChange={e=>setQuickForm({...quickForm,transaction_type:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm">
                  <option value="DEBIT">Debit (Expense)</option>
                  <option value="CREDIT">Credit (Income)</option>
                </select>
                <select value={quickForm.category} onChange={e=>setQuickForm({...quickForm,category:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm">
                  {['Food & Dining','Transport','Shopping','Utilities','Entertainment','Health & Medical','Education','Investments','Other'].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl font-medium transition-colors">Add Transaction</button>
                <button type="button" onClick={()=>setShowQuickAdd(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-gray-300 py-2.5 rounded-xl transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Your complete financial overview</p>
        </div>
        <div className="text-right">
          <div className="text-white font-semibold">{now.toLocaleTimeString()}</div>
          <div className="text-xs text-gray-500">{now.toLocaleDateString('en',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
      </div>

      {/* AI Live Transaction Simulation Control Center */}
      {accounts.some(a => a.account_token?.startsWith("simulated:")) && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-gray-700/50 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <h3 className="text-white font-extrabold text-sm flex items-center gap-2">
                <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                🤖 AI Live Transaction Simulation
              </h3>
              <p className="text-gray-400 text-xs mt-1">
                Simulate real-time transactions in your accounts and watch dashboard metrics update live.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  const simAcc = accounts.find(a => a.account_token?.startsWith("simulated:"));
                  if (simAcc) handleAutoSpend(simAcc.id);
                }}
                disabled={simulating}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer"
              >
                {simulating ? "⏳ Simulating..." : "💸 Trigger Simulated Expense"}
              </button>

              <button
                onClick={() => setContinuousSpend(!continuousSpend)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  continuousSpend 
                    ? "bg-green-600/20 text-green-400 border-green-500/30 font-bold animate-pulse" 
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600"
                }`}
              >
                {continuousSpend ? "⏹️ Stop Continuous Spend" : "🔁 Continuous Auto-Spend (5s)"}
              </button>
            </div>
          </div>
          {latestSimTx && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-700/50 flex items-center justify-between text-xs animate-fade-in">
              <span className="text-gray-400">Latest Live Update:</span>
              <div className="flex items-center gap-2">
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-lg font-bold">
                  Spent ₹{latestSimTx.amount.toLocaleString()} at {latestSimTx.merchant}
                </span>
                <span className="text-gray-500">({latestSimTx.category})</span>
              </div>
            </div>
          )}
        </div>
      )}

      {accounts.length === 0 && (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/35 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span>🚀</span> Welcome to PFM AI!
              </h3>
              <p className="text-gray-400 text-sm mt-1 max-w-xl">
                Get started instantly. Click below to automatically generate a simulated bank account loaded with 90 days of historical transactions.
              </p>
            </div>
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const bankOpts = ['SBI','HDFC','ICICI','Axis','Kotak']
                  const randomBank = bankOpts[Math.floor(Math.random() * bankOpts.length)]
                  const randomType = 'savings'
                  const randomLast4 = Math.floor(1000 + Math.random() * 9000).toString()
                  const randomBalance = Math.floor(40000 + Math.random() * 100000)
                  const token = 'simulated:' + randomBank.toLowerCase() + '_' + Date.now()
                  
                  await api.post('/api/accounts/', {
                    bank_name: randomBank,
                    account_token: token,
                    account_last4: randomLast4,
                    account_type: randomType,
                    balance: randomBalance
                  })
                  
                  setTimeout(() => {
                    fetchData()
                  }, 1500)
                } catch (e) {
                  alert('Failed to auto-seed account.')
                  setLoading(false)
                }
              }}
              className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-5 py-3 rounded-2xl text-sm font-semibold transition-all shadow-lg shrink-0 cursor-pointer"
            >
              ⚡ Auto Add Simulated Account
            </button>
          </div>
        </div>
      )}

      {/* AI Financial Insights Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Robo-Advisor & Investment Portfolio Overview */}
        <div className="bg-slate-800 border border-gray-700 rounded-3xl p-5 shadow-xl glass flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-extrabold text-sm flex items-center gap-2">
                <span>🤖</span> AI Robo & Portfolio Summary
              </h3>
              <Link to="/robo-advisor" className="text-xs text-primary hover:underline">Configure ➔</Link>
            </div>
            
            {roboProfile ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Risk Profile:</span>
                  <span className="text-primary font-bold">{roboProfile.risk_tolerance} ({roboProfile.risk_score}/100)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Simulated Portfolio Value:</span>
                  <span className="text-white font-bold">₹{portfolioSummary ? Math.round(portfolioSummary.total_value).toLocaleString() : '0'}</span>
                </div>
                {portfolioSummary && portfolioSummary.total_value > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Portfolio Returns (P&L):</span>
                    <span className={`font-bold ${portfolioSummary.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ₹{Math.round(portfolioSummary.total_pnl).toLocaleString()} ({portfolioSummary.total_pnl_percent.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-xs leading-relaxed py-2">
                You haven't configured your AI Robo-Advisor yet. Take the quick 3-step questionnaire to generate a custom asset allocation and personalized investment plan.
              </p>
            )}
          </div>
          {!roboProfile && (
            <Link to="/robo-advisor" className="mt-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-center py-2.5 rounded-xl text-xs font-bold transition-all">
              Initialize Robo-Advisor
            </Link>
          )}
          {roboProfile && (
            <div className="flex gap-2 mt-4">
              <Link to="/investments" className="flex-1 bg-primary text-dark-900 text-center py-2.5 rounded-xl text-xs font-bold transition-all">
                Trade Simulated Assets
              </Link>
              <Link to="/trading" className="flex-1 bg-dark-700 hover:bg-dark-600 border border-dark-500 text-white text-center py-2.5 rounded-xl text-xs font-bold transition-all">
                Launch Trading Bot
              </Link>
            </div>
          )}
        </div>

        {/* Real-time Budget adjustments & Goal Forecasts */}
        <div className="bg-slate-800 border border-gray-700 rounded-3xl p-5 shadow-xl glass space-y-4">
          <div>
            <h3 className="text-white font-extrabold text-sm flex items-center gap-2 mb-3">
              <span>🎯</span> AI Budget Optimization & Goal Feasibility
            </h3>
            
            {/* Realtime budget tips */}
            {adjustments.length > 0 ? (
              <div className="bg-dark-900/40 border border-gray-700/50 rounded-2xl p-3 text-xs text-gray-300">
                <span className="text-amber-400 font-bold block mb-1">💡 Real-time Budget Tip:</span>
                <p className="leading-relaxed text-[11.5px]">{adjustments[0].message}</p>
              </div>
            ) : (
              <p className="text-gray-500 text-xs">No pending budget overruns. Your category limits look balanced!</p>
            )}
          </div>
          
          {/* Savings goals forecast summary */}
          {goalPredictions.length > 0 && (
            <div className="border-t border-gray-700 pt-3">
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Savings Goals Trajectory</div>
              <div className="space-y-2">
                {goalPredictions.slice(0, 2).map((pred, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-gray-300 font-medium">{pred.goal_name}:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${pred.on_track ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {pred.on_track ? 'On Track' : 'Behind Schedule'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total Balance', value:'Rs.'+Math.round(data?.total_balance||0).toLocaleString(), color:'text-blue-400', icon:'🏦', sub:'All accounts' },
          { label:'Total Income', value:'Rs.'+Math.round(totalIncome).toLocaleString(), color:'text-green-400', icon:'💰', sub:'All time earnings' },
          { label:'Total Spent', value:'Rs.'+Math.round(totalSpent).toLocaleString(), color:'text-red-400', icon:'💸', sub:'All time spending' },
          { label:'Total Savings', value:'Rs.'+Math.round(Math.abs(totalSavings)).toLocaleString(), color:totalSavings>=0?'text-emerald-400':'text-orange-400', icon:'🏦', sub:totalSavings>=0?'Net saved':'Overspent' },
        ].map((c,i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{c.label}</span>
              <span className="text-xl">{c.icon}</span>
            </div>
            <div className={"text-2xl font-bold "+c.color}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Monthly Income', value:'Rs.'+Math.round(data?.monthly_income||0).toLocaleString(), color:'text-green-400', icon:'📈' },
          { label:'Monthly Spent', value:'Rs.'+Math.round(data?.monthly_spent||0).toLocaleString(), color:'text-red-400', icon:'📉' },
          { label:'Monthly Savings', value:'Rs.'+Math.round(data?.monthly_savings||0).toLocaleString(), color:'text-blue-400', icon:'💎' },
          { label:'Active Goals', value:(data?.goals_count||0)+' goals', color:'text-purple-400', icon:'🎯', sub:'Rs.'+Math.round(data?.total_goal_saved||0).toLocaleString()+' saved' },
        ].map((c,i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">{c.label}</span>
              <span className="text-xl">{c.icon}</span>
            </div>
            <div className={"text-xl font-bold "+c.color}>{c.value}</div>
            {c.sub && <div className="text-xs text-gray-500 mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-extrabold text-sm flex items-center gap-2">
                <span>⏰</span> Upcoming Bills (Next 3 Days)
              </h3>
              <Link to="/transactions" className="text-xs text-indigo-400 hover:underline">Manage ➔</Link>
            </div>
            {upcomingBills.length > 0 ? (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {upcomingBills.map((b) => (
                  <div key={b.id} className="bg-gray-700/30 border border-gray-600/40 rounded-2xl p-3 flex justify-between items-center">
                    <div>
                      <div className="text-white text-xs font-bold">{b.merchant}</div>
                      <div className="text-gray-400 text-[10px] mt-0.5">
                        {b.category} • Due {new Date(b.next_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-rose-400 font-extrabold text-sm">₹{Math.round(b.amount).toLocaleString()}</div>
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider">{b.frequency}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <span className="text-3xl block mb-2">🎉</span>
                <p className="text-gray-400 text-xs">No upcoming bills due in the next 3 days.</p>
              </div>
            )}
          </div>
        </div>

        {goals.length > 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-extrabold text-sm">Savings Goals</h3>
              <Link to="/goals" className="text-xs text-indigo-400 hover:underline">View all</Link>
            </div>
            <div className="grid grid-cols-1 gap-3 max-h-[220px] overflow-y-auto pr-1">
              {goals.slice(0, 3).map((g, i) => (
                <div key={i} className={"rounded-2xl p-3 border " + (g.is_completed ? "bg-green-500/10 border-green-500/30" : "bg-gray-700 border-gray-600")}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white text-xs font-semibold">{g.goal_name}</p>
                      <p className="text-gray-400 text-[10px] mt-0.5">Target: Rs.{Math.round(g.target_amount).toLocaleString()}</p>
                    </div>
                    {g.is_completed && <span className="text-green-400 text-[10px] font-bold">Done!</span>}
                  </div>
                  <div className="h-1.5 bg-gray-600 rounded-full mb-1">
                    <div className={"h-1.5 rounded-full " + (g.is_completed ? "bg-green-500" : "bg-indigo-500")} style={{ width: Math.min(100, g.percent) + '%' }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-indigo-400">Rs.{Math.round(g.current_amount).toLocaleString()} saved</span>
                    <span className="text-gray-500">{g.percent.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-3xl p-5 text-center py-12 shadow-xl">
            <span className="text-3xl block mb-2">🎯</span>
            <p className="text-gray-400 text-xs">Set savings goals to stay on track!</p>
            <Link to="/goals" className="mt-3 inline-block bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">Create Goal</Link>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Today's Usage</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-green-400 text-xs">Live</span>
            </div>
            <button onClick={fetchData} className="text-xs text-gray-400 hover:text-white bg-gray-700 px-2 py-1 rounded-lg">Refresh</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400">Spent Today</div>
            <div className="text-xl font-bold text-red-400 mt-1">Rs.{Math.round(todaySpent).toLocaleString()}</div>
            <div className="text-xs text-gray-500">{todayDebits.length} transactions</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400">Received Today</div>
            <div className="text-xl font-bold text-green-400 mt-1">Rs.{Math.round(todayIncome).toLocaleString()}</div>
            <div className="text-xs text-gray-500">{todayCredits.length} transactions</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400">Total Today</div>
            <div className="text-xl font-bold text-blue-400 mt-1">{todayTxns.length}</div>
            <div className="text-xs text-gray-500">transactions</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400">Top Category</div>
            <div className="text-sm font-bold text-yellow-400 mt-1">{todayCatData[0]?.name||'None'}</div>
            <div className="text-xs text-gray-500">{todayCatData[0]?'Rs.'+todayCatData[0].value.toLocaleString():'no spending'}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-gray-400 text-xs font-medium mb-2">Hourly Spending</h4>
            {hourlyData.every(h=>h.amount===0) ? (
              <div className="flex items-center justify-center h-28 text-gray-600 text-sm">No spending yet today</div>
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={hourlyData}>
                  <XAxis dataKey="hour" tick={{fill:'#6b7280',fontSize:9}} />
                  <YAxis tick={{fill:'#6b7280',fontSize:9}} />
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'none',borderRadius:'8px',color:'#fff',fontSize:'11px'}} formatter={v=>'Rs.'+v} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <h4 className="text-gray-400 text-xs font-medium mb-2">Today Categories</h4>
            {todayCatData.length===0 ? (
              <div className="flex items-center justify-center h-28 text-gray-600 text-sm">No spending yet today</div>
            ) : (
              <div className="space-y-2">
                {todayCatData.slice(0,4).map((c,i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:COLORS[i%COLORS.length]}} />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-300">{c.name}</span>
                        <span className="text-gray-400">Rs.{c.value.toLocaleString()}</span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full">
                        <div className="h-1 rounded-full" style={{width:(c.value/todayCatData[0].value*100)+'%',backgroundColor:COLORS[i%COLORS.length]}} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {todayTxns.length > 0 && (
          <div className="mt-4">
            <h4 className="text-gray-400 text-xs font-medium mb-2">Today Transactions</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {todayTxns.sort((a,b)=>new Date(b.timestamp||b.created_at)-new Date(a.timestamp||a.created_at)).map((t,i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{t.amount>0?'💰':'💸'}</span>
                    <div>
                      <p className="text-white text-xs font-medium">{t.merchant||'Unknown'}</p>
                      <p className="text-gray-500 text-xs">{t.category||'Others'} - {new Date(t.timestamp||t.created_at).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                  </div>
                  <span className={"text-sm font-bold "+(t.amount>0?"text-green-400":"text-red-400")}>{t.amount>0?'+':''}Rs.{Math.abs(t.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Last 7 Days</h3>
          {last7.every(d=>d.spent===0&&d.income===0) ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" tick={{fill:'#9ca3af',fontSize:11}} />
                <YAxis tick={{fill:'#9ca3af',fontSize:11}} />
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'none',borderRadius:'8px',color:'#fff'}} formatter={v=>'Rs.'+v.toLocaleString()} />
                <Bar dataKey="income" fill="#22c55e" radius={[4,4,0,0]} name="Income" />
                <Bar dataKey="spent" fill="#ef4444" radius={[4,4,0,0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Categories</h3>
          {catData.length===0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={false}>
                    {catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'none',borderRadius:'8px',color:'#fff'}} formatter={v=>'Rs.'+v.toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {catData.slice(0,4).map((c,i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor:COLORS[i%COLORS.length]}} /><span className="text-gray-300">{c.name}</span></div>
                    <span className="text-gray-400">Rs.{c.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={()=>setShowQuickAdd(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-center text-sm font-medium transition-colors">+ Quick Add</button>
        <Link to="/sms-import" className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-center text-sm font-medium transition-colors">Import SMS</Link>
        <Link to="/analytics" className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-center text-sm font-medium transition-colors">Analytics</Link>
        <Link to="/predictions" className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl text-center text-sm font-medium transition-colors">ML Predict</Link>
      </div>
    </div>
  )
}

