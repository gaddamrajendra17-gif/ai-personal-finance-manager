import { useState, useEffect } from 'react'
import axios from 'axios'
import useAuthStore from '../store/authStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const API = 'http://localhost:8000'
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

export default function PredictionsPage() {
  const { token } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const headers = { Authorization: 'Bearer ' + token }

  useEffect(() => {
    axios.get(API + '/api/predict/next-month', { headers })
      .then(r => setData(r.data))
      .catch(e => setError('Failed to load predictions'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">Analyzing your spending patterns...</div>
  if (error) return <div className="p-6 text-red-400">{error}</div>
  if (data?.status === 'insufficient_data') return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="bg-dark-800 border border-dark-500 rounded-3xl p-8 text-center space-y-4">
        <div className="text-5xl mb-2">📊</div>
        <h2 className="text-white font-bold text-xl">Insufficient Data for ML Predictions</h2>
        <p className="text-gray-400 text-sm">
          Scikit-Learn Linear Regression model requires at least 2 full months of historical transactions to compute trends, regression fits, and confidence scores.
        </p>
        <button
          onClick={async () => {
            setLoading(true)
            try {
              const bankOpts = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak']
              const randomBank = bankOpts[Math.floor(Math.random() * bankOpts.length)]
              const randomType = 'savings'
              const randomLast4 = Math.floor(1000 + Math.random() * 9000).toString()
              const randomBalance = Math.floor(40000 + Math.random() * 100000)
              const token = 'simulated:' + randomBank.toLowerCase() + '_' + Date.now()
              
              await axios.post(API + '/api/accounts/', {
                bank_name: randomBank,
                account_token: token,
                account_last4: randomLast4,
                account_type: randomType,
                balance: randomBalance
              }, { headers })
              
              setTimeout(async () => {
                const res = await axios.get(API + '/api/predict/next-month', { headers })
                setData(res.data)
                setLoading(false)
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
    </div>
  )

  const predictions = data?.predictions || []
  const monthlyChart = (data?.monthly_totals || []).map((v, i) => ({ month: 'M' + (i+1), amount: v }))
  const predChart = predictions.slice(0,8).map(p => ({ category: p.category.split(' ')[0], predicted: p.predicted, last: p.last_month }))

  const trendIcon = (trend) => trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️'
  const trendColor = (trend) => trend === 'increasing' ? 'text-red-400' : trend === 'decreasing' ? 'text-green-400' : 'text-yellow-400'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ML Expense Predictor</h1>
            <p className="text-blue-100 mt-1">Next month expense predictions using Linear Regression</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">Rs.{Math.round(data?.total_predicted||0).toLocaleString()}</div>
            <div className="text-blue-200 text-sm">Predicted next month total</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-xl font-bold">Rs.{Math.round(data?.current_month_total||0).toLocaleString()}</div>
            <div className="text-blue-200 text-xs">Current Month</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-xl font-bold">{data?.categories_count||0}</div>
            <div className="text-blue-200 text-xs">Categories Tracked</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-xl font-bold">{data?.model}</div>
            <div className="text-blue-200 text-xs">ML Model Used</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Monthly Spending History</h3>
          {monthlyChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No history data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{fill:'#9ca3af',fontSize:11}} />
                <YAxis tick={{fill:'#9ca3af',fontSize:11}} />
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'none',borderRadius:'8px',color:'#fff'}} formatter={v => 'Rs.' + v.toLocaleString()} />
                <Line type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} dot={{fill:'#6366f1'}} name="Spent" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Predicted vs Last Month</h3>
          {predChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500">No predictions</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={predChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="category" tick={{fill:'#9ca3af',fontSize:10}} />
                <YAxis tick={{fill:'#9ca3af',fontSize:11}} />
                <Tooltip contentStyle={{backgroundColor:'#1f2937',border:'none',borderRadius:'8px',color:'#fff'}} formatter={v => 'Rs.' + v.toLocaleString()} />
                <Bar dataKey="last" fill="#374151" radius={[4,4,0,0]} name="Last Month" />
                <Bar dataKey="predicted" fill="#6366f1" radius={[4,4,0,0]} name="Predicted" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">Category Predictions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {predictions.map((p, i) => (
            <div key={i} className="bg-dark-700 rounded-xl p-4 border border-dark-500">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i%COLORS.length]}} />
                  <span className="text-white font-semibold text-sm">{p.category}</span>
                </div>
                <span className={trendColor(p.trend) + " text-sm"}>{trendIcon(p.trend)} {p.trend}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-indigo-400 font-bold">Rs.{Math.round(p.predicted).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Predicted</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-300 font-bold">Rs.{Math.round(p.last_month).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Last Month</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-bold">{p.confidence}%</div>
                  <div className="text-xs text-gray-500">Confidence</div>
                </div>
              </div>
              <div className="h-1.5 bg-dark-600 rounded-full">
                <div className="h-1.5 rounded-full transition-all" style={{width: p.confidence + '%', backgroundColor: COLORS[i%COLORS.length]}} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{p.months_data} months of data</span>
                <span>Avg: Rs.{Math.round(p.avg_monthly).toLocaleString()}/mo</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">AI Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {predictions.filter(p => p.trend === 'increasing').slice(0,1).map((p,i) => (
            <div key={i} className="bg-dark-800/50 rounded-xl p-3 flex gap-2">
              <span className="text-lg">⚠️</span>
              <p className="text-xs text-yellow-300">{p.category} is trending up! Predicted Rs.{Math.round(p.predicted).toLocaleString()} next month vs Rs.{Math.round(p.last_month).toLocaleString()} last month.</p>
            </div>
          ))}
          {predictions.filter(p => p.trend === 'decreasing').slice(0,1).map((p,i) => (
            <div key={i} className="bg-dark-800/50 rounded-xl p-3 flex gap-2">
              <span className="text-lg">✅</span>
              <p className="text-xs text-green-300">Great! {p.category} spending is decreasing. Keep it up!</p>
            </div>
          ))}
          <div className="bg-dark-800/50 rounded-xl p-3 flex gap-2">
            <span className="text-lg">📊</span>
            <p className="text-xs text-blue-300">Total predicted spend next month: Rs.{Math.round(data?.total_predicted||0).toLocaleString()}. Plan your budget accordingly!</p>
          </div>
        </div>
      </div>
    </div>
  )
}

