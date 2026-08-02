import { useState, useEffect } from 'react'
import api from '../services/api'

export default function FinancialAdvisorPage() {
  const [profile, setProfile] = useState(null)
  const [advisory, setAdvisory] = useState(null)
  const [persona, setPersona] = useState('balanced')
  const [loading, setLoading] = useState(true)
  const [fetchingAdvice, setFetchingAdvice] = useState(false)

  const fetchBehaviorAndAdvice = async () => {
    try {
      const pRes = await api.get('/api/financial-advisor/behavior')
      setProfile(pRes.data)
      
      setFetchingAdvice(true)
      const aRes = await api.get(`/api/financial-advisor/advice?persona=${persona}`)
      setAdvisory(aRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setFetchingAdvice(false)
    }
  }

  useEffect(() => {
    fetchBehaviorAndAdvice()
  }, [persona])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400 gap-2">
        <div className="animate-spin text-3xl">🧠</div>
        <div>Consulting your AI Financial Advisor...</div>
      </div>
    )
  }

  const getBehaviorBadge = (classification) => {
    switch (classification) {
      case 'FRUGAL_SAVER':
        return { text: 'Frugal Saver', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
      case 'IMPULSIVE':
        return { text: 'Impulsive Spender', style: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
      case 'LIFESTYLE_INFLATED':
        return { text: 'Lifestyle Inflator', style: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
      default:
        return { text: 'Balanced Planner', style: 'bg-primary/10 text-primary border-primary/20' }
    }
  }

  const badge = getBehaviorBadge(profile.classification)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">AI Financial Advisor</h1>
        <p className="text-gray-400 text-sm mt-1">Personalized wealth-building coaching, behavioral analysis, and continuous risk monitoring.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Behavioral Scorecard & Persona Selector */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">Your Spending Persona</h3>
              <p className="text-gray-400 text-xs mt-0.5">Determined by monthly transaction audits</p>
            </div>

            {/* Scorecard circular display */}
            <div className="flex flex-col items-center justify-center py-4 relative">
              <div className="w-32 h-32 rounded-full border-4 border-dark-600 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-accent/10 opacity-30"></div>
                <span className="text-3xl font-black text-white">{advisory.health_score}</span>
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">Health Score</span>
              </div>
              <span className={`mt-4 text-xs font-extrabold px-3 py-1 rounded-full border ${badge.style}`}>
                {badge.text}
              </span>
            </div>

            {/* Coach Selection */}
            <div className="space-y-2.5">
              <label className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Advisor Persona</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'balanced', label: 'Balanced', icon: '⚖️' },
                  { id: 'frugal', label: 'Strict', icon: '🔒' },
                  { id: 'goal_focused', label: 'Goal Coach', icon: '🎯' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPersona(p.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                      persona === p.id 
                        ? 'bg-primary/10 border-primary text-white font-bold' 
                        : 'bg-dark-900/40 border-dark-600 text-gray-400 hover:text-white hover:border-dark-400'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="text-[10px]">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-500 text-[10px] text-gray-500 leading-relaxed">
            🧠 *Persona Selected: {advisory.advisor_name}.* {advisory.description}
          </div>
        </div>

        {/* Personalized Recommendations Advice Card */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-5 flex flex-col justify-between min-h-[420px]">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-bold text-white">Interactive Recommendations</h3>
              {fetchingAdvice && <span className="animate-spin text-xs">⏳</span>}
            </div>
            <p className="text-gray-400 text-xs mb-4">Customized guidance matched to your chosen advisor</p>
            
            <div className="space-y-3.5">
              {advisory.recommendations.map((rec, idx) => (
                <div key={idx} className="bg-dark-900/50 border border-dark-500 rounded-2xl p-4 flex gap-3 hover:border-primary/20 transition-all">
                  <span className="text-lg mt-0.5">📌</span>
                  <p className="text-gray-300 text-xs leading-relaxed font-medium">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <div className="text-xs font-bold text-white">Daily Spending Velocity</div>
                <p className="text-[10px] text-gray-400 mt-0.5">Average velocity: ₹{profile.metrics.daily_velocity.toLocaleString()}/day this month.</p>
              </div>
            </div>
            <span className="text-sm font-black text-primary">₹{profile.metrics.daily_velocity}/day</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Continuous Monitoring Feed */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass space-y-4">
          <div>
            <h3 className="text-base font-bold text-white">Continuous Spending Monitor</h3>
            <p className="text-gray-400 text-xs mt-0.5">Live tracking for unusual behaviors and drift</p>
          </div>

          <div className="space-y-3">
            {advisory.monitoring_alerts.map((alert, idx) => (
              <div 
                key={idx} 
                className={`border rounded-2xl p-4 flex items-start gap-3 transition-all ${
                  alert.severity === 'HIGH' ? 'bg-rose-500/10 border-rose-500/25 text-rose-400' :
                  alert.severity === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' :
                  'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                }`}
              >
                <span className="text-lg mt-0.5">{alert.severity === 'HIGH' ? '🚨' : (alert.severity === 'MEDIUM' ? '⚠️' : '✅')}</span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">{alert.severity} Risk Warning</div>
                  <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Projection Card */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass space-y-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Personalized Wealth Compounder</h3>
            <p className="text-gray-400 text-xs mt-0.5">The compound benefits of optimized financial recommendations</p>
          </div>

          <div className="bg-dark-900/60 rounded-2xl p-5 border border-dark-500 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Monthly Optimizable Surplus</span>
              <span className="text-white font-bold">₹{profile.benefits_projection.monthly_optimizable.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Interest/Yield Assumed</span>
              <span className="text-emerald-400 font-bold">{profile.benefits_projection.estimated_yield}</span>
            </div>
            <div className="border-t border-dark-700 pt-3 flex justify-between items-baseline">
              <span className="text-gray-300 text-xs font-bold">Projected 5-Year Net Growth</span>
              <span className="text-xl font-black text-primary bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ₹{Math.round(profile.benefits_projection.compounded_five_years).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 leading-relaxed italic text-center">
            "Small optimization tweaks of ₹{profile.benefits_projection.monthly_optimizable.toLocaleString()}/month compounded at {profile.benefits_projection.estimated_yield} creates significant compound asset gains."
          </div>
        </div>
      </div>
      
    </div>
  )
}
