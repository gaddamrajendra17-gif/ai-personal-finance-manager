import { useEffect, useState } from 'react'
import api from '../services/api'

const CATEGORIES = ['Food & Dining','Rent','Transport','Entertainment','Health & Medical','Utilities','Shopping','EMI & Loans','Education','Travel','Investments','Other']

export default function BudgetPage() {
  const [budgets, setBudgets] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [simulation, setSimulation] = useState(null)
  const [form, setForm] = useState({ category: 'Food & Dining', limit_amount: '' })
  const [simForm, setSimForm] = useState({ current_savings: '', monthly_extra: '', goal: '' })

  useEffect(() => {
    api.get('/api/budgets/').then(r => setBudgets(r.data)).catch(() => {})
    api.get('/api/budgets/recommend').then(r => setRecommendations(r.data)).catch(() => {})
  }, [])

  const handleAddBudget = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/budgets/', { ...form, limit_amount: parseFloat(form.limit_amount) })
      const res = await api.get('/api/budgets/')
      setBudgets(res.data)
      setForm({ category: 'Food & Dining', limit_amount: '' })
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed')
    }
  }

  const handleSimulate = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/api/budgets/simulate', {
        current_savings: parseFloat(simForm.current_savings),
        monthly_extra: parseFloat(simForm.monthly_extra),
        goal: parseFloat(simForm.goal),
      })
      setSimulation(res.data)
    } catch {}
  }

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Budgets</h1>
        <p className="text-sm text-gray-500">Set and track your monthly spending limits</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Budget */}
        <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Set Budget</h2>
          <form onSubmit={handleAddBudget} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                className="w-full bg-dark-800 border border-dark-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Monthly Limit (₹)</label>
              <input type="number" value={form.limit_amount} onChange={e => setForm(f => ({...f, limit_amount: e.target.value}))}
                required placeholder="5000" className="w-full bg-dark-800 border border-dark-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
            </div>
            <button type="submit" className="w-full bg-primary text-dark-900 font-bold py-2 rounded-lg text-sm hover:opacity-90">
              Set Budget
            </button>
          </form>
        </div>

        {/* AI Recommendations */}
        <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">🤖 AI Recommendations <span className="text-xs text-gray-500 font-normal">(50/30/20 Rule)</span></h2>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {recommendations.map(r => (
              <div key={r.category} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
                <span className="text-sm text-gray-300">{r.category}</span>
                <span className="text-sm font-semibold text-primary">{fmt(r.recommended)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Budgets */}
      {budgets.length > 0 && (
        <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Current Month Budgets</h2>
          <div className="space-y-4">
            {budgets.map(b => {
              const pct = b.limit_amount ? Math.min((b.spent_amount / b.limit_amount) * 100, 100) : 0
              const color = pct > 100 ? '#EF4444' : pct > 85 ? '#F59E0B' : '#10B981'
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-300 font-medium">{b.category}</span>
                    <span style={{ color }}>{fmt(b.spent_amount)} / {fmt(b.limit_amount)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-dark-500 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Savings Simulator */}
      <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-1">💡 Savings Goal Simulator</h2>
        <p className="text-xs text-gray-500 mb-4">How long until you reach your savings goal?</p>
        <form onSubmit={handleSimulate} className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Current Savings (₹)</label>
            <input type="number" value={simForm.current_savings} onChange={e => setSimForm(f => ({...f, current_savings: e.target.value}))}
              required placeholder="10000" className="w-full bg-dark-800 border border-dark-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Monthly Extra (₹)</label>
            <input type="number" value={simForm.monthly_extra} onChange={e => setSimForm(f => ({...f, monthly_extra: e.target.value}))}
              required placeholder="2000" className="w-full bg-dark-800 border border-dark-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Goal (₹)</label>
            <input type="number" value={simForm.goal} onChange={e => setSimForm(f => ({...f, goal: e.target.value}))}
              required placeholder="100000" className="w-full bg-dark-800 border border-dark-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
          </div>
          <div className="col-span-3">
            <button type="submit" className="bg-accent text-white font-bold px-6 py-2 rounded-lg text-sm hover:opacity-90">Simulate →</button>
          </div>
        </form>
        {simulation && (
          <div className="mt-4 bg-accent/10 border border-accent/30 rounded-xl p-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500">Time to Goal</div>
              <div className="text-xl font-bold text-accent">{simulation.months_to_goal} months</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Target Date</div>
              <div className="text-xl font-bold text-white">{simulation.target_date}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Amount to Save</div>
              <div className="text-lg font-semibold text-white">{fmt(simulation.total_to_save)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Monthly Required</div>
              <div className="text-lg font-semibold text-primary">{fmt(simulation.monthly_required)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
