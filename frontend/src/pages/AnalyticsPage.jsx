import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = "http://localhost:8000";
const COLORS = ["#6366f1","#22c55e","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6","#84cc16"];

export default function AnalyticsPage() {
  const { token } = useAuthStore();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [simulating, setSimulating] = useState(false);
  const [continuousSpend, setContinuousSpend] = useState(false);
  const [latestSimTx, setLatestSimTx] = useState(null);
  
  // Custom Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API}/api/accounts/`, { headers });
      setAccounts(res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchTransactions = async () => {
    try {
      const res = await axios.get(`${API}/api/transactions/?limit=500`, { headers });
      setTransactions(res.data || []);
    } catch (e) { console.error(e); }
  };

  const fetchBudgets = async () => {
    try {
      const res = await axios.get(`${API}/api/budgets/`, { headers });
      setBudgets(res.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchTransactions(), fetchAccounts(), fetchBudgets()]);
      setLoading(false);
    };
    fetchAll();
  }, [token]);

  useEffect(() => {
    const handler = () => {
      fetchTransactions();
      fetchAccounts();
      fetchBudgets();
    };
    window.addEventListener('new-transaction-event', handler);
    return () => {
      window.removeEventListener('new-transaction-event', handler);
    };
  }, [token]);

  const handleAutoSeed = async () => {
    setLoading(true);
    try {
      const bankOpts = ['SBI','HDFC','ICICI','Axis','Kotak'];
      const randomBank = bankOpts[Math.floor(Math.random() * bankOpts.length)];
      const randomType = 'savings';
      const randomLast4 = Math.floor(1000 + Math.random() * 9000).toString();
      const randomBalance = Math.floor(30000 + Math.random() * 120000);
      const token = 'simulated:' + randomBank.toLowerCase() + '_' + Date.now();
      
      await axios.post(`${API}/api/accounts/`, {
        bank_name: randomBank,
        account_token: token,
        account_last4: randomLast4,
        account_type: randomType,
        balance: randomBalance
      }, { headers });
      
      setTimeout(async () => {
        await Promise.all([fetchTransactions(), fetchAccounts()]);
        setLoading(false);
      }, 1500);
    } catch (e) {
      console.error(e);
      setLoading(false);
      alert("Failed to auto-seed simulated account.");
    }
  };

  const handleAutoSpend = async (accountId) => {
    if (!accountId) return;
    setSimulating(true);
    try {
      const res = await axios.post(`${API}/api/accounts/${accountId}/auto-spend`, {}, { headers });
      setLatestSimTx(res.data);
      await Promise.all([fetchTransactions(), fetchAccounts()]);
    } catch (e) {
      console.error(e);
      alert("Failed to execute auto-spending: " + (e.response?.data?.detail || e.message));
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    let interval = null;
    if (continuousSpend) {
      const simAcc = accounts.find(a => a.account_token?.startsWith("simulated:"));
      if (simAcc) {
        interval = setInterval(() => {
          handleAutoSpend(simAcc.id);
        }, 5000);
      } else {
        alert("Please create a simulated account first!");
        setContinuousSpend(false);
      }
    } else {
      if (interval) clearInterval(interval);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [continuousSpend, accounts]);

  // ── CSV Export ──
  const handleExportCSV = () => {
    let headersArr = ["Date", "Merchant", "Amount", "Category", "Type", "Anomaly"];
    let rows = filtered.map(t => [
      new Date(t.timestamp || t.created_at).toLocaleDateString(),
      `"${(t.merchant || 'Unknown').replace(/"/g, '""')}"`,
      t.amount,
      t.category || "Others",
      t.transaction_type,
      t.is_anomaly ? "YES" : "NO"
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + [headersArr.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PFM_Financial_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Filter Console Logic ──
  const filtered = transactions.filter(t => {
    const d = new Date(t.timestamp || t.created_at);
    const now = new Date();
    
    // Period filter
    let matchesPeriod = true;
    if (period === "week") matchesPeriod = (now - d) / 86400000 <= 7;
    else if (period === "month") matchesPeriod = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    else if (period === "year") matchesPeriod = d.getFullYear() === now.getFullYear();
    
    // Search query filter
    const matchesSearch = (t.merchant || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
                          
    // Category filter
    const matchesCategory = selectedCategory === "all" ? true : (t.category === selectedCategory);
    
    // Custom Date Range filter
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && (d >= new Date(startDate));
    }
    if (endDate) {
      // Set to end of the day
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && (d <= endDateTime);
    }
    
    return matchesPeriod && matchesSearch && matchesCategory && matchesDate;
  });

  const debits = filtered.filter(t => t.amount < 0);
  const credits = filtered.filter(t => t.amount > 0);
  const totalSpent = debits.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = credits.reduce((s, t) => s + t.amount, 0);
  const savings = totalIncome - totalSpent;

  // ── Spending Velocity & Patterns ──
  // Average ticket size
  const averageTicket = debits.length > 0 ? Math.round(totalSpent / debits.length) : 0;
  
  // Calculate days in filtered set to get daily velocity
  const getDaysDiff = () => {
    if (startDate && endDate) {
      return Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000));
    }
    if (period === "week") return 7;
    if (period === "month") return new Date().getDate(); // days elapsed in month
    if (period === "year") return 365;
    return 30; // default average
  };
  const spendVelocity = Math.round(totalSpent / getDaysDiff());

  // Weekend vs Weekday
  let weekendSpend = 0;
  let weekdaySpend = 0;
  debits.forEach(t => {
    const day = new Date(t.timestamp || t.created_at).getDay();
    if (day === 0 || day === 6) { // Sun/Sat
      weekendSpend += Math.abs(t.amount);
    } else {
      weekdaySpend += Math.abs(t.amount);
    }
  });
  const weekendRatio = weekendSpend + weekdaySpend > 0 ? Math.round((weekendSpend / (weekendSpend + weekdaySpend)) * 100) : 50;

  // Peak spending hours
  const hoursMap = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  debits.forEach(t => {
    const hr = new Date(t.timestamp || t.created_at).getHours();
    if (6 <= hr && hr < 12) hoursMap.Morning += Math.abs(t.amount);
    else if (12 <= hr && hr < 17) hoursMap.Afternoon += Math.abs(t.amount);
    else if (17 <= hr && hr < 22) hoursMap.Evening += Math.abs(t.amount);
    else hoursMap.Night += Math.abs(t.amount);
  });
  const peakHoursData = Object.entries(hoursMap).map(([name, value]) => ({ name, value: Math.round(value) }));

  // Budget Adherence Speedometer (Time-Weighted)
  const totalBudgetLimit = budgets.reduce((s, b) => s + b.limit_amount, 0);
  const totalBudgetSpent = budgets.reduce((s, b) => s + b.spent_amount, 0);
  const budgetSpentPct = totalBudgetLimit > 0 ? (totalBudgetSpent / totalBudgetLimit) * 100 : 0;
  const monthElapsedPct = (new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100;
  const budgetWarning = budgetSpentPct > monthElapsedPct + 15;

  // Anomalies / Unusual activities
  const unusualAlerts = filtered.filter(t => t.is_anomaly);

  // ── Category breakdown ──
  const categoryMap = {};
  debits.forEach(t => {
    const cat = t.category || "Others";
    categoryMap[cat] = (categoryMap[cat] || 0) + Math.abs(t.amount);
  });
  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  // ── Monthly trend ──
  const monthMap = {};
  transactions.forEach(t => {
    const d = new Date(t.timestamp || t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    if (!monthMap[key]) monthMap[key] = { month: label, income: 0, expense: 0 };
    if (t.amount > 0) monthMap[key].income += t.amount;
    else monthMap[key].expense += Math.abs(t.amount);
  });
  const monthlyData = Object.values(monthMap).slice(-6).map(m => ({
    ...m, income: Math.round(m.income), expense: Math.round(m.expense), savings: Math.round(m.income - m.expense)
  }));

  // ── Daily spending this month ──
  const dailyMap = {};
  debits.forEach(t => {
    const d = new Date(t.timestamp || t.created_at);
    const key = d.getDate();
    dailyMap[key] = (dailyMap[key] || 0) + Math.abs(t.amount);
  });
  const dailyData = Object.entries(dailyMap)
    .map(([day, amount]) => ({ day: `Day ${day}`, amount: Math.round(amount) }))
    .sort((a, b) => parseInt(a.day.split(" ")[1]) - parseInt(b.day.split(" ")[1]));

  // ── Top merchants ──
  const merchantMap = {};
  debits.forEach(t => {
    const m = t.merchant || "Unknown";
    merchantMap[m] = (merchantMap[m] || 0) + Math.abs(t.amount);
  });
  const topMerchants = Object.entries(merchantMap)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  // ── Automation Stats ──
  const automatedTxns = filtered.filter(t => {
    return t.is_recurring || (t.description && (t.description.startsWith("Paid to") || t.description.startsWith("Received from") || t.description.includes("Automated recurring")));
  });
  const automatedCount = automatedTxns.length;
  const manualCount = filtered.length - automatedCount;
  const automationRate = filtered.length > 0 ? Math.round((automatedCount / filtered.length) * 100) : 0;

  const automationChartData = [
    { name: "Automated", value: automatedCount },
    { name: "Manual", value: manualCount }
  ];

  const fmt = (n) => `₹${Math.abs(n).toLocaleString("en-IN")}`;

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <span className="animate-spin mr-2 text-2xl">⏳</span> Loading Analytics...
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">📊 Smart Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Transaction speedometers, customizable reporting, and pattern identification.</p>
        </div>
        <div className="flex gap-2">
          {["week","month","year","all"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${period === p ? "bg-primary text-dark-900 font-bold" : "bg-dark-700 text-gray-400 hover:text-white"}`}>
              {p === "all" ? "All Time" : `This ${p.charAt(0).toUpperCase()+p.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {/* AI Simulation Control Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-dark-500 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-primary"></span>
              🤖 AI Simulation & Auto-Spending Center
            </h2>
            <p className="text-gray-400 text-xs mt-1 font-medium">
              Simulate live banking activity, automatically generate transactions, and watch real-time updates.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {accounts.filter(a => a.account_token?.startsWith("simulated:")).length === 0 ? (
              <button
                onClick={handleAutoSeed}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-950/40 flex items-center gap-2"
              >
                ⚡ Auto-Seed 90d History (Simulate Spends)
              </button>
            ) : (
              <>
                <div className="flex items-center bg-dark-700 border border-dark-600 rounded-2xl px-3 py-1.5">
                  <span className="text-[10px] text-gray-400 mr-2">Simulated Bank:</span>
                  <select
                    className="bg-transparent text-white text-xs font-semibold focus:outline-none"
                    onChange={(e) => {
                      if (e.target.value) handleAutoSpend(e.target.value);
                      e.target.value = "";
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Trigger Single Expense --</option>
                    {accounts.filter(a => a.account_token?.startsWith("simulated:")).map(a => (
                      <option key={a.id} value={a.id} className="bg-dark-800 text-white">{a.bank_name} (₹{Math.round(a.balance).toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={() => {
                    const simAcc = accounts.find(a => a.account_token?.startsWith("simulated:"));
                    if (simAcc) handleAutoSpend(simAcc.id);
                  }}
                  disabled={simulating}
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 disabled:opacity-50 text-white px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
                >
                  💸 Spend Money Now
                </button>

                <button
                  onClick={() => setContinuousSpend(!continuousSpend)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border flex items-center gap-2 ${
                    continuousSpend 
                      ? "bg-green-650 text-white border-green-500 shadow-lg" 
                      : "bg-dark-700 text-gray-300 border-dark-600 hover:text-white"
                  }`}
                >
                  {continuousSpend ? "⏹️ Stop Auto-Spend" : "🔁 Continuous Auto-Spend (5s)"}
                </button>
              </>
            )}
          </div>
        </div>

        {latestSimTx && (
          <div className="mt-4 pt-4 border-t border-dark-600 flex items-center justify-between text-xs animate-fade-in">
            <span className="text-gray-400 font-medium">Latest simulated action:</span>
            <div className="flex items-center gap-2">
              <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-lg font-bold">
                Spent ₹{latestSimTx.amount.toLocaleString()} at {latestSimTx.merchant}
              </span>
              <span className="text-gray-500 font-medium">({latestSimTx.category})</span>
            </div>
          </div>
        )}
      </div>

      {/* Customizable Reporting Filter Console */}
      <div className="bg-dark-800 border border-dark-500 rounded-3xl p-5 glass space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white">Customizable Reporting Console</h3>
          <button 
            onClick={handleExportCSV}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
          >
            📥 Download CSV Report
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] text-gray-500 font-bold block mb-1">Search Merchant / Details</label>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-primary"
              placeholder="e.g. Amazon, Uber..."
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold block mb-1">Category Filter</label>
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)} 
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-primary"
            >
              <option value="all">All Categories</option>
              {['Food & Dining','Transport','Shopping','Utilities','Entertainment','Health & Medical','Education','Investments','Other'].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold block mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-bold block mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Real-time Unusual Activity Alerts Panel */}
      {unusualAlerts.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/25 rounded-3xl p-5 flex items-start gap-4 animate-pulse">
          <span className="text-2xl mt-0.5">🚨</span>
          <div className="space-y-1 flex-1">
            <h4 className="text-sm font-bold text-rose-400">Unusual Activity Detected ({unusualAlerts.length} anomaly flags)</h4>
            <p className="text-gray-400 text-xs leading-relaxed">Our Isolation Forest classifier flagged the following transactions for suspicious volumes or z-score spikes:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
              {unusualAlerts.slice(0, 4).map(t => (
                <div key={t.id} className="bg-dark-900/60 p-2.5 rounded-xl border border-rose-500/20 text-xs flex justify-between">
                  <div>
                    <span className="text-white font-bold block">{t.merchant}</span>
                    <span className="text-[10px] text-gray-500">{new Date(t.timestamp || t.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className="text-rose-400 font-bold">₹{t.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary grid (Velocity & Adherence Meter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Instant Transaction Analysis (Velocity) */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-5 glass flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Instant Transaction analysis</h3>
            <p className="text-gray-400 text-[10px] mt-0.5">Spending velocity and ticket size metrics</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600">
              <span className="text-[10px] text-gray-500 font-semibold block">Spend Velocity</span>
              <span className="text-base font-bold text-primary block mt-1">₹{spendVelocity.toLocaleString()}</span>
              <span className="text-[9px] text-gray-400">spent per day</span>
            </div>
            <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600">
              <span className="text-[10px] text-gray-500 font-semibold block">Average Ticket</span>
              <span className="text-base font-bold text-white block mt-1">₹{averageTicket.toLocaleString()}</span>
              <span className="text-[9px] text-gray-400">per transaction</span>
            </div>
          </div>
        </div>

        {/* Spending Pattern Indicators */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-5 glass flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Spending Pattern Identification</h3>
            <p className="text-gray-400 text-[10px] mt-0.5">Temporal and structural classifications</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600">
              <span className="text-[10px] text-gray-500 font-semibold block">Weekend Ratio</span>
              <span className="text-base font-bold text-amber-400 block mt-1">{weekendRatio}%</span>
              <span className="text-[9px] text-gray-400">spent on Sat / Sun</span>
            </div>
            <div className="bg-dark-900/60 p-3 rounded-2xl border border-dark-600">
              <span className="text-[10px] text-gray-500 font-semibold block">Peak Hour Slot</span>
              <span className="text-xs font-bold text-white block mt-1 truncate">{hoursMap.Evening > hoursMap.Afternoon ? 'Evening (5-10PM)' : 'Afternoon (12-5PM)'}</span>
              <span className="text-[9px] text-gray-400">highest spending band</span>
            </div>
          </div>
        </div>

        {/* Budget Adherence Speedometer (Time-Weighted) */}
        <div className="bg-dark-800 border border-dark-500 rounded-3xl p-5 glass flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Budget Adherence Meter</h3>
            <p className="text-gray-400 text-[10px] mt-0.5">Month timeline vs. limits consumption</p>
          </div>
          
          <div className="mt-3.5 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-gray-500">Adherence Speed:</span>
              <span className={budgetWarning ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                {budgetWarning ? "⚠️ OVERSPENDING VELOCITY" : "✅ OPTIMAL PROGRESS"}
              </span>
            </div>
            <div className="h-2 bg-dark-900 rounded-full overflow-hidden relative border border-dark-600">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-rose-500" style={{ width: `${Math.min(100, budgetSpentPct)}%` }}></div>
              <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: `${monthElapsedPct}%` }} title="Elapsed Month line"></div>
            </div>
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Spent: {Math.round(budgetSpentPct)}%</span>
              <span>Month Line: {Math.round(monthElapsedPct)}%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Main Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Income", value: fmt(totalIncome), color: "text-green-400", bg: "from-green-600/20 to-green-800/10", icon: "💰" },
          { label: "Total Spent", value: fmt(totalSpent), color: "text-red-400", bg: "from-red-600/20 to-red-800/10", icon: "💸" },
          { label: "Net Savings", value: fmt(savings), color: savings >= 0 ? "text-blue-400" : "text-orange-400", bg: "from-blue-600/20 to-blue-800/10", icon: "🏦" },
          { label: "Filtered Trxns", value: filtered.length, color: "text-purple-400", bg: "from-purple-600/20 to-purple-800/10", icon: "📋" },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.bg} border border-dark-500 rounded-2xl p-4`}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly trend + Category pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">📈 Monthly Trend</h3>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} />
                <Legend />
                <Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e33" name="Income" />
                <Area type="monotone" dataKey="expense" stackId="2" stroke="#ef4444" fill="#ef444433" name="Expense" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category pie */}
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">🥧 Spending by Category</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No spending data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} formatter={(v) => `₹${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Daily spending + Top merchants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily spending */}
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">📅 Daily Spending</h3>
          {dailyData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} formatter={(v) => `₹${v.toLocaleString()}`} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4,4,0,0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top merchants */}
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">🏪 Top Merchants</h3>
          {topMerchants.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>
          ) : (
            <div className="space-y-3">
              {topMerchants.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-white font-medium">{m.name}</span>
                      <span className="text-red-400 font-semibold">₹{m.amount.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-dark-600 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: `${(m.amount/topMerchants[0].amount)*100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Automation Rates & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Automation rate circle chart */}
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-1">🤖 Automation Rate</h3>
          <p className="text-gray-400 text-xs mb-4">Ratio of automated vs manual entries</p>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={automationChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#6366f1" /> {/* Indigo for Automated */}
                    <Cell fill="#4b5563" /> {/* Gray for Manual */}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-white">{automationRate}%</span>
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Automated</span>
              </div>
            </div>
          )}
        </div>

        {/* Automation Metrics */}
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-semibold mb-1">⚙️ Automation Details</h3>
            <p className="text-gray-400 text-xs mb-4">How your transactions were logged</p>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {[
              {
                title: "Automated Trxns",
                value: `${automatedCount} / ${filtered.length}`,
                desc: "Total automated updates",
                color: "text-indigo-400"
              },
              {
                title: "Automation Rate",
                value: `${automationRate}%`,
                desc: "Hands-free entry rate",
                color: "text-green-400"
              },
              {
                title: "SMS Auto-Imports",
                value: automatedTxns.filter(t => t.description && (t.description.startsWith("Paid to") || t.description.startsWith("Received from"))).length,
                desc: "Parsed from real-time bank SMS",
                color: "text-cyan-400"
              },
              {
                title: "Scheduled Recurring",
                value: automatedTxns.filter(t => t.is_recurring).length,
                desc: "Executed via smart scheduler",
                color: "text-purple-400"
              }
            ].map((stat, idx) => (
              <div key={idx} className="bg-dark-700/40 border border-dark-600 rounded-xl p-3 flex flex-col justify-center">
                <span className="text-xs text-gray-400 font-medium">{stat.title}</span>
                <span className={`text-lg font-bold mt-1 ${stat.color}`}>{stat.value}</span>
                <span className="text-[9px] text-gray-500 mt-0.5 leading-tight">{stat.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">🤖 AI Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            totalSpent > totalIncome ? { icon: "⚠️", text: `You spent ₹${(totalSpent-totalIncome).toLocaleString()} more than you earned this period!`, color: "text-red-300" }
            : { icon: "✅", text: `Great! You saved ₹${savings.toLocaleString()} this period.`, color: "text-green-300" },
            categoryData[0] ? { icon: "📊", text: `Your biggest expense is ${categoryData[0].name} at ₹${categoryData[0].value.toLocaleString()}.`, color: "text-yellow-300" }
            : { icon: "📊", text: "Add transactions to see spending insights.", color: "text-gray-300" },
            topMerchants[0] ? { icon: "🏪", text: `You spend most at ${topMerchants[0].name} — ₹${topMerchants[0].amount.toLocaleString()} total.`, color: "text-blue-300" }
            : { icon: "🏪", text: "Import SMS transactions to see merchant analysis.", color: "text-gray-300" },
          ].map((insight, i) => (
            <div key={i} className="bg-dark-800/50 rounded-xl p-3 flex gap-2">
              <span className="text-lg flex-shrink-0">{insight.icon}</span>
              <p className={`text-xs leading-relaxed ${insight.color}`}>{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
