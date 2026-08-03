import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import api from "../services/api";

export default function GamificationPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [behavior, setBehavior] = useState(null);
  const [tab, setTab] = useState("badges");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, c, l, b] = await Promise.all([
        api.get("/api/gamification/profile"),
        api.get("/api/gamification/challenges"),
        api.get("/api/gamification/leaderboard"),
        api.get("/api/financial-advisor/behavior")
      ]);
      setProfile(p.data);
      setChallenges(c.data);
      setLeaderboard(l.data);
      setBehavior(b.data);
    } catch (e) {
      console.error("Error loading gamification dashboard", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const joinChallenge = async (id) => {
    try {
      await api.post(`/api/gamification/challenges/${id}/join`);
      setChallenges(prev => prev.map(c => c.id === id ? { ...c, joined: true } : c));
    } catch (e) {
      console.error(e);
    }
  };

  const getArchetypeDetails = (classification) => {
    switch (classification) {
      case 'FRUGAL_SAVER':
        return {
          title: '🌱 Sparing Sage',
          desc: 'A master of capital preservation and budget control. You prioritize security, keeping strict limits on daily spend.',
          strengths: 'High savings rate, disciplined outlays, and low impulse buying.',
          weakness: 'Potential cash drag. Directing surplus to growth assets yields higher compound wealth.',
          quests: [
            { text: 'Unlock the "Investor" badge by completing an algorithmic trading strategy backtest.', path: '/trading', btn: 'Go to Algo Trading ⚡' },
            { text: 'Complete the Robo-Advisor risk quiz to structure a balanced ETF portfolio allocation.', path: '/robo-advisor', btn: 'Go to Robo-Advisor 🤖' }
          ]
        };
      case 'IMPULSIVE':
        return {
          title: '🔥 Spree Enthusiast',
          desc: 'A passionate consumer. You value current experiences, but high dining and shopping frequencies trigger transaction velocity spikes.',
          strengths: 'Active spending flow; supports fluid discretionary accounts.',
          weakness: 'Susceptible to shopping surges and high leisure outlay concentration.',
          quests: [
            { text: 'Join the "No Food Delivery Week" challenge to audit dining budgets and earn 200 pts.', path: '/gamification', tabChange: 'challenges', btn: 'Go to Challenges ⚡' },
            { text: 'Keep categories within budgets to complete the "Stay Under Budget" challenge (+400 pts).', path: '/budgets', btn: 'Go to Budgets 🎯' }
          ]
        };
      case 'LIFESTYLE_INFLATED':
        return {
          title: '💸 Leisure Collector',
          desc: 'Your spending expands in lockstep with your income, leaving minimal surplus for compounding investments.',
          strengths: 'Strong monthly cash flow and solid income capacity.',
          weakness: 'Discretionary drift rises parallel to income, keeping net savings flat.',
          quests: [
            { text: 'Activate an AI Auto-Save strategy to lock in checking surpluses automatically.', path: '/goals', btn: 'Setup Auto-Save 🎯' },
            { text: 'Establish an automated checking-to-savings sweep to secure your monthly savings targets.', path: '/goals', btn: 'Go to Goals 🎯' }
          ]
        };
      default: // BALANCED
        return {
          title: '⚖️ Equilibrium Guru',
          desc: 'A pragmatic planner. You successfully match short-term enjoyment with stable, disciplined monthly savings.',
          strengths: 'Balanced budgets, steady investments, and low anomaly risks.',
          weakness: 'Can push performance further by automating surplus trading strategies.',
          quests: [
            { text: 'Run an advanced algorithmic crossover backtest (SMA/RSI) to optimize capital yield.', path: '/trading', btn: 'Run Backtester ⚡' },
            { text: 'Consult your strict AI advisor persona to review weekly transaction velocity.', path: '/financial-advisor', btn: 'Consult Advisor 🧠' }
          ]
        };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400 gap-2">
        <div className="animate-spin text-3xl">🏆</div>
        <div>Loading Rewards & Personalities...</div>
      </div>
    );
  }

  const archetype = behavior ? getArchetypeDetails(behavior.classification) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white glass shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">🏆 Rewards & Achievements</h1>
            <p className="text-indigo-200 text-sm mt-1">Grow your financial profile, complete challenges, and audit your archetype.</p>
          </div>
          <div className="text-left sm:text-right bg-white/15 px-5 py-3 rounded-2xl">
            <div className="text-3xl font-black">{profile?.total_points || 0}</div>
            <div className="text-indigo-200 text-[10px] uppercase font-bold tracking-wider mt-0.5">Total Points</div>
          </div>
        </div>
        
        {/* Level Progress */}
        {profile?.level && (
          <div className="mt-5 bg-black/15 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">{profile.level.icon} {profile.level.name} Level</span>
              <span className="text-xs text-indigo-200 font-semibold">Next: {profile.level.next_level}</span>
            </div>
            <div className="w-full bg-black/25 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary to-accent rounded-full h-2 transition-all duration-700"
                style={{ width: profile.level.points_to_next > 0 ? `${Math.min(100, (profile.total_points / (profile.total_points + profile.level.points_to_next)) * 100)}%` : "100%" }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-indigo-200 font-semibold mt-1.5">
              <span>{profile.total_points} Points</span>
              <span>{profile.level.points_to_next > 0 ? `${profile.level.points_to_next} pts to next level` : "Max level reached!"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary Widgets */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-dark-800 rounded-2xl p-4 text-center border border-dark-500 hover:border-primary/20 transition-all">
          <div className="text-xl font-bold text-yellow-400">{profile?.badges_earned || 0}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Badges Earned</div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-4 text-center border border-dark-500 hover:border-primary/20 transition-all">
          <div className="text-xl font-bold text-blue-400">{challenges.filter(c => c.joined).length}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Active Quests</div>
        </div>
        <div className="bg-dark-800 rounded-2xl p-4 text-center border border-dark-500 hover:border-primary/20 transition-all">
          <div className="text-xl font-bold text-green-400">{challenges.filter(c => c.completed).length}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Completed</div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-dark-800 rounded-2xl p-1 border border-dark-600">
        {[
          { id: "badges", label: "🎖️ Badges" },
          { id: "challenges", label: "⚡ Quests & Challenges" },
          { id: "archetype", label: "👤 Financial Archetype" },
          { id: "leaderboard", label: "🏅 Leaderboard" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              tab === t.id ? "bg-primary text-dark-900" : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Badges */}
      {tab === "badges" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
          {profile?.badges?.map(b => (
            <div
              key={b.key}
              className={`rounded-2xl p-4 border flex flex-col justify-between hover:border-primary/20 transition-all ${
                b.earned ? "bg-dark-800 border-indigo-500/50" : "bg-dark-800/40 border-dark-600 opacity-50"
              }`}
            >
              <div>
                <span className="text-3xl block mb-2">{b.icon}</span>
                <span className="font-bold text-xs text-white block">{b.name}</span>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{b.description}</p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-dark-700 flex justify-between items-center text-[10px]">
                <span className="text-gray-400 font-medium">Yield: {b.points} pts</span>
                <span className={`font-extrabold uppercase ${b.earned ? "text-yellow-400" : "text-gray-600"}`}>
                  {b.earned ? "Earned" : "Locked"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Challenges */}
      {tab === "challenges" && (
        <div className="space-y-3.5 animate-fade-in">
          {challenges.map(c => (
            <div key={c.id} className="bg-dark-800 border border-dark-500 rounded-3xl p-5 flex items-center justify-between hover:border-primary/10 transition-all">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{c.title}</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    +{c.points} PTS
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{c.description}</p>
                {c.joined && !c.completed && (
                  <div className="mt-3 max-w-sm space-y-1">
                    <div className="w-full bg-dark-600 rounded-full h-1.5 border border-dark-500">
                      <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (c.progress / c.target_value) * 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                      <span>Progress: {c.progress.toLocaleString()}</span>
                      <span>Target: {c.target_value.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="ml-4">
                {c.completed ? (
                  <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
                    Claimed
                  </span>
                ) : c.joined ? (
                  <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-2 rounded-xl">
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => joinChallenge(c.id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md"
                  >
                    Join Challenge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Archetype */}
      {tab === "archetype" && archetype && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Personality Breakdown Card */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 flex flex-col justify-between min-h-[360px]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <div>
                  <h3 className="text-base font-bold text-white">Financial Archetype</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Determined by transactional AI audits</p>
                </div>
              </div>

              <div className="bg-dark-900/60 p-5 rounded-2xl border border-dark-600 space-y-2.5">
                <span className="text-sm font-bold text-primary block">{archetype.title}</span>
                <p className="text-[11px] text-gray-300 leading-relaxed">{archetype.desc}</p>
              </div>

              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Strength</span>
                  <span className="text-xs text-emerald-400 font-semibold mt-0.5 block">{archetype.strengths}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Key Vulnerability</span>
                  <span className="text-xs text-rose-400 font-semibold mt-0.5 block">{archetype.weakness}</span>
                </div>
              </div>
            </div>
            
            <p className="text-[9px] text-gray-500 italic mt-5">
              *Your archetype updates automatically at the end of each weekly transactional review.*
            </p>
          </div>

          {/* AI Metrics & Dynamic Quests */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Archetype Metrics Breakdown</h3>
              <p className="text-gray-400 text-xs">AI-measured indices representing your financial behavior</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Leisure/Shopping Concentration", value: `${behavior.metrics.leisure_shopping_ratio}%`, icon: "🛍️" },
                { label: "Weekend Outlay Percentage", value: `${behavior.metrics.weekend_percentage}%`, icon: "🌅" },
                { label: "Daily Spending Velocity", value: `₹${behavior.metrics.daily_velocity.toLocaleString()}/day`, icon: "⚡" },
                { label: "Average Ticket Size", value: `₹${Math.round(behavior.metrics.average_transaction).toLocaleString()}`, icon: "💳" }
              ].map((m, idx) => (
                <div key={idx} className="bg-dark-900/50 p-4 rounded-2xl border border-dark-600 flex items-center gap-3">
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">{m.label}</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">{m.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quests */}
            <div className="border-t border-dark-700 pt-5 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-white">Tailored Archetype Quests</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Complete these quests specifically recommended for your archetype to boost saving yield and unlock points.</p>
              </div>

              <div className="space-y-3">
                {archetype.quests.map((q, idx) => (
                  <div key={idx} className="bg-dark-900/40 p-4 rounded-2xl border border-dark-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-primary/20 transition-all">
                    <p className="text-[11px] text-gray-300 leading-relaxed flex-1">
                      🎯 <span className="font-semibold ml-1">{q.text}</span>
                    </p>
                    <button
                      onClick={() => {
                        if (q.tabChange) {
                          setTab(q.tabChange);
                        } else {
                          navigate(q.path);
                        }
                      }}
                      className="bg-dark-700 hover:bg-dark-600 border border-dark-500 text-primary font-bold px-4 py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all self-stretch md:self-auto text-center"
                    >
                      {q.btn}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Tab 4: Leaderboard */}
      {tab === "leaderboard" && (
        <div className="space-y-2 animate-fade-in max-w-2xl mx-auto">
          {leaderboard.map((u, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 p-4 rounded-2xl border ${
                i === 0 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-dark-800 border-dark-500"
              }`}
            >
              <div className={`text-lg font-black w-8 text-center ${
                i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"
              }`}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm">
                {u.name?.[0] || "?"}
              </div>
              <div className="flex-1">
                <span className="font-bold text-sm text-white block">{u.name}</span>
                <span className="text-[10px] text-gray-500 mt-0.5 block">{u.badges} badges earned</span>
              </div>
              <div className="text-right">
                <div className="font-black text-sm text-indigo-400">{u.points}</div>
                <div className="text-[8px] uppercase tracking-wider text-gray-500 font-bold">Points</div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}


