import { useState, useEffect } from "react";
import useAuthStore from "../store/authStore";
import api from "../services/api";

export default function SplitExpensePage() {
  const { user } = useAuthStore();
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [splitWith, setSplitWith] = useState([]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await api.get("/api/groups/");
      setGroups(res.data || []);
      if (res.data && res.data.length > 0) {
        setActiveGroup(res.data[0]);
      }
    } catch (e) {
      console.error("Failed to fetch groups:", e);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || !members.trim()) return;
    const memberList = [user?.full_name || "You", ...members.split(",").map(m => m.trim()).filter(Boolean)];
    try {
      const res = await api.post("/api/groups/", { name: groupName, members: memberList });
      setGroups(prev => [...prev, res.data]);
      setActiveGroup(res.data);
      setGroupName(""); setMembers(""); setShowNewGroup(false);
    } catch (e) {
      console.error("Failed to create group:", e);
    }
  };

  const addExpense = async () => {
    if (!expenseDesc.trim() || !expenseAmount || !paidBy || splitWith.length === 0) return;
    try {
      const res = await api.post(`/api/groups/${activeGroup.id}/expenses`, {
        description: expenseDesc,
        amount: parseFloat(expenseAmount),
        paidBy,
        splitWith
      });
      setGroups(prev => prev.map(g => g.id === activeGroup.id ? res.data : g));
      setActiveGroup(res.data);
      setExpenseDesc(""); setExpenseAmount(""); setPaidBy(""); setSplitWith([]); setShowAddExpense(false);
    } catch (e) {
      console.error("Failed to add expense:", e);
    }
  };

  const settleUp = async (groupId, expenseId, settlementIdx) => {
    try {
      const res = await api.put(`/api/groups/${groupId}/expenses/${expenseId}/settlements/${settlementIdx}/settle`);
      setGroups(prev => prev.map(g => g.id === groupId ? res.data : g));
      setActiveGroup(res.data);
    } catch (e) {
      console.error("Failed to settle settlement:", e);
    }
  };

  const deleteGroup = async (id) => {
    try {
      await api.delete(`/api/groups/${id}`);
      setGroups(prev => prev.filter(g => g.id !== id));
      if (activeGroup?.id === id) setActiveGroup(null);
    } catch (e) {
      console.error("Failed to delete group:", e);
    }
  };

  const getBalances = (group) => {
    const balances = {};
    group.members.forEach(m => balances[m] = 0);
    group.expenses.forEach(e => {
      e.settlements.forEach(s => {
        if (!s.settled) {
          balances[s.from] = (balances[s.from] || 0) - s.amount;
          balances[s.to] = (balances[s.to] || 0) + s.amount;
        }
      });
    });
    return balances;
  };

  const totalExpenses = (group) => group.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">👨‍👩‍👧 Split Expense Manager</h1>
        <p className="text-orange-100 mt-1">Split bills with friends and family easily</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Groups list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Your Groups</h3>
            <button onClick={() => setShowNewGroup(true)}
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              + New Group
            </button>
          </div>

          {/* New group form */}
          {showNewGroup && (
            <div className="bg-dark-800 border border-orange-500/30 rounded-xl p-4 space-y-3">
              <h4 className="text-white text-sm font-semibold">Create Group</h4>
              <input value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="Group name (e.g. Goa Trip)"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              <input value={members} onChange={e => setMembers(e.target.value)}
                placeholder="Members (comma separated, e.g. Rahul, Priya)"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
              <div className="flex gap-2">
                <button onClick={createGroup} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-xs py-2 rounded-lg">Create</button>
                <button onClick={() => setShowNewGroup(false)} className="flex-1 bg-dark-600 text-gray-400 text-xs py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {groups.length === 0 && !showNewGroup && (
            <div className="bg-dark-800 border border-dark-500 rounded-xl p-6 text-center text-gray-500 text-sm">
              No groups yet.<br />Create one to start splitting!
            </div>
          )}

          {groups.map(g => (
            <div key={g.id} onClick={() => setActiveGroup(g)}
              className={`bg-dark-800 border rounded-xl p-4 cursor-pointer transition-all hover:border-orange-500/50 ${activeGroup?.id === g.id ? "border-orange-500/70" : "border-dark-500"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{g.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{g.members.length} members • {g.expenses.length} expenses</p>
                  <p className="text-orange-400 text-xs mt-1 font-medium">Rs.{totalExpenses(g).toLocaleString()} total</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                  className="text-gray-600 hover:text-red-400 text-xs">✕</button>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {g.members.map((m, i) => (
                  <span key={i} className="bg-dark-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Group detail */}
        <div className="md:col-span-2 space-y-4">
          {!activeGroup ? (
            <div className="bg-dark-800 border border-dark-500 rounded-2xl p-12 text-center text-gray-500">
              <div className="text-5xl mb-3">👈</div>
              <p>Select a group or create a new one</p>
            </div>
          ) : (
            <>
              {/* Group header */}
              <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-lg">{activeGroup.name}</h3>
                    <p className="text-gray-400 text-xs">Created {activeGroup.created}</p>
                  </div>
                  <button onClick={() => setShowAddExpense(true)}
                    className="bg-orange-600 hover:bg-orange-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                    + Add Expense
                  </button>
                </div>

                {/* Balances */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(getBalances(activeGroup)).map(([member, balance], i) => (
                    <div key={i} className={`rounded-xl p-3 text-center border ${balance > 0 ? "bg-green-500/10 border-green-500/30" : balance < 0 ? "bg-red-500/10 border-red-500/30" : "bg-dark-700 border-dark-500"}`}>
                      <p className="text-white text-xs font-medium">{member}</p>
                      <p className={`text-sm font-bold mt-1 ${balance > 0 ? "text-green-400" : balance < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {balance > 0 ? "gets back" : balance < 0 ? "owes" : "settled"}<br />
                        {balance !== 0 && `Rs.${Math.abs(balance).toLocaleString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add expense form */}
              {showAddExpense && (
                <div className="bg-dark-800 border border-orange-500/30 rounded-2xl p-5 space-y-3">
                  <h4 className="text-white font-semibold">Add Expense</h4>
                  <input value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)}
                    placeholder="What was it for? (e.g. Dinner at Pizza Hut)"
                    className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                  <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                    placeholder="Total amount (Rs.)"
                    className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Paid by:</p>
                    <div className="flex gap-2 flex-wrap">
                      {activeGroup.members.map(m => (
                        <button key={m} onClick={() => setPaidBy(m)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${paidBy === m ? "bg-orange-600 text-white" : "bg-dark-700 text-gray-400"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs mb-2">Split with:</p>
                    <div className="flex gap-2 flex-wrap">
                      {activeGroup.members.filter(m => m !== paidBy).map(m => (
                        <button key={m} onClick={() => setSplitWith(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${splitWith.includes(m) ? "bg-blue-600 text-white" : "bg-dark-700 text-gray-400"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  {expenseAmount && splitWith.length > 0 && (
                    <p className="text-orange-400 text-xs">Each person pays: Rs.{(parseFloat(expenseAmount) / (splitWith.length + 1)).toFixed(2)}</p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={addExpense} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-xl text-sm">Add</button>
                    <button onClick={() => setShowAddExpense(false)} className="flex-1 bg-dark-600 text-gray-400 py-2 rounded-xl text-sm">Cancel</button>
                  </div>
                </div>
              )}

              {/* Expenses list */}
              <div className="space-y-3">
                {activeGroup.expenses.length === 0 ? (
                  <div className="bg-dark-800 border border-dark-500 rounded-xl p-6 text-center text-gray-500 text-sm">No expenses yet. Add one!</div>
                ) : (
                  activeGroup.expenses.map(e => (
                    <div key={e.id} className="bg-dark-800 border border-dark-500 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-semibold text-sm">{e.description}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{e.date} • Paid by {e.paidBy}</p>
                        </div>
                        <span className="text-orange-400 font-bold">Rs.{e.amount.toLocaleString()}</span>
                      </div>
                      <div className="space-y-2">
                        {e.settlements.map((s, i) => (
                          <div key={i} className={`flex items-center justify-between rounded-lg p-2.5 ${s.settled ? "bg-green-500/10" : "bg-dark-700"}`}>
                            <p className="text-xs text-gray-300">
                              <span className="text-red-400 font-medium">{s.from}</span> owes <span className="text-green-400 font-medium">{s.to}</span> Rs.{s.amount}
                            </p>
                            {s.settled ? (
                              <span className="text-green-400 text-xs font-medium">✅ Settled</span>
                            ) : (
                              <button onClick={() => settleUp(activeGroup.id, e.id, i)}
                                className="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded-lg transition-colors">
                                Settle
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

