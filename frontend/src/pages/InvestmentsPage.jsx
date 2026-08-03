import { useState, useEffect } from 'react'
import api from '../services/api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function InvestmentsPage() {
  const [tickers, setTickers] = useState([])
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [history, setHistory] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [historyPeriod, setHistoryPeriod] = useState(90)
  const [loading, setLoading] = useState(true)
  const [tradeModal, setTradeModal] = useState({ open: false, action: 'BUY', symbol: '', price: 0, qty: 1 })
  const [accounts, setAccounts] = useState([])

  const fetchMarketDataAndPortfolio = async () => {
    try {
      const tRes = await api.get('/api/investments/tickers')
      setTickers(tRes.data || [])
      
      // Select NIFTY50 as default active ticker if none selected
      if (!selectedTicker && tRes.data && tRes.data.length > 0) {
        setSelectedTicker(tRes.data.find(t => t.symbol === 'NIFTY50') || tRes.data[0])
      }
      
      const pRes = await api.get('/api/investments/portfolio')
      setPortfolio(pRes.data)
      
      const aRes = await api.get('/api/accounts/')
      setAccounts(aRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchTickerHistory = async (symbol, days) => {
    try {
      const hRes = await api.get(`/api/investments/tickers/${symbol}/history?days=${days}`)
      setHistory(hRes.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchMarketDataAndPortfolio()
    // Setup interval to fetch live prices every 10 seconds
    const interval = setInterval(() => {
      fetchMarketDataAndPortfolio()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedTicker) {
      fetchTickerHistory(selectedTicker.symbol, historyPeriod)
    }
  }, [selectedTicker, historyPeriod])

  const handleTrade = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/api/investments/trade', {
        symbol: tradeModal.symbol,
        quantity: parseFloat(tradeModal.qty),
        action: tradeModal.action
      })
      alert(res.data.message)
      setTradeModal({ ...tradeModal, open: false, qty: 1 })
      fetchMarketDataAndPortfolio()
    } catch (err) {
      alert('Trade execution failed: ' + (err.response?.data?.detail || err.message))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400 gap-2">
        <div className="animate-spin text-3xl">⏳</div>
        <div>Loading simulated market feeds...</div>
      </div>
    )
  }

  const simAccount = accounts.find(a => a.account_token && a.account_token.startsWith('simulated:'))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">

      {/* Header Overview Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Investments & Portfolio</h1>
          <p className="text-gray-400 text-sm mt-1">Simulated real-time paper trading aligned with your risk tolerance metrics.</p>
        </div>
        {simAccount ? (
          <div className="bg-dark-800 border border-dark-500 rounded-2xl px-4 py-2.5 glass text-right">
            <div className="text-[10px] text-gray-500 font-semibold uppercase">Linked Trading Cash</div>
            <div className="text-lg font-bold text-primary">₹{Math.round(simAccount.balance).toLocaleString()}</div>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-4 py-2.5 glass text-amber-400 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>Link a **Simulated Bank Account** in the Accounts tab to fund your investments.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticker List Sidepanel */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-5 glass lg:col-span-1 space-y-4 flex flex-col h-[520px]">
          <div>
            <h3 className="text-base font-bold text-white">Simulated Stocks</h3>
            <p className="text-gray-400 text-xs mt-0.5">Live quotes updated every 10s</p>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {tickers.map(ticker => {
              const isSelected = selectedTicker?.symbol === ticker.symbol
              return (
                <button
                  key={ticker.symbol}
                  onClick={() => setSelectedTicker(ticker)}
                  className={`w-full p-3.5 rounded-2xl text-left border flex justify-between items-center transition-all ${
                    isSelected ? 'bg-primary/10 border-primary text-white shadow-lg' : 'bg-dark-900/40 border-dark-600 hover:border-dark-400 text-gray-300'
                  }`}
                >
                  <div>
                    <span className="text-sm font-bold block">{ticker.symbol}</span>
                    <span className="text-[10px] text-gray-500 truncate max-w-[130px] block">{ticker.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold block">₹{ticker.price.toLocaleString()}</span>
                    <span className={`text-[10px] font-bold ${ticker.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {ticker.change >= 0 ? '+' : ''}{ticker.change_percent}%
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Live Chart & Trade panel */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 flex flex-col justify-between h-[520px]">
          {selectedTicker && (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{selectedTicker.symbol}</h3>
                    <span className="text-xs text-gray-400 font-medium">{selectedTicker.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-black text-white">₹{selectedTicker.price.toLocaleString()}</span>
                    <span className={`text-xs font-bold ${selectedTicker.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedTicker.change >= 0 ? '▲ +' : '▼ '}{selectedTicker.change.toLocaleString()} ({selectedTicker.change_percent}%) today
                    </span>
                  </div>
                </div>
                
                {/* Period selectors */}
                <div className="flex bg-dark-900 rounded-xl p-1 border border-dark-600">
                  {[30, 90, 180].map(days => (
                    <button
                      key={days}
                      onClick={() => setHistoryPeriod(days)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        historyPeriod === days ? 'bg-primary text-dark-900' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {days}D
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart container */}
              <div className="h-56 my-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tickLine={false} />
                    <YAxis stroke="#4b5563" fontSize={10} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0e0e18', borderColor: '#1e1e2e', borderRadius: '12px' }}
                      labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="price" stroke="#00D4FF" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPrice)" name="Price" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Trade Action buttons */}
              <div className="flex gap-4 border-t border-dark-600 pt-4">
                <button
                  onClick={() => setTradeModal({ open: true, action: 'BUY', symbol: selectedTicker.symbol, price: selectedTicker.price, qty: 1 })}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-teal-950/40"
                >
                  🟩 BUY {selectedTicker.symbol}
                </button>
                <button
                  onClick={() => setTradeModal({ open: true, action: 'SELL', symbol: selectedTicker.symbol, price: selectedTicker.price, qty: 1 })}
                  className="flex-1 bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-rose-950/40"
                >
                  🟥 SELL {selectedTicker.symbol}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Portfolio Holdings Table */}
      {portfolio && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Holdings List table */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white">Your Simulated Portfolio</h3>
            {portfolio.holdings.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <div className="text-4xl mb-2">💼</div>
                <div className="text-sm">You hold no investments. Buy tickers above to build your portfolio.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-600 text-gray-500 uppercase tracking-wider font-semibold">
                      <th className="pb-3">Asset</th>
                      <th className="pb-3 text-right">Shares</th>
                      <th className="pb-3 text-right">Avg Cost</th>
                      <th className="pb-3 text-right">Current Price</th>
                      <th className="pb-3 text-right">Value</th>
                      <th className="pb-3 text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map(h => (
                      <tr key={h.symbol} className="border-b border-dark-600 hover:bg-dark-900/30 transition-all font-medium text-gray-300">
                        <td className="py-4">
                          <span className="font-bold text-white block">{h.symbol}</span>
                          <span className="text-[10px] text-gray-500">{h.asset_type}</span>
                        </td>
                        <td className="py-4 text-right">{h.quantity}</td>
                        <td className="py-4 text-right">₹{h.avg_buy_price.toLocaleString()}</td>
                        <td className="py-4 text-right">₹{h.current_price.toLocaleString()}</td>
                        <td className="py-4 text-right font-bold text-white">₹{h.value.toLocaleString()}</td>
                        <td className={`py-4 text-right font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{h.pnl.toLocaleString()} ({h.pnl_percent}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Portfolio Statistics & Risk Ratios */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-4">Portfolio Risk Metrics</h3>
              
              {/* Warnings */}
              {portfolio.risk_warning && (
                <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 mb-4 text-amber-400 text-xs flex gap-2">
                  <span className="text-base">🚨</span>
                  <div>
                    <div className="font-bold">Risk Allocation Mismatch</div>
                    <p className="mt-0.5 leading-relaxed">{portfolio.risk_warning_message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between border-b border-dark-600 pb-3">
                  <span className="text-gray-500 text-xs font-semibold">Total Valuation</span>
                  <span className="text-white text-base font-black">₹{portfolio.total_value.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-dark-600 pb-3">
                  <span className="text-gray-500 text-xs font-semibold">Total Returns (P&L)</span>
                  <span className={`text-sm font-extrabold ${portfolio.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{portfolio.total_pnl.toLocaleString()} ({portfolio.total_pnl_percent.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between border-b border-dark-600 pb-3">
                  <div>
                    <span className="text-gray-500 text-xs font-semibold block">Portfolio Beta</span>
                    <span className="text-[10px] text-gray-600">Sensitivity to market index</span>
                  </div>
                  <span className="text-white text-sm font-bold mt-1">{portfolio.portfolio_beta}</span>
                </div>
                <div className="flex justify-between border-b border-dark-600 pb-3">
                  <div>
                    <span className="text-gray-500 text-xs font-semibold block">Sharpe Ratio</span>
                    <span className="text-[10px] text-gray-600">Risk-adjusted returns metric</span>
                  </div>
                  <span className="text-white text-sm font-bold mt-1">{portfolio.sharpe_ratio}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <div>
                    <span className="text-gray-500 text-xs font-semibold block">Diversification Score</span>
                    <span className="text-[10px] text-gray-600">Weighted asset concentration</span>
                  </div>
                  <span className="text-primary text-sm font-extrabold mt-1">{portfolio.diversification_score}/100</span>
                </div>
              </div>
            </div>
            
            <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-500 text-[11px] text-gray-400 leading-relaxed">
              💡 **Sharpe Ratio** above 1 is considered good. Higher values indicate higher return per unit of volatility.
            </div>
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {tradeModal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 w-full max-w-sm shadow-2xl glass">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">{tradeModal.action === 'BUY' ? '🟢 Buy' : '🔴 Sell'} {tradeModal.symbol}</h3>
              <button onClick={() => setTradeModal({ ...tradeModal, open: false })} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleTrade} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1 block">Live Price</label>
                <div className="text-white font-extrabold text-base">₹{tradeModal.price.toLocaleString()}</div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold mb-1 block">Quantity (Shares)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={tradeModal.qty} 
                  onChange={e => setTradeModal({ ...tradeModal, qty: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary"
                  min="0.01"
                  required
                />
              </div>
              <div className="bg-dark-900 p-3 rounded-2xl border border-dark-600 flex justify-between text-xs">
                <span className="text-gray-500 font-semibold uppercase">Total Cost</span>
                <span className="text-white font-bold">₹{Math.round(tradeModal.price * tradeModal.qty).toLocaleString()}</span>
              </div>
              <button 
                type="submit" 
                className={`w-full py-3 rounded-xl font-bold text-sm transition-colors text-white ${
                  tradeModal.action === 'BUY' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                Confirm Simulated {tradeModal.action} order
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

