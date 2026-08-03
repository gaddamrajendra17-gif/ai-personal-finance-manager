import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function SecurityPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('security')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  
  // Simulated email states
  const [mockEmails, setMockEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [fetchingEmails, setFetchingEmails] = useState(false)
  
  // Privacy states
  const [privacySettings, setPrivacySettings] = useState({
    anonymize_data: true,
    enable_tracking: false
  })
  
  // Key rotation message feedback
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const fetchMockEmails = async () => {
    setFetchingEmails(true)
    try {
      const res = await api.get('/api/notifications/mock-emails')
      setMockEmails(res.data || [])
      if (res.data && res.data.length > 0) {
        setSelectedEmail(res.data[0])
      } else {
        setSelectedEmail(null)
      }
    } catch (e) {
      console.error('Error fetching mock emails:', e)
    } finally {
      setFetchingEmails(false)
    }
  }

  const handleClearEmails = async () => {
    try {
      await api.post('/api/notifications/mock-emails/clear')
      setMockEmails([])
      setSelectedEmail(null)
    } catch (e) {
      console.error('Failed to clear emails:', e)
    }
  }

  const fetchSecurityData = async () => {
    try {
      const res = await api.get('/api/security/stats')
      setStats(res.data)
      if (res.data?.privacy) {
        setPrivacySettings({
          anonymize_data: res.data.privacy.anonymize_data,
          enable_tracking: res.data.privacy.enable_tracking
        })
      }
    } catch (e) {
      console.error('Error fetching security stats:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityData()
  }, [])

  useEffect(() => {
    if (activeTab === 'email_sandbox') {
      fetchMockEmails()
    }
  }, [activeTab])

  const handleRotateKeys = async () => {
    setRotating(true)
    setFeedbackMsg(null)
    try {
      const res = await api.post('/api/security/rotate-keys')
      setFeedbackMsg({ type: 'success', text: res.data.message })
      // Update local last rotated stat
      setStats(prev => ({
        ...prev,
        encryption: {
          ...prev.encryption,
          last_rotated: res.data.timestamp
        }
      }))
      setTimeout(() => setFeedbackMsg(null), 7000)
    } catch (e) {
      setFeedbackMsg({ type: 'danger', text: 'Master key rotation failed.' })
    } finally {
      setRotating(false)
    }
  }

  const handlePrivacyChange = async (key, val) => {
    const updatedSettings = { ...privacySettings, [key]: val }
    setPrivacySettings(updatedSettings)
    setSavingPrivacy(true)
    try {
      const res = await api.post('/api/security/privacy-settings', updatedSettings)
      if (res.data?.status === 'success') {
        // Updated successfully
        setStats(prev => ({
          ...prev,
          privacy: res.data.settings
        }))
      }
    } catch (e) {
      console.error('Failed to save privacy settings', e)
    } finally {
      setSavingPrivacy(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-400 gap-2">
        <div className="animate-spin text-3xl">🔒</div>
        <div>Auditing Security & Trust Center...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header and Tab Toggle */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security & AI Trust</h1>
          <p className="text-gray-400 text-sm mt-1">Configure encryption keys, verify financial compliance, and audit the AI fraud protection engine.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-dark-800 rounded-2xl p-1 border border-dark-600 flex-wrap gap-1">
          {[
            { id: 'security', label: '🔒 Security & Compliance' },
            { id: 'fraud', label: '🛡️ AI Fraud Engine' },
            { id: 'embracing', label: '🧠 Embracing AI' },
            { id: 'email_sandbox', label: '✉️ Email Sandbox' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-primary text-dark-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
          feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {feedbackMsg.type === 'success' ? '✓ ' : '✗ '} {feedbackMsg.text}
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* AES-256 Encryption Status & Key Rotation */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 flex flex-col justify-between min-h-[350px]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔑</span>
                <div>
                  <h3 className="text-base font-bold text-white">Military-Grade Data Encryption</h3>
                  <p className="text-gray-400 text-xs mt-0.5">High entropy standards protecting all sensitive financial credentials</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-600">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Standard Enforced</span>
                  <span className="text-sm font-bold text-white mt-1 block">{stats.encryption.algorithm}</span>
                </div>
                <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-600">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Key Length & Tokenization</span>
                  <span className="text-sm font-bold text-emerald-400 mt-1 block">{stats.encryption.key_length_bits} Bits / {stats.encryption.tokenization_status}</span>
                </div>
              </div>

              <div className="bg-dark-900/40 border border-dark-600 rounded-2xl p-4 flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-500 block">Encryption Master Key Rotated:</span>
                  <span className="text-gray-300 font-semibold mt-0.5 block">{stats.encryption.last_rotated}</span>
                </div>
                <button
                  onClick={handleRotateKeys}
                  disabled={rotating}
                  className="bg-primary hover:opacity-90 text-dark-900 font-black px-4 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5"
                >
                  {rotating ? (
                    <span className="animate-spin">🔄</span>
                  ) : (
                    <span>🔄 Rotate Master Key</span>
                  )}
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-gray-500 leading-relaxed mt-4 italic">
              *Note: Rotating the master key immediately re-encrypts all linked bank tokens, transactions, and passwords in the database using the updated salt.*
            </p>
          </div>

          {/* Privacy Settings Switches */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">Privacy Controls</h3>
              <p className="text-gray-400 text-xs mt-0.5">Manage how your personal financial details are audited and shared.</p>
              
              <div className="space-y-4 pt-2">
                {/* Switch 1: Anonymize */}
                <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-2xl border border-dark-600">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-white block">Anonymize Data</span>
                    <span className="text-[9px] text-gray-500 leading-relaxed block mt-0.5">Scramble account numbers and identity headers in AI analysis.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={privacySettings.anonymize_data} 
                      onChange={e => handlePrivacyChange('anonymize_data', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Switch 2: Analytical Tracking */}
                <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-2xl border border-dark-600">
                  <div className="pr-3">
                    <span className="text-xs font-bold text-white block">Enable Tracking</span>
                    <span className="text-[9px] text-gray-500 leading-relaxed block mt-0.5">Allow anonymized usage streams to train global budget models.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={privacySettings.enable_tracking} 
                      onChange={e => handlePrivacyChange('enable_tracking', e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>

            {savingPrivacy && (
              <span className="text-[10px] text-primary text-center block mt-2 animate-pulse">Saving privacy settings...</span>
            )}
            
            <div className="text-[10px] text-gray-500 mt-4 leading-relaxed bg-dark-900/50 p-3 rounded-xl border border-dark-600">
              🔒 GDPR compliant configuration. You can change these options at any time.
            </div>
          </div>

          {/* Compliance & Standards Cards */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 space-y-4">
            <h3 className="text-base font-bold text-white">Compliance Checklist</h3>
            <p className="text-gray-400 text-xs">PFM compliance status under regulatory benchmarks.</p>
            
            <div className="space-y-3">
              {[
                { name: 'GDPR Compliance', status: stats.compliance.gdpr_compliant ? 'Passed' : 'Pending', details: 'All personal data can be deleted and exported.', color: 'text-emerald-400' },
                { name: 'SOC2 Security Audit', status: stats.compliance.soc2_audit, details: 'Strict audit validation of core data flow processes.', color: 'text-emerald-400' },
                { name: 'PCI-DSS Framework', status: stats.compliance.pci_dss_level, details: 'Tokenized transaction encryption standard score.', color: 'text-emerald-400' }
              ].map((c, i) => (
                <div key={i} className="bg-dark-900/50 border border-dark-600 rounded-2xl p-4 hover:border-primary/20 transition-all">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-white">{c.name}</span>
                    <span className={`text-[9px] font-extrabold uppercase ${c.color}`}>{c.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{c.details}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live Security Audit Log */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-4">
            <h3 className="text-base font-bold text-white">Live Security Audit Log</h3>
            <p className="text-gray-400 text-xs">Real-time telemetry showing successful compliance and encryption checks.</p>
            
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {stats.audit_logs.map((log, idx) => (
                <div key={idx} className="bg-dark-900/40 border border-dark-600 rounded-2xl p-3 flex justify-between items-center text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5">🟢</span>
                    <div>
                      <span className="text-gray-300 font-medium block">{log.event}</span>
                      <span className="text-[9px] text-gray-500 block mt-0.5">{log.timestamp}</span>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'fraud' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* ML Anomaly Stats */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 flex flex-col justify-between min-h-[350px]">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-base font-bold text-white">AI Fraud Engine</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Machine learning isolation models auditing account security</p>
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-600">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Classifier Model</span>
                  <span className="text-sm font-bold text-white mt-1 block">{stats.ai_fraud_engine.classifier}</span>
                </div>
                <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-600">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Model Precision Accuracy</span>
                  <span className="text-sm font-bold text-primary mt-1 block">{stats.ai_fraud_engine.accuracy_score_pct}% accuracy</span>
                </div>
                <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-600">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Spikes Logged</span>
                  <span className="text-sm font-bold text-white mt-1 block">
                    {stats.ai_fraud_engine.anomaly_spikes_detected} anomalies detected
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-indigo-950/20 border border-primary/20 p-3.5 rounded-2xl text-[10px] text-gray-400 mt-4 leading-relaxed">
              🛡️ **Fraud Shield Active**: AI continuously scans spending vectors (amount, time, category concentration) using dynamic Isolation Forest training to secure balance transfers.
            </div>
          </div>

          {/* Explanatory Fraud Engine Card */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-5">
            <h3 className="text-base font-bold text-white">How AI Anomaly & Fraud Isolation Works</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Traditional fraud checks only flag transactions that exceed fixed limit caps. The PFM AI uses an **Isolation Forest** model to look at clusters of behaviors.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-600 space-y-2">
                <span className="text-lg">📊</span>
                <h4 className="text-xs font-bold text-white">Vector Dimensions</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  The ML model models transactions as multi-dimensional vectors comprising ticket size, category ratio, weekend velocity, and location drift.
                </p>
              </div>

              <div className="bg-dark-900/50 p-4 rounded-2xl border border-dark-600 space-y-2">
                <span className="text-lg">🌲</span>
                <h4 className="text-xs font-bold text-white">Tree Partitioning</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  By constructing nested isolation trees, unusual patterns (outliers) isolate much faster (near the root of the trees) compared to nominal transactions.
                </p>
              </div>
            </div>

            <div className="border-t border-dark-700 pt-4">
              <h4 className="text-xs font-bold text-white mb-2">Real-Time Threat Detection Log</h4>
              {stats.ai_fraud_engine.anomaly_spikes_detected === 0 ? (
                <div className="bg-dark-900/30 p-4 rounded-2xl text-center text-xs text-gray-500 border border-dark-600">
                  No unusual spending anomalies detected. All accounts secure.
                </div>
              ) : (
                <div className="bg-rose-500/5 border border-rose-500/25 text-rose-400 p-4 rounded-2xl text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold">⚠️ Warning: Unusual spikes identified.</span>
                    <p className="text-[10px] text-gray-400 mt-1">Please review the Smart Analytics page to verify anomaly flag listings.</p>
                  </div>
                  <button 
                    onClick={() => navigate('/analytics')}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-3.5 py-2 rounded-xl text-[10px]"
                  >
                    View Anomalies
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'embracing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Benefits Summary */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h3 className="text-base font-bold text-white">Embracing AI in Personal Finance</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Recap of advantages and automated efficiency gains</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-dark-900/50 p-5 rounded-2xl border border-dark-600 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs text-primary font-bold">⚡</div>
                <h4 className="text-xs font-bold text-white">Automation & Efficiency</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Automated transfers audit cash flow balances to seamlessly move surpluses to savings targets without user intervention.
                </p>
              </div>

              <div className="bg-dark-900/50 p-5 rounded-2xl border border-dark-600 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-xs text-accent font-bold">🎯</div>
                <h4 className="text-xs font-bold text-white">Calculation Accuracy</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Eliminate manual calculations. The AI engine audits bank data to compute exact savings potentials and dynamic monthly contributions.
                </p>
              </div>

              <div className="bg-dark-900/50 p-5 rounded-2xl border border-dark-600 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xs text-purple-400 font-bold">📈</div>
                <h4 className="text-xs font-bold text-white">Speed of Analysis</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Scan thousands of transactions in milliseconds to flag suspicious velocity drift, unusual holiday spending, or budget consumption.
                </p>
              </div>

              <div className="bg-dark-900/50 p-5 rounded-2xl border border-dark-600 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-bold">🛡️</div>
                <h4 className="text-xs font-bold text-white">Risk Safeguards</h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Safety limit checks automatically pause auto-save triggers when liquid checking funds drop below a hard ₹10,000 threshold.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-bold text-white block">Adopting AI Tools with Confidence</span>
              <p className="text-[10px] text-gray-300 leading-relaxed">
                By merging high-performance algorithms like the scikit-learn Isolation Forest with bank-grade encryption protocols (AES-256), PFM ensures that automating operations is safe, compliant, and maximizes yield.
              </p>
            </div>
          </div>

          {/* Call to Actions Column */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">AI Action Hub</h3>
              <p className="text-gray-400 text-xs">Unlock your financial potential by engaging with the AI tool suite.</p>
              
              <div className="space-y-3 pt-1">
                {[
                  { title: 'Setup Auto-Save Strategy', desc: 'Execute checking-to-savings transfers with safety guards.', path: '/goals', btn: 'Go to Goals 🎯' },
                  { title: 'Analyze Spending Persona', desc: 'Run real-time behavior audits for wealth recommendations.', path: '/financial-advisor', btn: 'Go to AI Advisor 🧠' },
                  { title: 'Backtest Algorithmic Trading', desc: 'Simulate momentum and mean-reversion with mock capital.', path: '/trading', btn: 'Go to Trading ⚡' },
                  { title: 'Configure Robo-Advisor', desc: 'Get structured ETF allocations based on risk index quizzes.', path: '/robo-advisor', btn: 'Go to Robo-Advisor 🤖' }
                ].map((cta, idx) => (
                  <div key={idx} className="bg-dark-900/60 border border-dark-600 rounded-2xl p-4 space-y-3 hover:border-primary/20 transition-all">
                    <div>
                      <span className="text-xs font-bold text-white block">{cta.title}</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">{cta.desc}</p>
                    </div>
                    <button 
                      onClick={() => navigate(cta.path)}
                      className="w-full bg-dark-700 hover:bg-dark-600 border border-dark-500 text-primary font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-all"
                    >
                      {cta.btn}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <p className="text-[9px] text-gray-600 text-center leading-relaxed mt-3">
              Engaging with AI models increases cumulative surplus yields by up to 20% annually.
            </p>
          </div>

        </div>
      )}

      {activeTab === 'email_sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Left panel: Simulated Email log list */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-1 flex flex-col justify-between min-h-[450px]">
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Simulated Outbox</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Outgoing financial email alerts sandbox</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={fetchMockEmails} className="p-1.5 px-3 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-xl text-[10px] text-primary transition-all font-bold uppercase tracking-wider cursor-pointer">
                    Refresh
                  </button>
                  <button onClick={handleClearEmails} className="p-1.5 px-3 bg-red-950/30 hover:bg-red-900/30 border border-red-500/20 rounded-xl text-[10px] text-rose-400 transition-all font-bold uppercase tracking-wider cursor-pointer">
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="space-y-2.5 overflow-y-auto flex-1 max-h-[380px] pr-1">
                {fetchingEmails ? (
                  <div className="text-center text-gray-500 py-12 animate-pulse">Loading sent logs...</div>
                ) : mockEmails.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <span className="text-4xl block mb-2">📥</span>
                    <p className="text-xs">Email log is empty.</p>
                    <p className="text-[10px] text-gray-600 mt-1 max-w-[180px] mx-auto">Create a recurring transaction due soon to trigger automated email reminders.</p>
                  </div>
                ) : (
                  mockEmails.map(email => (
                    <div 
                      key={email.id} 
                      onClick={() => setSelectedEmail(email)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedEmail?.id === email.id 
                          ? 'bg-primary/10 border-primary/40' 
                          : 'bg-dark-900/40 border-dark-600 hover:border-dark-500'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xs font-bold text-white truncate max-w-[130px]">{email.subject}</span>
                        <span className="text-[9px] text-gray-500 shrink-0">
                          {new Date(email.sent_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate mt-1">To: {email.to}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Template preview frame */}
          <div className="bg-dark-800 border border-dark-500 rounded-3xl p-6 glass lg:col-span-2 flex flex-col min-h-[450px]">
            {selectedEmail ? (
              <div className="flex-1 flex flex-col space-y-4">
                <div className="border-b border-dark-600 pb-3">
                  <h4 className="text-sm font-extrabold text-white">{selectedEmail.subject}</h4>
                  <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                    <span>To: <strong className="text-gray-200">{selectedEmail.to}</strong></span>
                    <span>Sent: {new Date(selectedEmail.sent_at).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-2xl overflow-hidden p-4 min-h-[350px]">
                  <iframe 
                    srcDoc={selectedEmail.body} 
                    title="Email Preview"
                    className="w-full h-full border-none bg-white rounded-xl"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <span className="text-5xl mb-2">✉️</span>
                <p className="text-sm">Select a simulated email to preview the generated HTML template.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

