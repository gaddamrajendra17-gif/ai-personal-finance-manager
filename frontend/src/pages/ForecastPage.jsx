import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../services/api'

export default function ForecastPage() {
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/forecast/?periods=30').then(r => { setForecast(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Expense Forecast</h1>
        <p className="text-sm text-gray-500">AI-powered prediction using Facebook Prophet</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-20 animate-pulse">Running forecast model...</div>
      ) : !forecast || forecast.status === 'insufficient_data' ? (
        <div className="bg-dark-700 border border-dark-500 rounded-xl p-8 text-center max-w-md mx-auto space-y-4">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-white font-semibold">Not enough data to run Prophet</div>
          <p className="text-gray-400 text-sm">
            Facebook Prophet requires at least 14 distinct days of historical transaction data to model seasonality and calculate daily forecast averages.
          </p>
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
                  api.get('/api/forecast/?periods=30').then(r => { setForecast(r.data); setLoading(false) }).catch(() => setLoading(false))
                }, 1500)
              } catch (e) {
                alert('Failed to auto-seed account.')
                setLoading(false)
              }
            }}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg cursor-pointer"
          >
            ⚡ Auto-Seed Simulated Account & Feed 90d History
          </button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Next 30 Days</div>
              <div className="text-2xl font-bold text-primary">{fmt(forecast.next_month_forecast)}</div>
              <div className="text-xs text-gray-500 mt-1">Predicted total spend</div>
            </div>
            <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Daily Average</div>
              <div className="text-2xl font-bold text-accent">{fmt(forecast.daily_avg)}</div>
              <div className="text-xs text-gray-500 mt-1">Per day forecast</div>
            </div>
            <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Model</div>
              <div className="text-2xl font-bold text-green-400">{forecast.model}</div>
              <div className="text-xs text-gray-500 mt-1">Algorithm used</div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-5">30-Day Forecast with Confidence Interval</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={forecast.daily_forecast}>
                <defs>
                  <linearGradient id="upper" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="predicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#555' }} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  formatter={(v, name) => [fmt(v), name.replace('_', ' ')]}
                  contentStyle={{ background: '#0e0e18', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="upper" stroke="#7C3AED" strokeWidth={1} strokeDasharray="4 4" fill="url(#upper)" name="upper_bound" />
                <Area type="monotone" dataKey="predicted" stroke="#00D4FF" strokeWidth={2} fill="url(#predicted)" name="Prophet Predicted" />
                <Area type="monotone" dataKey="predicted_lstm" stroke="#ec4899" strokeWidth={2} fill="none" name="LSTM Predicted" />
                <Area type="monotone" dataKey="lower" stroke="#10B981" strokeWidth={1} strokeDasharray="4 4" fill="none" name="lower_bound" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs text-gray-500 justify-center">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#00D4FF] inline-block" /> Prophet Forecast</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#ec4899] inline-block" /> LSTM Forecast</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#7C3AED] inline-block border-dashed" /> Upper bound</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[#10B981] inline-block border-dashed" /> Lower bound</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-dark-700 border border-dark-500 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Daily Forecast Breakdown</h2>
            <div className="grid grid-cols-7 gap-2 max-h-60 overflow-y-auto">
              {forecast.daily_forecast.map(d => (
                <div key={d.date} className="bg-dark-600 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">{new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  <div className="text-xs font-semibold text-primary mt-1">{fmt(d.predicted)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

