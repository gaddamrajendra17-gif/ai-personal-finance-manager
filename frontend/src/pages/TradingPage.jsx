import { useState, useEffect } from 'react'
import api from '../services/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts'

export default function TradingPage() {
  const [backtest, setBacktest] = useState(null)
  const [strategies, setStrategies] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [form, setForm] = useState({
    symbol: 'NIFTY50',
    strategy_type: 'SMA_CROSSOVER',
    capital: 100000,
    fast_period: 10,
    slow_period: 30,
    rsi_period: 14,
    rsi_lower: 30,
    rsi_upper: 70,
    momentum_period: 20,
    sma_period: 20,
    strategy_name: 'My SMA Crossover Algo'
  })

  const fetchStrategies = async () => {
    try {
      const res = await api.get('/api/trading/strategies')
      setStrategies(res.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStrategies()
  }, [])

  const handleBacktest = async (e) => {
    e.preventDefault()
    setRunning(true)
    
    // Parse params based on strategy type
    let params = {}
    if (form.strategy_type === 'SMA_CROSSOVER') {
      params = { fast_period: form.fast_period, slow_period: form.slow_period }
    } else if (form.strategy_type === 'MEAN_REVERSION') {
      params = { rsi_period: form.rsi_period, rsi_lower: form.rsi_lower, rsi_upper: form.rsi_upper }
    } else {
      params = { momentum_period: form.momentum_period, sma_period: form.sma_period }
    }

    try {
      const res = await api.post('/api/trading/backtest', {
        symbol: form.symbol,
        strategy_type: form.strategy_type,
        params: JSON.stringify(params),
        capital: parseFloat(form.capital)
      })
      setBacktest(res.data)
    } catch (err) {
      alert('Backtest failed: ' + (err.response?.data?.detail || err.message))
    } finally {
      setRunning(false)
    }
  }

  const handleSaveStrategy = async () => {
    let params = {}
    if (form.strategy_type === 'SMA_CROSSOVER') {
      params = { fast_period: form.fast_period, slow_period: form.slow_period }
    } else if (form.strategy_type === 'MEAN_REVERSION') {
      params = { rsi_period: form.rsi_period, rsi_lower: form.rsi_lower, rsi_upper: form.rsi_upper }
    } else {
      params = { momentum_period: form.momentum_period, sma_period: form.sma_period }
    }

    try {
      await api.post('/api/trading/strategies', {
        name: form.strategy_name,
        symbol: form.symbol,
        strategy_type: form.strategy_type,
        capital: parseFloat(form.capital),
        params: JSON.stringify(params)
      })
      alert('Algorithm strategy saved successfully!')
      fetchStrategies()
    } catch (err) {
      alert('Failed to save strategy: ' + (err.response?.data?.detail || err.message))
    }
  }

  const handleToggleStrategy = async (stratId) => {
    try {
      await api.post(`/api/trading/strategies/${stratId}/toggle`)
      fetchStrategies()
    } catch (err) {
      alert('Toggle failed: ' + (err.message))
    }
  }

  const handleDeleteStrategy = async (stratId) => {
    if (!window.confirm('Are you sure you want to delete this trading strategy?')) return
    try {
      await api.delete(`/api/trading/strategies/${stratId}`)
      fetchStrategies()
    } catch (err) {
      alert('Delete failed: ' + (err.message))
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Cognitive Algorithmic Trading</h1>
        <p className="text-gray-400 text-sm mt-1">Design trading strategies, run backtests, and simulate automated live trade executions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Strategy Config form */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 space-y-4">
          <h3 className="text-lg font-bold text-white mb-2">Strategy Designer</h3>
          <form onSubmit={handleBacktest} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1 block">Ticker Asset</label>
              <select value={form.symbol} onChange={e=>setForm({...form, symbol:e.target.value})} className="w-full bg-dark-750 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary">
                <option value="NIFTY50">Nifty 50 Index</option>
                <option value="RELIANCE">Reliance Industries</option>
                <option value="TCS">TCS Ltd.</option>
                <option value="INFY">Infosys Ltd.</option>
                <option value="HDFCBANK">HDFC Bank</option>
                <option value="GOLD">SBI Gold ETF</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1 block">Algorithm Type</label>
              <select value={form.strategy_type} onChange={e=>setForm({...form, strategy_type:e.target.value})} className="w-full bg-dark-750 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary">
                <option value="SMA_CROSSOVER">SMA Crossover (Fast vs Slow)</option>
                <option value="MEAN_REVERSION">Mean Reversion (RSI-based)</option>
                <option value="MOMENTUM">Momentum (MA & ROC)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1 block">Virtual Cash (Rs.)</label>
              <input type="number" value={form.capital} onChange={e=>setForm({...form, capital:parseFloat(e.target.value)||0})} className="w-full bg-dark-750 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary" />
            </div>

            {/* Conditional params based on strategy type */}
            {form.strategy_type === 'SMA_CROSSOVER' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-dark-900/60 rounded-2xl border border-dark-600">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">Fast Period</label>
                  <input type="number" value={form.fast_period} onChange={e=>setForm({...form, fast_period:parseInt(e.target.value)||1})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">Slow Period</label>
                  <input type="number" value={form.slow_period} onChange={e=>setForm({...form, slow_period:parseInt(e.target.value)||1})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                </div>
              </div>
            )}

            {form.strategy_type === 'MEAN_REVERSION' && (
              <div className="space-y-2 p-3 bg-dark-900/60 rounded-2xl border border-dark-600">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">RSI Period</label>
                  <input type="number" value={form.rsi_period} onChange={e=>setForm({...form, rsi_period:parseInt(e.target.value)||1})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Oversold (Buy)</label>
                    <input type="number" value={form.rsi_lower} onChange={e=>setForm({...form, rsi_lower:parseFloat(e.target.value)||0})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold block mb-1">Overbought (Sell)</label>
                    <input type="number" value={form.rsi_upper} onChange={e=>setForm({...form, rsi_upper:parseFloat(e.target.value)||0})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                  </div>
                </div>
              </div>
            )}

            {form.strategy_type === 'MOMENTUM' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-dark-900/60 rounded-2xl border border-dark-600">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">Momentum Period</label>
                  <input type="number" value={form.momentum_period} onChange={e=>setForm({...form, momentum_period:parseInt(e.target.value)||1})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">SMA Filter</label>
                  <input type="number" value={form.sma_period} onChange={e=>setForm({...form, sma_period:parseInt(e.target.value)||1})} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 text-white text-xs" />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={running}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all"
            >
              {running ? 'Simulating Backtest...' : '⚡ Run Backtest'}
            </button>
          </form>

          {/* Strategy Saving section */}
          {backtest && (
            <div className="border-t border-dark-600 pt-4 space-y-3">
              <label className="text-xs text-gray-400 font-semibold block">Save Strategy</label>
              <input 
                type="text" 
                value={form.strategy_name} 
                onChange={e=>setForm({...form, strategy_name: e.target.value})} 
                className="w-full bg-dark-750 border border-dark-600 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-primary"
                placeholder="Strategy Name"
              />
              <button 
                onClick={handleSaveStrategy}
                className="w-full bg-dark-600 hover:bg-dark-500 text-primary border border-primary/20 font-bold py-2 rounded-xl text-xs transition-all"
              >
                💾 Save to Auto-Trade
              </button>
            </div>
          )}
        </div>

        {/* Backtesting charts and results */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 flex flex-col justify-between min-h-[480px]">
          {backtest ? (
            <div className="space-y-6">
              {/* Backtest Header Ratios */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600 text-center">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">Total Return</div>
                  <div className={`text-lg font-bold mt-1 ${backtest.metrics.total_return_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {backtest.metrics.total_return_percent}%
                  </div>
                </div>
                <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600 text-center">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">Win Rate</div>
                  <div className="text-lg font-bold text-white mt-1">{backtest.metrics.win_rate_percent}%</div>
                </div>
                <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600 text-center">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">Trades</div>
                  <div className="text-lg font-bold text-white mt-1">{backtest.metrics.total_trades}</div>
                </div>
                <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600 text-center">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">Sharpe Ratio</div>
                  <div className="text-lg font-bold text-primary mt-1">{backtest.metrics.sharpe_ratio}</div>
                </div>
              </div>

              {/* Chart */}
              <div>
                <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Equity Growth Curve</h4>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={backtest.equity_curve} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tickLine={false} />
                      <YAxis stroke="#4b5563" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0e0e18', borderColor: '#1e1e2e', borderRadius: '12px' }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                      <Legend formatter={(value) => <span className="text-xs text-gray-400 font-semibold">{value}</span>} />
                      <Line type="monotone" dataKey="portfolio_value" stroke="#7C3AED" strokeWidth={2} dot={false} name="Algo Equity" />
                      <Line type="monotone" dataKey="price" stroke="#00D4FF" strokeWidth={1} dot={false} name="Asset Price" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trade Logs List */}
              <div className="max-h-44 overflow-y-auto pr-1">
                <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Backtest Trade Logs</h4>
                {backtest.trade_log.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500">No trades executed during backtest. Try relaxing constraints.</div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-dark-600 text-gray-500 uppercase font-semibold">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2 text-right">Price</th>
                        <th className="pb-2 text-right">Cash Capital</th>
                        <th className="pb-2 text-right">Profit / Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backtest.trade_log.map((log, idx) => (
                        <tr key={idx} className="border-b border-dark-600 py-2 hover:bg-dark-900/30 transition-all font-medium text-gray-300">
                          <td className="py-2.5 text-gray-500">{log.date}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-white">₹{log.price.toLocaleString()}</td>
                          <td className="py-2.5 text-right">₹{log.capital.toLocaleString()}</td>
                          <td className="py-2.5 text-right font-bold">
                            {log.action === 'SELL' ? (
                              <span className={log.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {log.profit >= 0 ? '+' : ''}₹{log.profit.toLocaleString()} ({log.profit_percent}%)
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-5xl">⚡</span>
              <p className="text-white font-bold text-base mt-3">Algorithmic Trading Dashboard</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm text-center">Configure parameters on the left and run a backtest to analyze historical alpha generation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Strategies List panel */}
      {strategies.length > 0 && (
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass space-y-4">
          <h3 className="text-lg font-bold text-white">Saved Strategies & Auto-Trading</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {strategies.map(strat => {
              const params = JSON.parse(strat.params)
              return (
                <div key={strat.id} className="bg-dark-900/60 border border-dark-600 rounded-2xl p-5 hover:border-primary/20 transition-all flex flex-col justify-between relative overflow-hidden">
                  {strat.is_active && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-extrabold">RUNNING</span>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-white truncate pr-16">{strat.name}</h4>
                    <p className="text-gray-500 text-[10px] mt-0.5">{strat.symbol} • {strat.strategy_type}</p>
                    
                    <div className="mt-3.5 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Allocated Capital</span>
                        <span className="text-white font-semibold">₹{strat.capital.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs border-b border-dark-700 pb-2">
                        <span className="text-gray-500">Params</span>
                        <span className="text-primary text-[10px] font-mono truncate max-w-[150px]">
                          {Object.entries(params).map(([k,v]) => `${k}:${v}`).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2.5 mt-4 pt-3 border-t border-dark-700">
                    <button
                      onClick={() => handleToggleStrategy(strat.id)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        strat.is_active ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30' : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      {strat.is_active ? '⏸️ Pause Auto-Trade' : '▶️ Run Auto-Trade'}
                    </button>
                    <button
                      onClick={() => handleDeleteStrategy(strat.id)}
                      className="text-rose-500 hover:text-rose-450 hover:bg-rose-500/10 p-2 rounded-xl text-xs font-bold transition-all"
                      title="Delete strategy"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
