import { useState, useEffect } from 'react'
import api from '../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts'

const COLORS = ['#00D4FF', '#7C3AED', '#F59E0B', '#10B981']

export default function RoboAdvisorPage() {
  const [profile, setProfile] = useState(null)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({
    age: 28,
    horizon: 5,
    market_reaction: 'hold',
    monthly_investment_target: 10000,
    financial_goal: 'General Wealth Building'
  })

  const fetchProfileAndPlan = async () => {
    setLoading(true)
    try {
      const pRes = await api.get('/api/robo-advisor/profile')
      if (pRes.data && pRes.data.configured) {
        setProfile(pRes.data)
        const plRes = await api.get('/api/robo-advisor/plan')
        setPlan(plRes.data)
      } else {
        setProfile(null)
        setPlan(null)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfileAndPlan()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/api/robo-advisor/profile', answers)
      await fetchProfileAndPlan()
    } catch (err) {
      alert('Error saving profile: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset your risk profile and retake the questionnaire?')) {
      setProfile(null)
      setPlan(null)
      setStep(1)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400 gap-2">
        <div className="animate-spin text-3xl">🤖</div>
        <div>Loading your Robo-Advisor portal...</div>
      </div>
    )
  }

  // Render Questionnaire
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto p-6 my-10">
        <div className="text-center mb-8">
          <span className="text-4xl">🤖</span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-3">AI Robo-Advisor</h1>
          <p className="text-gray-400 text-sm mt-1">Discover your risk profile and let AI formulate a personalized wealth building strategy.</p>
        </div>

        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-8 glass shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-primary to-accent transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-2">Step 1: Financial Demographics</h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What is your age?</label>
                  <input 
                    type="number" 
                    value={answers.age} 
                    onChange={e => setAnswers({...answers, age: parseInt(e.target.value) || 0})}
                    className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all"
                    placeholder="Enter your age"
                    min="18"
                    max="100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Primary Investment Goal</label>
                  <select 
                    value={answers.financial_goal} 
                    onChange={e => setAnswers({...answers, financial_goal: e.target.value})}
                    className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all"
                  >
                    <option value="General Wealth Building">General Wealth Building</option>
                    <option value="Retirement Corpus">Retirement Corpus Planning</option>
                    <option value="Home Purchase Downpayment">Buying a Home / Asset Purchase</option>
                    <option value="Higher Education Fund">Higher Education Planning</option>
                  </select>
                </div>
                <div className="pt-4">
                  <button 
                    type="button" 
                    onClick={() => setStep(2)} 
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    Next Step ➔
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-2">Step 2: Horizon & Targets</h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Investment Horizon (Years)</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={answers.horizon} 
                    onChange={e => setAnswers({...answers, horizon: parseInt(e.target.value)})}
                    className="w-full h-1 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 year (Short)</span>
                    <span className="text-primary font-bold text-sm">{answers.horizon} years</span>
                    <span>20 years (Long)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Monthly Investment Goal (Rs.)</label>
                  <input 
                    type="number" 
                    value={answers.monthly_investment_target} 
                    onChange={e => setAnswers({...answers, monthly_investment_target: parseFloat(e.target.value) || 0})}
                    className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all"
                    placeholder="e.g. 5000"
                    min="500"
                    required
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="w-1/3 bg-dark-600 hover:bg-dark-500 text-gray-300 py-3 rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setStep(3)} 
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    Next Step ➔
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-xl font-bold text-white mb-2">Step 3: Risk Tolerance</h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">If the stock market crashes by 20%, what would you do?</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-600 hover:border-primary bg-dark-750 cursor-pointer transition-all">
                      <input 
                        type="radio" 
                        name="market_reaction" 
                        value="sell_all" 
                        checked={answers.market_reaction === 'sell_all'}
                        onChange={() => setAnswers({...answers, market_reaction: 'sell_all'})}
                        className="accent-primary" 
                      />
                      <div>
                        <div className="text-sm font-bold text-white">Sell everything immediately</div>
                        <div className="text-xs text-gray-500 mt-0.5">Protect remaining capital, minimize risk.</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-600 hover:border-primary bg-dark-750 cursor-pointer transition-all">
                      <input 
                        type="radio" 
                        name="market_reaction" 
                        value="hold" 
                        checked={answers.market_reaction === 'hold'}
                        onChange={() => setAnswers({...answers, market_reaction: 'hold'})}
                        className="accent-primary" 
                      />
                      <div>
                        <div className="text-sm font-bold text-white">Hold and wait for recovery</div>
                        <div className="text-xs text-gray-500 mt-0.5">Understand volatility, keep long term plan.</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-dark-600 hover:border-primary bg-dark-750 cursor-pointer transition-all">
                      <input 
                        type="radio" 
                        name="market_reaction" 
                        value="buy_more" 
                        checked={answers.market_reaction === 'buy_more'}
                        onChange={() => setAnswers({...answers, market_reaction: 'buy_more'})}
                        className="accent-primary" 
                      />
                      <div>
                        <div className="text-sm font-bold text-white">Buy more at a discount</div>
                        <div className="text-xs text-gray-500 mt-0.5">Opportunistic stance, highly aggressive.</div>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setStep(2)} 
                    className="w-1/3 bg-dark-600 hover:bg-dark-500 text-gray-300 py-3 rounded-xl transition-all"
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-55"
                  >
                    {submitting ? 'Generating Portfolio...' : 'Submit & Analyze 🤖'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    )
  }

  // Transform allocation mix to chart data
  const pieData = Object.entries(plan.allocation).map(([k, v]) => ({
    name: k,
    value: v
  }))

  const projectedData = plan.projected_growth.map(p => ({
    name: `${p.years}Y`,
    Invested: p.total_invested,
    Growth: p.projected_value
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header Dashboard Profile Card */}
      <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl shadow-lg">🤖</div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">AI Wealth Allocation</h1>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                profile.risk_tolerance === 'AGGRESSIVE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                profile.risk_tolerance === 'MODERATE' ? 'bg-primary/10 text-primary border-primary/20' :
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {profile.risk_tolerance}
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-1">Risk Score: <span className="text-primary font-bold">{profile.risk_score}/100</span> • Goal: <span className="text-gray-300 font-medium">{profile.financial_goal}</span></p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-500 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            🖨️ Export PDF Plan
          </button>
          <button 
            onClick={handleReset}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-rose-500/20"
          >
            🔄 Retake Quiz
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recommended Allocation (Pie chart) */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-1">Recommended Allocation</h3>
          <p className="text-gray-400 text-xs mb-4">Diversified mix matching risk profile</p>
          
          <div className="h-64 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0e0e18', borderColor: '#1e1e2e', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend formatter={(value, entry) => <span className="text-xs text-gray-400 font-medium">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Breakdown details */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white mb-2">Recommended Assets</h3>
          <div className="space-y-3">
            {plan.recommended_assets.map((asset, index) => (
              <div key={asset.symbol} className="bg-dark-900/60 border border-dark-500 rounded-2xl p-4 flex items-center justify-between hover:border-primary/20 transition-all">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2.5 h-10 rounded" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{asset.symbol}</span>
                      <span className="text-xs text-gray-500">{asset.name}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-md">{asset.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-primary">{asset.weight}</div>
                  <span className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">{asset.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Projected Wealth Growth Calculator */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">Compound Growth Estimate</h3>
            <p className="text-gray-400 text-xs mt-0.5">Projected growth based on ₹{plan.profile.monthly_investment_target.toLocaleString()}/month at average {plan.rate_of_return_pct}% return</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#4b5563" fontSize={11} tickLine={false} />
                <YAxis stroke="#4b5563" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0e0e18', borderColor: '#1e1e2e', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="Growth" stroke="#00D4FF" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGrowth)" name="Projected Value" />
                <Area type="monotone" dataKey="Invested" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#colorInvested)" name="Total Contributed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {plan.projected_growth.map(p => (
              <div key={p.years} className="bg-dark-900/60 p-3 rounded-2xl border border-dark-500 text-center">
                <div className="text-xs text-gray-500 font-semibold">{p.years} Year{p.years > 1 ? 's' : ''}</div>
                <div className="text-base font-bold text-white mt-1">₹{Math.round(p.projected_value).toLocaleString()}</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">+₹{Math.round(p.earnings).toLocaleString()} gains</div>
              </div>
            ))}
          </div>
        </div>

        {/* Personalized Recommendations & 50/30/20 guideline */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">AI Savings Tips</h3>
            <p className="text-gray-400 text-xs mb-4">Actionable insights from transaction analysis</p>

            <div className="space-y-3.5">
              {plan.personalized_tips.map((tip, idx) => (
                <div key={idx} className="bg-dark-900/40 border border-amber-500/10 rounded-2xl p-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.02] rounded-full blur-xl pointer-events-none"></div>
                  <div className="flex gap-2">
                    <span className="text-sm">💡</span>
                    <div>
                      <div className="text-xs font-bold text-amber-400">{tip.title}</div>
                      <p className="text-gray-400 text-[11px] mt-1.5 leading-relaxed">{tip.message}</p>
                      {tip.savings_potential > 0 && (
                        <div className="text-[10px] text-emerald-400 font-bold mt-2">Potential Saving: ₹{tip.savings_potential.toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-dark-900/60 rounded-2xl p-4 border border-dark-500 mt-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">50/30/20 Budget Guidelines</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Needs (50%)</span>
                <span className="text-white font-semibold">₹{plan.rule_50_30_20.needs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Wants (30%)</span>
                <span className="text-white font-semibold">₹{plan.rule_50_30_20.wants.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-primary font-semibold">Savings (20%)</span>
                <span className="text-primary font-bold">₹{plan.rule_50_30_20.savings.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
