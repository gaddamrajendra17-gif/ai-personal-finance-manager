import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";
import useRealTimeTransactions from "../hooks/useRealTimeTransactions";

const API = "http://localhost:8000";

const CATEGORY_COORDS = {
  "Food & Dining": { lat: 13.0827, lng: 80.2707, area: "Chennai - Food Street" },
  "Transport": { lat: 13.0674, lng: 80.2376, area: "Chennai - Central" },
  "Shopping": { lat: 13.0569, lng: 80.2425, area: "Chennai - T Nagar" },
  "Utilities": { lat: 13.0878, lng: 80.2785, area: "Chennai - Anna Nagar" },
  "Healthcare": { lat: 13.0524, lng: 80.2503, area: "Chennai - Nungambakkam" },
  "Entertainment": { lat: 13.0732, lng: 80.2609, area: "Chennai - Vadapalani" },
  "Education": { lat: 13.0389, lng: 80.2619, area: "Chennai - Guindy" },
  "Travel": { lat: 13.0450, lng: 80.2250, area: "Chennai - International Terminal" },
  "Investments": { lat: 13.0650, lng: 80.2550, area: "Chennai - Financial Hub" },
  "Others": { lat: 13.0604, lng: 80.2496, area: "Chennai City Centre" },
};

const COLORS = {
  "Food & Dining": "#f97316",
  "Transport": "#3b82f6",
  "Shopping": "#ec4899",
  "Utilities": "#eab308",
  "Healthcare": "#22c55e",
  "Entertainment": "#8b5cf6",
  "Education": "#06b6d4",
  "Travel": "#14b8a6",
  "Investments": "#10b981",
  "Others": "#6b7280"
};

const getCleanCategory = (cat) => {
  if (cat === "Health & Medical" || cat === "Healthcare") return "Healthcare";
  if (cat === "Other" || cat === "Others") return "Others";
  return cat || "Others";
};

export default function ExpenseMapPage() {
  const { token } = useAuthStore();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState("categories"); // "categories" or "transactions"
  const [newTxnIds, setNewTxnIds] = useState(new Set());
  const [pulseNewTxn, setPulseNewTxn] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch initial transaction history
  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/transactions/?limit=100`, { headers });
      setTransactions(res.data || []);
    } catch (e) {
      console.error("Failed to load map transactions:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle live updates via WebSocket
  useRealTimeTransactions((newTxn) => {
    // We only process DEBIT transactions for the map
    if (newTxn.transaction_type === "DEBIT" || newTxn.amount < 0) {
      setTransactions((prev) => {
        if (prev.some((t) => t.id === newTxn.id)) return prev;
        return [newTxn, ...prev];
      });

      // Add to set of new transactions to highlight them
      setNewTxnIds((prev) => {
        const next = new Set(prev);
        next.add(newTxn.id);
        return next;
      });

      // Pulse indicator on map
      setPulseNewTxn(true);
      setTimeout(() => setPulseNewTxn(false), 3000);

      // Remove the highlight flag after 12 seconds
      setTimeout(() => {
        setNewTxnIds((prev) => {
          const next = new Set(prev);
          next.delete(newTxn.id);
          return next;
        });
      }, 12000);
    }
  });

  const debits = transactions.filter((t) => t.transaction_type === "DEBIT" || t.amount < 0);
  const filteredDebits = filter === "all" ? debits : debits.filter((t) => getCleanCategory(t.category) === filter);

  // Compute category totals
  const categoryTotals = {};
  debits.forEach((t) => {
    const cat = getCleanCategory(t.category);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(t.amount);
  });

  const mapCategoryMarkers = Object.entries(categoryTotals).map(([cat, total]) => ({
    category: cat,
    total: Math.round(total),
    count: debits.filter((t) => getCleanCategory(t.category) === cat).length,
    coords: CATEGORY_COORDS[cat] || CATEGORY_COORDS["Others"],
    transactions: debits.filter((t) => getCleanCategory(t.category) === cat).slice(0, 5),
  }));

  const categories = [...new Set(debits.map((t) => getCleanCategory(t.category)))];

  // Helper to map lat/lng coordinates to percentage offsets in Chennai view boundary box
  // bounding box: lat 13.01 to 13.11, lng 80.19 to 80.30
  const getXYCoords = (lat, lng, category) => {
    const finalLat = lat || CATEGORY_COORDS[category]?.lat || CATEGORY_COORDS["Others"].lat;
    const finalLng = lng || CATEGORY_COORDS[category]?.lng || CATEGORY_COORDS["Others"].lng;
    
    const x = ((finalLng - 80.19) / 0.11) * 100;
    const y = ((13.11 - finalLat) / 0.10) * 100;

    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y)),
    };
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 text-gray-400 space-y-4">
      <div className="animate-spin text-4xl">⏳</div>
      <p className="text-sm font-semibold tracking-wider">LOADING SPENDING MAP...</p>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-3xl p-6 shadow-2xl text-white">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-yellow-300 via-pink-500 to-purple-800 pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗺️</span>
              <h1 className="text-3xl font-extrabold tracking-tight">Expense Map</h1>
            </div>
            <p className="text-indigo-100/90 text-sm mt-1">Visualize and monitor your real-time transactions geo-spatially.</p>
          </div>
          {/* Status Badge */}
          <div className="flex items-center bg-black/35 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl w-fit">
            <span className={`w-2.5 h-2.5 rounded-full mr-2.5 ${pulseNewTxn ? "bg-cyan-400 animate-ping" : "bg-emerald-400 animate-pulse"}`}></span>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-300">Live Sync Connected</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Filters + Map Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left pane: Options & Quick Stats */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* View Mode Toggle */}
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-4 shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Visualization Mode</h3>
            <div className="grid grid-cols-2 gap-2 bg-dark-900 p-1 rounded-xl">
              <button
                onClick={() => { setViewMode("categories"); setSelectedTxn(null); }}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === "categories" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/35" : "text-gray-400 hover:text-white"
                }`}
              >
                <span>📊</span> Category Clusters
              </button>
              <button
                onClick={() => { setViewMode("transactions"); setSelectedCategory(null); }}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === "transactions" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/35" : "text-gray-400 hover:text-white"
                }`}
              >
                <span>📍</span> Recent Spends (Live)
              </button>
            </div>
          </div>

          {/* Category Quick Filter */}
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-4 shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Filter Category</h3>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === "all" ? "bg-white/10 text-white border border-white/20" : "bg-dark-900/50 text-gray-400 border border-transparent hover:text-white"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all`}
                  style={{
                    backgroundColor: filter === cat ? `${COLORS[cat]}20` : "transparent",
                    color: filter === cat ? COLORS[cat] : "#9ca3af",
                    borderColor: filter === cat ? COLORS[cat] : "transparent",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Info / Live Logs */}
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-4 shadow-lg flex-1 min-h-[220px] flex flex-col justify-between">
            <div>
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Live Log Feed</h3>
              <div className="space-y-2 overflow-y-auto max-h-48 pr-1 scrollbar-thin">
                {debits.slice(0, 4).map((t) => {
                  const cleanCat = getCleanCategory(t.category);
                  const isNew = newTxnIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setViewMode("transactions");
                        setSelectedTxn(t);
                      }}
                      className={`flex justify-between items-center bg-dark-900/40 hover:bg-dark-700/40 p-2.5 rounded-xl cursor-pointer border transition-all ${
                        isNew ? "border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.2)] animate-pulse" : "border-transparent"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <p className="text-white text-xs font-semibold truncate">{t.merchant}</p>
                        <p className="text-[10px] text-gray-500 truncate">{cleanCat} • {new Date(t.timestamp || t.created_at).toLocaleTimeString()}</p>
                      </div>
                      <span className="text-xs font-extrabold text-red-400 shrink-0">
                        -Rs.{Math.abs(t.amount).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                {debits.length === 0 && (
                  <div className="text-center text-xs text-gray-500 py-6">No dynamic transactions recorded.</div>
                )}
              </div>
            </div>
            
            <div className="pt-3 border-t border-dark-500 mt-3 flex justify-between items-center text-xs text-gray-400">
              <span>Total Transactions: <strong className="text-white">{debits.length}</strong></span>
              <span>Spent on Map: <strong className="text-red-400">Rs.{Math.round(debits.reduce((acc, t) => acc + Math.abs(t.amount), 0)).toLocaleString()}</strong></span>
            </div>
          </div>

        </div>

        {/* Right pane: Interactive Map Visualizer */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 text-lg">📍</span>
                <h3 className="text-white font-semibold">City Map Visualization — Chennai</h3>
              </div>
              <span className="text-xs text-gray-400">Bounds: 10km radius</span>
            </div>

            {/* Simulated Vector Grid Map */}
            <div className="relative bg-gradient-to-br from-[#0c1020] via-[#0f172a] to-[#1e1e38] rounded-2xl overflow-hidden flex-1 min-h-[420px] border border-dark-600 shadow-inner">
              
              {/* Radar Radial Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.06)_1px,_transparent_100%)] bg-[size:24px_24px] pointer-events-none"></div>
              
              {/* Radar Rings */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-indigo-500/5 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full border border-indigo-500/5 pointer-events-none"></div>

              {/* City Map Roads/Features Mock representation */}
              <div className="absolute inset-0 opacity-15 pointer-events-none">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  {/* Mock Rivers / Coastline */}
                  <path d="M 0,150 Q 200,100 400,280 T 800,250" fill="none" stroke="#22d3ee" strokeWidth="8" />
                  <path d="M 150,0 Q 220,180 180,380 T 320,800" fill="none" stroke="#3b82f6" strokeWidth="3" />
                  {/* Mock major roads */}
                  <line x1="0" y1="200" x2="800" y2="200" stroke="#475569" strokeWidth="1.5" />
                  <line x1="400" y1="0" x2="400" y2="800" stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d="M 50,50 L 750,750" stroke="#334155" strokeWidth="1" />
                </svg>
              </div>

              {/* Chennai Anchor Labels */}
              <div className="absolute bottom-4 left-4 text-white/30 text-[10px] font-bold uppercase tracking-widest pointer-events-none">Chennai, TN, India</div>
              <div className="absolute top-4 right-4 text-white/30 text-[10px] font-bold uppercase tracking-widest pointer-events-none">Bay of Bengal</div>

              {debits.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 space-y-2">
                  <div className="text-3xl">🏜️</div>
                  <p className="text-xs">No expense coordinates recorded yet.</p>
                </div>
              ) : (
                <>
                  {/* 1. Category Clusters Mode */}
                  {viewMode === "categories" &&
                    mapCategoryMarkers.map((m, i) => {
                      const { x, y } = getXYCoords(m.coords.lat, m.coords.lng, m.category);
                      const isSelected = selectedCategory?.category === m.category;
                      const size = Math.max(48, Math.min(85, (m.total / 1200) * 12 + 48));

                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedCategory(isSelected ? null : m)}
                          className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 hover:scale-110 z-10"
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          <div className="relative flex flex-col items-center">
                            {/* Inner Bubble */}
                            <div
                              className={`rounded-full flex flex-col items-center justify-center text-white shadow-[0_0_20px_rgba(0,0,0,0.5)] border-2 transition-all duration-300 ${
                                isSelected ? "border-white ring-4 ring-indigo-500/40" : "border-white/20"
                              }`}
                              style={{
                                width: size,
                                height: size,
                                backgroundColor: COLORS[m.category] || "#6366f1",
                              }}
                            >
                              <span className="text-[10px] font-black">
                                ₹{m.total >= 1000 ? (m.total / 1000).toFixed(1) + "k" : m.total}
                              </span>
                              <span className="text-[8px] opacity-85">{m.count} txs</span>
                            </div>
                            
                            {/* Label */}
                            <div className="mt-1.5 px-2 py-0.5 bg-dark-950/80 border border-dark-500 rounded text-[9px] font-bold text-gray-200 whitespace-nowrap shadow-md">
                              {m.category}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {/* 2. Individual Transactions Pins Mode */}
                  {viewMode === "transactions" &&
                    filteredDebits.slice(0, 35).map((t, idx) => {
                      const { x, y } = getXYCoords(t.latitude, t.longitude, t.category);
                      const isSelected = selectedTxn?.id === t.id;
                      const isNew = newTxnIds.has(t.id);
                      const cleanCat = getCleanCategory(t.category);
                      const color = COLORS[cleanCat] || "#6b7280";

                      return (
                        <div
                          key={t.id || idx}
                          onClick={() => setSelectedTxn(isSelected ? null : t)}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 hover:scale-125 ${
                            isSelected ? "z-30 scale-125" : "z-20 hover:z-30"
                          }`}
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          <div className="relative flex items-center justify-center">
                            
                            {/* Live transaction pulse radar */}
                            {isNew && (
                              <span className="absolute -inset-3 rounded-full bg-cyan-400 opacity-75 animate-ping pointer-events-none" />
                            )}
                            
                            {/* Glowing ring under selected marker */}
                            {isSelected && (
                              <span className="absolute -inset-2 rounded-full opacity-60 animate-pulse pointer-events-none" style={{ backgroundColor: color }} />
                            )}

                            {/* Pin shape */}
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center border text-[11px] shadow-lg transition-all duration-300 ${
                                isSelected ? "border-white" : "border-transparent"
                              }`}
                              style={{
                                backgroundColor: color,
                                boxShadow: `0 0 12px ${color}80`,
                              }}
                            >
                              📍
                            </div>

                            {/* Label for new/selected transactions */}
                            {(isSelected || isNew) && (
                              <div className="absolute bottom-8 px-2 py-1 bg-dark-900 border border-dark-500 rounded-xl shadow-2xl text-[9px] text-white font-bold whitespace-nowrap z-50">
                                <p className="text-cyan-400">{t.merchant}</p>
                                <p className="text-gray-300">₹{Math.abs(t.amount).toLocaleString()}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Details Box Layer: Displays details of selected categories or markers */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Category Details Panel */}
        <div className="md:col-span-6">
          {selectedCategory ? (
            <div
              className="bg-dark-800 border rounded-3xl p-5 space-y-4 shadow-xl transition-all"
              style={{ borderColor: `${COLORS[selectedCategory.category]}50` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[selectedCategory.category] }}></div>
                  <h3 className="text-white font-bold text-base">{selectedCategory.category} Cluster</h3>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-gray-400 hover:text-white bg-dark-900/50 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-dark-900 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Spent</span>
                  <div className="text-xl font-black text-red-400 mt-0.5">Rs.{selectedCategory.total.toLocaleString()}</div>
                </div>
                <div className="bg-dark-900 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Transaction Count</span>
                  <div className="text-xl font-black text-blue-400 mt-0.5">{selectedCategory.count}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top Spends in this cluster</h4>
                {selectedCategory.transactions.map((t, idx) => (
                  <div key={t.id || idx} className="flex justify-between items-center bg-dark-900/40 p-2.5 rounded-xl hover:bg-dark-700/35 transition-colors">
                    <div>
                      <p className="text-white text-xs font-bold">{t.merchant}</p>
                      <p className="text-[10px] text-gray-500">{new Date(t.timestamp || t.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs font-extrabold text-red-400">
                      -Rs.{Math.abs(t.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-dark-800/40 border border-dark-600 rounded-3xl p-6 text-center text-gray-500 h-full flex items-center justify-center flex-col space-y-2">
              <span className="text-3xl">📊</span>
              <p className="text-xs">Click a Category Cluster bubble on the map to view detailed statistics.</p>
            </div>
          )}
        </div>

        {/* Transaction Location Details Panel */}
        <div className="md:col-span-6">
          {selectedTxn ? (
            <div
              className="bg-dark-800 border rounded-3xl p-5 space-y-4 shadow-xl transition-all"
              style={{ borderColor: `${COLORS[getCleanCategory(selectedTxn.category)]}50` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📍</span>
                  <h3 className="text-white font-bold text-base">Spend Location Details</h3>
                </div>
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="text-gray-400 hover:text-white bg-dark-900/50 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="bg-dark-900 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-white font-extrabold text-lg">{selectedTxn.merchant}</h4>
                    <p className="text-xs text-indigo-400 font-semibold">{getCleanCategory(selectedTxn.category)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-red-400">-Rs.{Math.abs(selectedTxn.amount).toLocaleString()}</span>
                  </div>
                </div>

                <div className="border-t border-dark-600 pt-3 grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-500 font-medium">Timestamp:</span>
                    <p className="text-gray-300">{new Date(selectedTxn.timestamp || selectedTxn.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Coordinates:</span>
                    <p className="text-gray-300 font-mono">
                      {selectedTxn.latitude ? selectedTxn.latitude.toFixed(4) : "13.0827"}, {selectedTxn.longitude ? selectedTxn.longitude.toFixed(4) : "80.2707"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 font-medium">Mock Location Name:</span>
                    <p className="text-gray-300 italic">
                      {CATEGORY_COORDS[getCleanCategory(selectedTxn.category)]?.area || "Chennai City Area"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-dark-800/40 border border-dark-600 rounded-3xl p-6 text-center text-gray-500 h-full flex items-center justify-center flex-col space-y-2">
              <span className="text-3xl">📍</span>
              <p className="text-xs">Switch to "Recent Spends" view and click any location pin to see transaction receipts.</p>
            </div>
          )}
        </div>

      </div>

      {/* Grid summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mapCategoryMarkers
          .sort((a, b) => b.total - a.total)
          .map((m, i) => (
            <div
              key={i}
              onClick={() => {
                setViewMode("categories");
                setSelectedCategory(m);
              }}
              className="bg-dark-800 border border-dark-500 hover:border-dark-400 rounded-2xl p-4 cursor-pointer hover:shadow-xl hover:scale-102 transition-all"
              style={{ borderLeftWidth: "4px", borderLeftColor: COLORS[m.category] }}
            >
              <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{m.category}</div>
              <div className="text-red-400 font-black text-lg mt-1">Rs.{m.total.toLocaleString()}</div>
              <div className="text-[11px] text-gray-500 mt-1">{m.count} transactions</div>
              <div className="text-[10px] text-indigo-400/80 font-medium mt-1.5 truncate">📍 {m.coords.area}</div>
            </div>
          ))}
      </div>

    </div>
  );
}

