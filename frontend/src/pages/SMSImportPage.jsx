import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";


const API = "http://localhost:8000";

export default function SMSImportPage() {
  const { token, user } = useAuthStore();
  const [smsText, setSmsText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("manual"); // "manual" or "auto"
  const [webhookInfo, setWebhookInfo] = useState(null);

  const [simStatus, setSimStatus] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const simulatedAlerts = [
    { sender: "HDFC", text: "Your HDFC a/c XX4321 debited Rs.450 on 22-05-26 to Zomato UPI. Ref: 987654321." },
    { sender: "SBI", text: "Your SBI a/c XX1234 debited Rs.1200 on 22-05-26 to Uber. Ref: 234567890." },
    { sender: "ICICI", text: "Rs.45000 credited to your ICICI a/c XX7890 from Google Pay Salary on 22-05-26." },
    { sender: "AXIS", text: "Your AXIS a/c XX5678 debited Rs.950 on 22-05-26. Info: Amazon shopping." },
    { sender: "KOTAK", text: "Your KOTAK a/c XX6543 debited Rs.250 on 22-05-26 to Starbucks. Ref: 876543210." }
  ];

  const runSMSSimulation = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    const initialStatus = simulatedAlerts.map(alert => ({
      sender: alert.sender,
      text: alert.text,
      status: "idle",
      details: ""
    }));
    setSimStatus(initialStatus);

    for (let i = 0; i < simulatedAlerts.length; i++) {
      setSimStatus(prev => {
        const copy = [...prev];
        copy[i].status = "sending";
        return copy;
      });

      try {
        const res = await axios.post(`${API}/api/sms/webhook`, {
          phone: user?.phone || "demo@pfm.com",
          message: simulatedAlerts[i].text,
          sender: simulatedAlerts[i].sender
        }, { headers });

        if (res.data.success) {
          const t = res.data.transaction;
          setSimStatus(prev => {
            const copy = [...prev];
            copy[i].status = "success";
            copy[i].details = `${t.merchant} (${t.category}): ₹${t.amount}`;
            return copy;
          });
          window.dispatchEvent(new CustomEvent('new-transaction-event'));
        } else {
          setSimStatus(prev => {
            const copy = [...prev];
            copy[i].status = "error";
            copy[i].details = res.data.message || "Parse fail";
            return copy;
          });
        }
      } catch (e) {
        setSimStatus(prev => {
          const copy = [...prev];
          copy[i].status = "error";
          copy[i].details = "Network error";
          return copy;
        });
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    setIsSimulating(false);
  };

  useEffect(() => {
    axios.get(`${API}/api/sms/webhook-url`, { headers })
      .then(res => setWebhookInfo(res.data))
      .catch(() => {});
  }, []);


  const parseSMS = async () => {
    if (!smsText.trim()) return;
    setLoading(true);
    setParsed(null);
    setError("");
    setSuccess(false);
    try {
      const res = await axios.post(`${API}/api/sms/parse`, { sms_text: smsText }, { headers });
      if (res.data.success) {
        setParsed(res.data.parsed);
      } else {
        setError("Could not detect a bank transaction. Please paste a valid bank SMS.");
      }
    } catch (e) {
      setError("Failed to parse SMS. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const saveTransaction = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await axios.post(`${API}/api/sms/webhook`, {
        phone: "manual",
        message: smsText,
        sender: "MANUAL"
      }, { headers });
      if (res.data.success) {
        setSuccess(true);
        setSmsText("");
        setParsed(null);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(res.data.message || "Failed to save transaction.");
      }
    } catch (e) {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const exampleSMS = [
    "Your SBI a/c XXXX1234 debited Rs.850 on 16-03-26 to Swiggy UPI. Ref No: 123456789.",
    "Rs.15000 credited to your SBI a/c XXXX1234 from EMPLOYER SALARY on 16-03-26.",
    "Your a/c XX1234 debited by Rs.1200 on 16/03/26. Info: UPI/AMAZON. Avl Bal: Rs.8800.",
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">📱 Transaction Auto-Ingestion</h1>
        <p className="text-green-100 mt-1">Automate or manually parse SMS transaction alerts from your banks</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-dark-800 p-1.5 rounded-xl border border-dark-500">
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "manual"
              ? "bg-green-600 text-white shadow-lg"
              : "text-gray-400 hover:text-white"
          }`}
        >
          ✍️ Manual SMS Paste
        </button>
        <button
          onClick={() => setActiveTab("auto")}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "auto"
              ? "bg-green-600 text-white shadow-lg"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🤖 Auto-Forwarding Webhook
        </button>
      </div>

      {activeTab === "manual" && (
        <>
          {/* Success message */}
          {success && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-green-400 font-semibold">Transaction added successfully!</p>
                <p className="text-green-300 text-sm">Check your Transactions page to see it.</p>
              </div>
            </div>
          )}

          {/* SMS Input */}
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-4">
            <label className="text-white font-semibold text-sm">Paste your bank SMS here:</label>
            <textarea
              value={smsText}
              onChange={(e) => { setSmsText(e.target.value); setParsed(null); setError(""); setSuccess(false); }}
              placeholder="Example: Your SBI a/c XXXX1234 debited Rs.500 on 16-03-26 to Swiggy UPI. Ref No: 123456789."
              className="w-full h-32 bg-dark-700 border border-dark-500 rounded-xl p-3 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-green-500"
            />
            <div className="flex gap-3">
              <button
                onClick={parseSMS}
                disabled={!smsText.trim() || loading}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                {loading ? "⏳ Detecting..." : "🔍 Detect Transaction"}
              </button>
              {smsText && (
                <button
                  onClick={() => { setSmsText(""); setParsed(null); setError(""); }}
                  className="px-4 bg-dark-600 hover:bg-dark-500 text-gray-400 rounded-xl transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Parsed Result */}
          {parsed && (
            <div className="bg-dark-800 border border-green-500/30 rounded-2xl p-5 space-y-4">
              <h3 className="text-white font-semibold">✅ Transaction Detected</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-700 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Amount</div>
                  <div className={`text-xl font-bold mt-1 ${parsed.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                    {parsed.amount > 0 ? "+" : ""}₹{Math.abs(parsed.amount).toLocaleString()}
                  </div>
                </div>
                <div className="bg-dark-700 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Type</div>
                  <div className={`text-sm font-bold mt-1 ${parsed.type === "CREDIT" ? "text-green-400" : "text-red-400"}`}>
                    {parsed.type === "CREDIT" ? "💰 Credit" : "💸 Debit"}
                  </div>
                </div>
                <div className="bg-dark-700 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Merchant</div>
                  <div className="text-sm font-semibold text-white mt-1">{parsed.merchant}</div>
                </div>
                <div className="bg-dark-700 rounded-xl p-3">
                  <div className="text-xs text-gray-400">Category</div>
                  <div className="text-sm font-semibold text-indigo-400 mt-1">{parsed.category}</div>
                </div>
              </div>
              <div className="bg-dark-700 rounded-xl p-3">
                <div className="text-xs text-gray-400">Description</div>
                <div className="text-sm text-white mt-1">{parsed.description}</div>
              </div>
              <button
                onClick={saveTransaction}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-lg"
              >
                {saving ? "⏳ Saving..." : "➕ Add to Transactions"}
              </button>
            </div>
          )}

          {/* Example SMS */}
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-3">
            <h3 className="text-gray-400 text-sm font-semibold">💡 Try these example SMS messages:</h3>
            {exampleSMS.map((sms, i) => (
              <div
                key={i}
                onClick={() => { setSmsText(sms); setParsed(null); setError(""); }}
                className="bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded-xl p-3 cursor-pointer transition-colors"
              >
                <p className="text-xs text-gray-300 leading-relaxed">{sms}</p>
                <p className="text-xs text-green-500 mt-1">Click to use this example →</p>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "auto" && (
        <div className="space-y-6">
          {/* Live SMS Ingestion Simulator */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-500/20 rounded-2xl p-5 space-y-4 text-left animate-fade-in">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                🤖 Webhook Simulation Center
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Test your auto-ingestion system instantly without configuring a physical device. Click the button below to trigger 5 simulated banking transactions sequentially. You will see real-time updates and push notifications as the parser processes each message.
              </p>
            </div>

            <button
              onClick={runSMSSimulation}
              disabled={isSimulating}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/40"
            >
              {isSimulating ? "⏳ Simulating Alerts..." : "📱 Simulate 5 Live SMS Alerts"}
            </button>

            {simStatus.length > 0 && (
              <div className="space-y-2 mt-3 bg-dark-900/60 p-3 rounded-xl border border-dark-600/50">
                {simStatus.map((alert, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-dark-700/50 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        alert.status === 'success' ? 'bg-emerald-400' :
                        alert.status === 'sending' ? 'bg-amber-400 animate-ping' :
                        alert.status === 'error' ? 'bg-rose-500' : 'bg-gray-600'
                      }`}></span>
                      <span className="font-semibold text-gray-300">{alert.sender}:</span>
                      <span className="text-gray-400 font-mono text-[10px] leading-tight line-clamp-1">{alert.text}</span>
                    </div>
                    <div className="flex-shrink-0 font-medium">
                      {alert.status === 'sending' && <span className="text-amber-400">Processing...</span>}
                      {alert.status === 'success' && <span className="text-emerald-400 font-bold">{alert.details}</span>}
                      {alert.status === 'error' && <span className="text-rose-400">Failed: {alert.details}</span>}
                      {alert.status === 'idle' && <span className="text-gray-500">Pending</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              🤖 Real-time Auto-Ingestion Webhook
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed text-left">
              You can automatically sync bank transactions in real-time as soon as you receive a transaction SMS from your bank. Follow the steps below to configure your phone to forward incoming SMS messages directly to your PFM account.
            </p>

            <div className="space-y-3 text-left">
              <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Your Webhook URL</div>
                <div className="text-sm font-mono text-green-400 mt-1 select-all break-all bg-dark-900 px-3 py-2 rounded-lg border border-dark-500/50">
                  {webhookInfo?.webhook_url || `${API}/api/sms/webhook`}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-700 rounded-xl p-3 border border-dark-600">
                  <div className="text-xs text-gray-400 font-bold uppercase">HTTP Method</div>
                  <div className="text-sm font-semibold text-white mt-1">POST</div>
                </div>
                <div className="bg-dark-700 rounded-xl p-3 border border-dark-600">
                  <div className="text-xs text-gray-400 font-bold uppercase">Content-Type</div>
                  <div className="text-sm font-semibold text-white mt-1">application/json</div>
                </div>
              </div>

              <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Request Body Template</div>
                <pre className="text-xs font-mono text-indigo-300 bg-dark-900 p-3 rounded-lg border border-dark-500/50 overflow-x-auto">
{`{
  "phone": "+91XXXXXXXXXX",
  "message": "[SMS Body Text]"
}`}
                </pre>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-4 text-left">
            <h3 className="text-white font-semibold text-sm">💡 Step-by-Step Guide using MacroDroid (Android)</h3>
            <ol className="list-decimal list-inside space-y-3 text-xs text-gray-300 leading-relaxed">
              <li>
                Download <span className="text-green-400 font-semibold">MacroDroid</span> from the Google Play Store on your Android device.
              </li>
              <li>
                Create a new Macro named <span className="text-white font-semibold">"PFM SMS Sync"</span>.
              </li>
              <li>
                Add a <span className="text-indigo-400 font-semibold">Trigger</span>:
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400">
                  <li>Select <strong>Device Events</strong> &gt; <strong>SMS Received</strong></li>
                  <li>Choose <strong>Select Sender(s)</strong> (Any Sender, or specify your bank names like <em>SBI, HDFC, ICICI</em>)</li>
                  <li>Choose <strong>Any Content</strong></li>
                </ul>
              </li>
              <li>
                Add an <span className="text-yellow-400 font-semibold">Action</span>:
                <ul className="list-disc list-inside ml-6 mt-1 text-gray-400 font-mono">
                  <li>Select <strong>Applications</strong> &gt; <strong>HTTP POST</strong></li>
                  <li>Enter the <strong>Webhook URL</strong> listed above</li>
                  <li>Set Content Type to <strong>application/json</strong></li>
                  <li>
                    Enter Body/Payload: <code>{"{\"phone\": \"{sms_sender}\", \"message\": \"{sms_message}\"}"}</code>
                  </li>
                </ul>
              </li>
              <li>
                Save the Macro. That's it! Every time you receive a transaction SMS, it will be automatically sent, parsed, and logged in your dashboard in real-time.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>

  );
}

