import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import useRealTimeTransactions from '../hooks/useRealTimeTransactions'

const CATEGORIES = ['Salary','Food & Dining','Rent','Transport','Entertainment','Health & Medical','Utilities','Shopping','EMI & Loans','Education','Travel','Investments','Other']


export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [filterCat, setFilterCat] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [recurringList, setRecurringList] = useState([])

  const [form, setForm] = useState({
    account_id: '', amount: '', merchant: '', transaction_type: 'DEBIT',
    category: 'Food & Dining', description: ''
  })
  const [recurringForm, setRecurringForm] = useState({
    merchant: '', amount: '', transaction_type: 'DEBIT',
    category: 'Food & Dining', frequency: 'monthly', next_date: ''
  })

  const fetchAll = useCallback(() => {
    setLoading(true)
    const params = filterCat ? '?category=' + filterCat : ''
    Promise.all([
      api.get('/api/transactions/' + params),
      api.get('/api/accounts/').catch(() => ({ data: [] })),
      api.get('/api/recurring/').catch(() => ({ data: [] }))
    ]).then(([txRes, accRes, recRes]) => {
      setTransactions(txRes.data || [])
      setAccounts(accRes.data || [])
      setRecurringList(recRes.data || [])
      if (accRes.data?.length > 0) {
        setForm(f => f.account_id ? f : { ...f, account_id: accRes.data[0].id })
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [filterCat])


  useEffect(() => { fetchAll() }, [fetchAll])

  useRealTimeTransactions(useCallback((newTxn) => {
    fetchAll()
  }, [fetchAll]))

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const accId = form.account_id || accounts[0]?.id
      if (!accId) { alert('Please add a bank account first!'); setSaving(false); return }
      await api.post('/api/transactions/', {
        account_id: accId,
        amount: parseFloat(form.amount),
        merchant: form.merchant,
        transaction_type: form.transaction_type,
        category: form.category,
        description: form.description,
        timestamp: new Date().toISOString()
      })
      setForm({ account_id: accId, amount: '', merchant: '', transaction_type: 'DEBIT', category: 'Food & Dining', description: '' })
      setShowAdd(false)
      showSuccess('Transaction added successfully!')
      fetchAll()
    } catch (e) { alert('Failed to add transaction') }
    finally { setSaving(false) }
  }

  const handleQuickDebit = async (merchant, amount, category) => {
    try {
      const accId = accounts[0]?.id
      if (!accId) { alert('Please add a bank account first!'); return }
      await api.post('/api/transactions/', {
        account_id: accId,
        amount: parseFloat(amount),
        merchant,
        transaction_type: 'DEBIT',
        category,
        description: 'Quick debit entry',
        timestamp: new Date().toISOString()
      })
      showSuccess('Rs.' + amount + ' debited from ' + merchant + ' added!')
      fetchAll()
    } catch (e) {}
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    try {
      await api.put('/api/transactions/' + editTxn.id, {
        merchant: editTxn.merchant,
        amount: parseFloat(Math.abs(editTxn.amount)),
        category: editTxn.category,
        description: editTxn.description || ''
      })
      setEditTxn(null)
      showSuccess('Transaction updated!')
      fetchAll()
    } catch (e) { alert('Failed to update') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this transaction?')) return
    try { await api.delete('/api/transactions/' + id); showSuccess('Deleted!'); fetchAll() }
    catch (e) { alert('Failed to delete') }
  }

  const handleAddRecurring = async (e) => {
    e.preventDefault()
    try {
      const accId = form.account_id || accounts[0]?.id
      if (!accId) { alert('Please add a bank account first!'); return }
      await api.post('/api/recurring/', {
        account_id: accId,
        merchant: recurringForm.merchant,
        amount: parseFloat(recurringForm.amount),
        category: recurringForm.category,
        transaction_type: recurringForm.transaction_type,
        frequency: recurringForm.frequency,
        next_date: new Date(recurringForm.next_date).toISOString()
      })
      setShowRecurring(false)
      setRecurringForm({ merchant: '', amount: '', transaction_type: 'DEBIT', category: 'Food & Dining', frequency: 'monthly', next_date: '' })
      showSuccess('Recurring transaction added!')
      fetchAll()
    } catch (e) {
      alert('Failed to add recurring transaction')
    }
  }

  const deleteRecurring = async (id) => {
    try {
      await api.delete('/api/recurring/' + id)
      showSuccess('Recurring transaction deleted!')
      fetchAll()
    } catch (e) {
      alert('Failed to delete recurring transaction')
    }
  }


  const today = new Date().toDateString()
  const todayTxns = transactions.filter(t => new Date(t.timestamp || t.created_at).toDateString() === today)
  const todaySpent = todayTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const todayIncome = todayTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  const filtered = transactions.filter(t => {
    const matchCat = !filterCat || t.category === filterCat
    const matchType = !filterType || (filterType === 'DEBIT' ? t.amount < 0 : t.amount > 0)
    const matchSearch = !search || (t.merchant || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchType && matchSearch
  })

  const grouped = {}
  filtered.forEach(t => {
    const d = new Date(t.timestamp || t.created_at).toDateString()
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(t)
  })
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <span>checkmark</span> {successMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-gray-400 text-sm mt-1">{transactions.length} total transactions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRecurring(true)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">Recurring</button>
          <button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">+ Add Transaction</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
          <div className="text-xs text-gray-400">Today Spent</div>
          <div className="text-xl font-bold text-red-400 mt-1">Rs.{Math.round(todaySpent).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">{todayTxns.filter(t=>t.amount<0).length} debits</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
          <div className="text-xs text-gray-400">Today Income</div>
          <div className="text-xl font-bold text-green-400 mt-1">Rs.{Math.round(todayIncome).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">{todayTxns.filter(t=>t.amount>0).length} credits</div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
          <div className="text-xs text-gray-400">Recurring</div>
          <div className="text-xl font-bold text-blue-400 mt-1">{recurringList.length}</div>
          <div className="text-xs text-gray-500 mt-1">auto transactions</div>
        </div>
      </div>

      <div className="bg-gray-800 border border-red-500/30 rounded-2xl p-5">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-lg">
          Quick Debit Entry
          <span className="text-xs text-gray-400 font-normal ml-1">— Add debit instantly</span>
        </h3>
        <QuickDebitForm accounts={accounts} onAdd={handleQuickDebit} />
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-indigo-500/30 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-white font-semibold mb-4 text-lg">Add Transaction</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
              <select value={form.account_id} onChange={e=>setForm({...form,account_id:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm col-span-2">
                <option value="">Select Account</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.bank_name} - {a.account_last4}</option>)}
              </select>
              <input value={form.merchant} onChange={e=>setForm({...form,merchant:e.target.value})} placeholder="Merchant / Payee" required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="Amount (Rs.)" required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <select value={form.transaction_type} onChange={e=>setForm({...form,transaction_type:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
                <option value="DEBIT">Debit (Expense)</option>
                <option value="CREDIT">Credit (Income)</option>
              </select>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description (optional)" className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm col-span-2" />
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-medium">
                {saving ? 'Adding...' : 'Add Transaction'}
              </button>
              <button type="button" onClick={()=>setShowAdd(false)} className="bg-gray-600 text-gray-400 py-2 rounded-xl text-sm">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {showRecurring && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-blue-500/30 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-white font-semibold text-lg">Recurring Transactions</h3>
            {recurringList.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recurringList.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-gray-700 rounded-xl p-3">
                    <div>
                      <p className="text-white text-sm font-medium">{r.merchant}</p>
                      <p className="text-gray-400 text-xs">{r.category} - Rs.{r.amount} - {r.frequency} - Next: {new Date(r.next_date).toLocaleDateString()}</p>

                    </div>
                    <button onClick={()=>deleteRecurring(r.id)} className="text-red-400 text-xs px-2 py-1 bg-gray-600 rounded-lg">Delete</button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleAddRecurring} className="grid grid-cols-2 gap-3">
              <input value={recurringForm.merchant} onChange={e=>setRecurringForm({...recurringForm,merchant:e.target.value})} placeholder="Merchant" required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <input type="number" value={recurringForm.amount} onChange={e=>setRecurringForm({...recurringForm,amount:e.target.value})} placeholder="Amount (Rs.)" required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <select value={recurringForm.category} onChange={e=>setRecurringForm({...recurringForm,category:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <select value={recurringForm.frequency} onChange={e=>setRecurringForm({...recurringForm,frequency:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input type="date" value={recurringForm.next_date} onChange={e=>setRecurringForm({...recurringForm,next_date:e.target.value})} required className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <select value={recurringForm.transaction_type} onChange={e=>setRecurringForm({...recurringForm,transaction_type:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-medium">Add Recurring</button>
              <button type="button" onClick={()=>setShowRecurring(false)} className="bg-gray-600 text-gray-400 py-2 rounded-xl text-sm">Close</button>
            </form>
          </div>
        </div>
      )}

      {editTxn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-yellow-500/30 rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-white font-semibold mb-4 text-lg">Edit Transaction</h3>
            <form onSubmit={handleEdit} className="grid grid-cols-2 gap-3">
              <input value={editTxn.merchant||''} onChange={e=>setEditTxn({...editTxn,merchant:e.target.value})} placeholder="Merchant" className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <input type="number" value={Math.abs(editTxn.amount)||''} onChange={e=>setEditTxn({...editTxn,amount:e.target.value})} placeholder="Amount" className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <select value={editTxn.category||''} onChange={e=>setEditTxn({...editTxn,category:e.target.value})} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input value={editTxn.description||''} onChange={e=>setEditTxn({...editTxn,description:e.target.value})} placeholder="Description" className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm" />
              <button type="submit" className="bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium">Update</button>
              <button type="button" onClick={()=>setEditTxn(null)} className="bg-gray-600 text-gray-400 py-2 rounded-xl text-sm">Cancel</button>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search merchant..." className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none w-48" />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
          <option value="">All Categories</option>
          {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm">
          <option value="">All Types</option>
          <option value="DEBIT">Debit Only</option>
          <option value="CREDIT">Credit Only</option>
        </select>
        {(filterCat||filterType||search) && <button onClick={()=>{setFilterCat('');setFilterType('');setSearch('')}} className="bg-red-500/20 text-red-400 px-3 py-2 rounded-xl text-sm">Clear</button>}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">💳</div>
          <p className="text-gray-500">No transactions found</p>
          <button onClick={()=>setShowAdd(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium">Add First Transaction</button>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const dayTxns = grouped[date]
            const daySpent = dayTxns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)
            const dayIncome = dayTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0)
            const isToday = date === today
            return (
              <div key={date} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-700/50 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">{isToday ? 'Today' : new Date(date).toLocaleDateString('en',{weekday:'long',month:'short',day:'numeric'})}</span>
                    <span className="text-gray-500 text-xs">{dayTxns.length} transactions</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    {dayIncome>0 && <span className="text-green-400">+Rs.{Math.round(dayIncome).toLocaleString()}</span>}
                    {daySpent>0 && <span className="text-red-400">-Rs.{Math.round(daySpent).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="divide-y divide-gray-700">
                  {dayTxns.map((t,i) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={"w-9 h-9 rounded-full flex items-center justify-center text-sm "+(t.amount>0?"bg-green-500/20":"bg-red-500/20")}>
                          {t.amount>0 ? '+' : '-'}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{t.merchant||'Unknown'}</p>
                          <p className="text-gray-500 text-xs">{t.category||'Others'} - {new Date(t.timestamp||t.created_at).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={"font-bold text-sm "+(t.amount>0?"text-green-400":"text-red-400")}>
                          {t.amount>0?'+':''}Rs.{Math.abs(t.amount).toLocaleString()}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>setEditTxn(t)} className="text-yellow-400 hover:text-yellow-300 text-xs bg-gray-600 px-2 py-1 rounded-lg">Edit</button>
                          <button onClick={()=>handleDelete(t.id)} className="text-red-400 hover:text-red-300 text-xs bg-gray-600 px-2 py-1 rounded-lg">Del</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QuickDebitForm({ accounts, onAdd }) {
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food & Dining')
  const [adding, setAdding] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (!accounts.length) { alert('Please add a bank account first!'); return }
    setAdding(true)
    await onAdd(merchant, amount, category)
    setMerchant('')
    setAmount('')
    setCategory('Food & Dining')
    setAdding(false)
  }

  return (
    <form onSubmit={handle} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-32">
        <label className="text-xs text-gray-400 mb-1 block">Merchant / Paid To</label>
        <input value={merchant} onChange={e=>setMerchant(e.target.value)} placeholder="e.g. Swiggy, Amazon..." required className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500" />
      </div>
      <div className="w-36">
        <label className="text-xs text-gray-400 mb-1 block">Amount Debited (Rs.)</label>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500" />
      </div>
      <div className="flex-1 min-w-36">
        <label className="text-xs text-gray-400 mb-1 block">Category</label>
        <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm">
          {['Food & Dining','Transport','Shopping','Utilities','Entertainment','Health & Medical','Education','EMI & Loans','Travel','Investments','Other'].map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button type="submit" disabled={adding} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
        {adding ? 'Adding...' : 'Debit Now'}
      </button>
    </form>
  )
}

