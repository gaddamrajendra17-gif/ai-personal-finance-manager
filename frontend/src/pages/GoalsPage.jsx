import { useEffect, useState } from 'react'
import api from '../services/api'

export default function GoalsPage() {
  const [activeTab, setActiveTab] = useState('manual')
  const [goals, setGoals] = useState([])
  const [strategies, setStrategies] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Manual Goal Form
  const [form, setForm] = useState({ goal_name: '', target_amount: '', monthly_contribution: '', deadline: '' })
  const [contributing, setContributing] = useState({})
  
  // Auto-Save Strategy Form
  const [stratForm, setStratForm] = useState({ plan_name: '', source_account_id: '', destination_goal_id: '', transfer_amount: '', frequency: 'monthly' })
  const [submittingStrat, setSubmittingStrat] = useState(false)
  const [transferLog, setTransferLog] = useState(null)

  const fetchAllData = async () => {
    try {
      const [gRes, sRes, rRes, aRes] = await Promise.all([
        api.get('/api/goals/'),
        api.get('/api/savings/strategies'),
        api.get('/api/savings/recommendations'),
        api.get('/api/accounts/')
      ])
      setGoals(gRes.data || [])
      setStrategies(sRes.data || [])
      setRecommendations(rRes.data || [])
      
      const parsedAccounts = aRes.data || []
      setAccounts(parsedAccounts)
      
      // Pre-select default values for strategy form
      if (parsedAccounts.length > 0 && gRes.data.length > 0) {
        setStratForm(prev => ({
          ...prev,
          source_account_id: parsedAccounts[0].id,
          destination_goal_id: gRes.data[0].id
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const handleAddGoal = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/goals/', {
        ...form,
        target_amount: parseFloat(form.target_amount),
        monthly_contribution: parseFloat(form.monthly_contribution) || 0,
        deadline: form.deadline || null,
      })
      setForm({ goal_name: '', target_amount: '', monthly_contribution: '', deadline: '' })
      fetchAllData()
    } catch (err) { alert(err.response?.data?.detail || 'Failed to create goal') }
  }

  const handleContribute = async (goalId) => {
    const amt = parseFloat(contributing[goalId] || 0)
    if (!amt) return
    try {
      await api.put(`/api/goals/${goalId}/contribute?amount=${amt}`)
      setContributing(c => ({...c, [goalId]: ''}))
      fetchAllData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddStrategy = async (e) => {
    e.preventDefault()
    setSubmittingStrat(true)
    try {
      await api.post('/api/savings/strategies', {
        plan_name: stratForm.plan_name,
        source_account_id: stratForm.source_account_id,
        destination_goal_id: stratForm.destination_goal_id,
        transfer_amount: parseFloat(stratForm.transfer_amount),
        frequency: stratForm.frequency
      })
      setStratForm({ plan_name: '', source_account_id: accounts[0]?.id || '', destination_goal_id: goals[0]?.id || '', transfer_amount: '', frequency: 'monthly' })
      alert('AI Automated Savings Strategy created!')
      fetchAllData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create strategy plan')
    } finally {
      setSubmittingStrat(false)
    }
  }

  const handleToggleStrategy = async (stratId) => {
    try {
      await api.post(`/api/savings/strategies/${stratId}/toggle`)
      fetchAllData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteStrategy = async (stratId) => {
    if (!window.confirm('Delete this automated savings strategy?')) return
    try {
      await api.delete(`/api/savings/strategies/${stratId}`)
      fetchAllData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleTriggerTransfers = async () => {
    try {
      const res = await api.post('/api/savings/strategies/trigger')
      setTransferLog(res.data)
      fetchAllData()
      setTimeout(() => setTransferLog(null), 10000)
    } catch (e) {
      alert('Failed to trigger simulated transfers')
    }
  }

  const handleApplyRecommendation = async (rec) => {
    try {
      if (rec.type === 'INCREASE_CONTRIBUTION' || rec.type === 'START_CONTRIBUTION') {
        await api.put(`/api/goals/${rec.goal_id}`, {
          monthly_contribution: parseFloat(rec.amount)
        })
        alert(`AI Recommended Monthly Contribution of ₹${rec.amount.toLocaleString()} applied to '${rec.goal_name}'!`)
        fetchAllData()
      } else if (rec.type === 'SURPLUS_SWEEP') {
        const acc = accounts[0]
        if (!acc) {
          alert('Please add a bank account first!')
          return
        }
        const confirmSweep = window.confirm(`Confirm AI Surplus Sweep: Transfer ₹${rec.amount.toLocaleString()} from your '${acc.bank_name}' checking account to savings goal '${rec.goal_name}'?`)
        if (!confirmSweep) return
        
        await api.post('/api/savings/sweep', {
          account_id: acc.id,
          goal_id: rec.goal_id,
          amount: rec.amount
        })
        alert(`₹${rec.amount.toLocaleString()} surplus successfully swept into '${rec.goal_name}'!`)
        fetchAllData()
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to apply AI recommendation')
    }
  }

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const GOAL_EMOJIS = ['🏠', '✈️', '🎓', '💍', '🚗', '💻', '🏋️', '🌴']

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400 gap-2">
        <div className="animate-spin text-3xl">🎯</div>
        <div>Loading savings center...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header and Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Savings Center</h1>
          <p className="text-gray-400 text-sm mt-1">Manage savings goals, configure automated transfers, and monitor cash-flow safety.</p>
        </div>
        
        {/* Tab Toggle buttons */}
        <div className="flex bg-dark-800 rounded-2xl p-1 border border-dark-600">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'manual' ? 'bg-primary text-dark-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            🎯 Manual Goals
          </button>
          <button
            onClick={() => setActiveTab('automated')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'automated' ? 'bg-primary text-dark-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            ⚡ AI Auto-Save
          </button>
        </div>
      </div>

      {activeTab === 'manual' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Add Goal */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass shadow-2xl">
            <h2 className="text-base font-bold text-white mb-4">Create New Goal</h2>
            <form onSubmit={handleAddGoal} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1 block">Goal Name</label>
                <input value={form.goal_name} onChange={e => setForm(f => ({...f, goal_name: e.target.value}))}
                  required placeholder="Vacation to Goa" className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1 block">Target Amount (₹)</label>
                <input type="number" value={form.target_amount} onChange={e => setForm(f => ({...f, target_amount: e.target.value}))}
                  required placeholder="50000" className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1 block">Monthly Contribution (₹)</label>
                <input type="number" value={form.monthly_contribution} onChange={e => setForm(f => ({...f, monthly_contribution: e.target.value}))}
                  placeholder="5000" className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1 block">Target Date (optional)</label>
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))}
                  className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
              </div>
              <div className="md:col-span-2 pt-2">
                <button type="submit" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md">
                  Create Goal 🎯
                </button>
              </div>
            </form>
          </div>

          {/* Goals Grid */}
          {goals.length === 0 ? (
            <div className="bg-dark-800 border border-dark-500 rounded-3xl p-12 text-center glass text-gray-500 text-sm">
              No savings goals yet. Create your first goal to begin tracking!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {goals.map((goal, i) => {
                const pct = goal.progress_percent || 0
                const remaining = goal.target_amount - goal.current_amount
                const monthsLeft = goal.monthly_contribution > 0 ? Math.ceil(remaining / goal.monthly_contribution) : null

                return (
                  <div key={goal.id} className={`bg-dark-800 border rounded-3xl p-5 glass flex flex-col justify-between hover:border-primary/20 transition-all ${goal.is_completed ? 'border-green-500/25' : 'border-dark-500'}`}>
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{GOAL_EMOJIS[i % GOAL_EMOJIS.length]}</span>
                          <span className="text-sm font-bold text-white">{goal.goal_name}</span>
                        </div>
                        {goal.is_completed && (
                          <span className="text-[10px] font-extrabold bg-green-500/10 text-green-400 border border-green-500/20 rounded-full px-2 py-0.5">COMPLETED</span>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-[11px] text-gray-500 mb-1.5 font-medium">
                          <span>{fmt(goal.current_amount)} saved</span>
                          <span>{fmt(goal.target_amount)} target</span>
                        </div>
                        <div className="h-2 bg-dark-900 rounded-full overflow-hidden border border-dark-600">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pct, 100)}%`, background: goal.is_completed ? '#10B981' : 'linear-gradient(90deg, #00D4FF, #7C3AED)' }}
                          />
                        </div>
                        <div className="text-right text-xs text-primary font-extrabold mt-1">{pct}%</div>
                      </div>
                    </div>

                    <div>
                      {monthsLeft && !goal.is_completed && (
                        <div className="text-[10px] text-gray-500 mb-3 bg-dark-900/60 p-2 rounded-xl border border-dark-600 text-center font-medium">
                          ⌛ ~{monthsLeft} months to go • {fmt(goal.monthly_contribution)}/month
                        </div>
                      )}

                      {!goal.is_completed && (
                        <div className="flex gap-2">
                          <input type="number" value={contributing[goal.id] || ''} onChange={e => setContributing(c => ({...c, [goal.id]: e.target.value}))}
                            placeholder="Add ₹" className="flex-1 bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary" />
                          <button onClick={() => handleContribute(goal.id)} className="bg-primary text-dark-900 font-bold px-3.5 py-2 rounded-xl text-xs hover:opacity-90">+</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        // Tab 2: Automated Savings Strategies
        <div className="space-y-6 animate-fade-in">
          
          {/* Transfer Execution Log feedback */}
          {transferLog && (
            <div className="bg-indigo-950/60 border border-primary/30 rounded-3xl p-5 text-xs text-gray-300 space-y-2.5">
              <span className="text-primary font-bold text-sm block">⚡ AI Savings Transfers Executed:</span>
              <div className="space-y-1">
                {transferLog.executed.map((t, i) => (
                  <div key={i} className="text-emerald-400 font-medium">
                    ✓ Transferred ₹{t.amount.toLocaleString()} from account for plan '{t.plan_name}' to '{t.goal_name}'.
                  </div>
                ))}
                {transferLog.paused.map((t, i) => (
                  <div key={i} className="text-amber-400 font-medium">
                    ⏸️ Paused transfer '{t.plan_name}': {t.reason}
                  </div>
                ))}
                {transferLog.executed.length === 0 && transferLog.paused.length === 0 && (
                  <div className="text-gray-500">No active strategies available for transfer.</div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Create strategy form */}
            <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 space-y-4">
              <h2 className="text-base font-bold text-white">Setup AI Auto-Save Strategy</h2>
              {goals.length === 0 || accounts.length === 0 ? (
                <p className="text-xs text-gray-500">Please link a bank account and create at least one savings goal first to configure Auto-Saving.</p>
              ) : (
                <form onSubmit={handleAddStrategy} className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Plan Name</label>
                    <input 
                      type="text" 
                      value={stratForm.plan_name} 
                      onChange={e => setStratForm({...stratForm, plan_name: e.target.value})} 
                      required 
                      placeholder="e.g. Monthly Home Deposit" 
                      className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Source Account (Debit)</label>
                    <select 
                      value={stratForm.source_account_id} 
                      onChange={e => setStratForm({...stratForm, source_account_id: e.target.value})} 
                      className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-primary"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.bank_name} (₹{Math.round(a.balance).toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Destination Goal (Credit)</label>
                    <select 
                      value={stratForm.destination_goal_id} 
                      onChange={e => setStratForm({...stratForm, destination_goal_id: e.target.value})} 
                      className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-primary"
                    >
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>{g.goal_name} (₹{Math.round(g.current_amount).toLocaleString()})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Transfer Amount (₹)</label>
                    <input 
                      type="number" 
                      value={stratForm.transfer_amount} 
                      onChange={e => setStratForm({...stratForm, transfer_amount: e.target.value})} 
                      required 
                      placeholder="3000" 
                      min="100" 
                      className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Frequency</label>
                    <select 
                      value={stratForm.frequency} 
                      onChange={e => setStratForm({...stratForm, frequency: e.target.value})} 
                      className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none"
                    >
                      <option value="daily">Daily Auto-Save</option>
                      <option value="weekly">Weekly Auto-Save</option>
                      <option value="monthly">Monthly Auto-Save</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    disabled={submittingStrat}
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md"
                  >
                    Activate Strategy ⚡
                  </button>
                </form>
              )}
            </div>

            {/* Strategies List and Recommendations */}
            <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-6 flex flex-col justify-between min-h-[460px]">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-white">Active Auto-Save Strategies</h3>
                  {strategies.length > 0 && (
                    <button 
                      onClick={handleTriggerTransfers}
                      className="bg-dark-700 hover:bg-dark-600 border border-dark-500 text-primary font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                    >
                      ⚡ Trigger Simulated Transfers
                    </button>
                  )}
                </div>

                {strategies.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-xs">No active automated savings strategies. Configure one on the left.</div>
                ) : (
                  <div className="space-y-3">
                    {strategies.map(s => (
                      <div key={s.id} className="bg-dark-900/60 border border-dark-600 rounded-2xl p-4 flex justify-between items-center hover:border-primary/20 transition-all">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{s.plan_name}</span>
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${
                              s.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-600'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Debit: <span className="text-gray-300 font-semibold">{s.source_account}</span> ➔ Credit: <span className="text-gray-300 font-semibold">{s.destination_goal}</span></p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-extrabold text-primary">{fmt(s.transfer_amount)}</div>
                            <span className="text-[9px] uppercase text-gray-500 font-semibold">{s.frequency}</span>
                          </div>
                          
                          <button 
                            onClick={() => handleToggleStrategy(s.id)}
                            className="bg-dark-700 hover:bg-dark-600 px-2.5 py-1.5 rounded-lg text-xs"
                            title="Pause/Run Strategy"
                          >
                            {s.status === 'ACTIVE' ? '⏸️' : '▶️'}
                          </button>
                          <button 
                            onClick={() => handleDeleteStrategy(s.id)}
                            className="text-rose-500 hover:text-rose-450 hover:bg-rose-500/10 px-2 py-1.5 rounded-lg text-xs"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cash Flow recommendations */}
              <div className="border-t border-dark-700 pt-4 space-y-3">
                <h4 className="text-xs text-gray-400 font-bold uppercase tracking-wider">AI Cash Flow & Goal Recommendations</h4>
                <div className="space-y-2">
                  {recommendations.map((rec, idx) => {
                    const isActionable = ['INCREASE_CONTRIBUTION', 'START_CONTRIBUTION', 'SURPLUS_SWEEP'].includes(rec.type);
                    return (
                      <div key={idx} className="bg-dark-900/40 p-3.5 rounded-2xl border border-primary/10 flex flex-col gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="text-sm mt-0.5">🤖</span>
                          <p className="text-[11px] text-gray-400 leading-relaxed">{rec.message}</p>
                        </div>
                        {isActionable && (
                          <div className="flex justify-end pl-6">
                            <button
                              onClick={() => handleApplyRecommendation(rec)}
                              className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide uppercase transition-all cursor-pointer"
                            >
                              {rec.type === 'SURPLUS_SWEEP' ? '⚡ Apply Sweep' : '⚙️ Adjust contribution'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  )
}
