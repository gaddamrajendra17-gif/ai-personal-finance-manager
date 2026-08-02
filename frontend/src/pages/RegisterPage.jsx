import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', monthly_income: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await register({ ...form, monthly_income: parseFloat(form.monthly_income) || 0 })
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      const message = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
        : (typeof detail === 'string' ? detail : 'Registration failed.')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl mx-auto mb-4">💎</div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Start managing your finances with AI</p>
        </div>

        <div className="bg-dark-700 rounded-2xl border border-dark-500 p-6">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Rahul Sharma' },
              { key: 'email', label: 'Email', type: 'email', placeholder: 'rahul@example.com' },
              { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
              { key: 'monthly_income', label: 'Monthly Income (₹)', type: 'number', placeholder: '75000' },
              { key: 'password', label: 'Password', type: 'password', placeholder: 'Min 8 characters' },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  className="w-full bg-dark-800 border border-dark-400 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-colors"
                  placeholder={placeholder}
                  required={key !== 'phone'}
                />
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full bg-primary text-dark-900 font-bold rounded-lg py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Have an account?{' '}<Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
