import { useState, useEffect, useRef } from "react";
import axios from "axios";
import useAuthStore from "../store/authStore";

const API = "http://localhost:8000";

export default function VoicePage() {
  const { token } = useAuthStore();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(true);
  const [history, setHistory] = useState([]);
  const recognitionRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const [kbdInput, setKbdInput] = useState("");

  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  };


  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setSupported(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        parseVoice(t);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => { setError("Microphone error: " + e.error); setListening(false); };
    recognitionRef.current = recognition;
  }, []);

  const parseVoice = async (text) => {
    setError("");
    try {
      const res = await axios.post(`${API}/api/chat/voice/parse`, { transcript: text }, { headers });
      if (res.data && res.data.success) {
        const p = res.data.parsed;
        setParsed(p);
        const isCredit = p.type === "CREDIT";
        const amt = Math.abs(p.amount);
        const speechMsg = isCredit
          ? `Parsed income of ${amt} rupees from ${p.merchant}. Click Add Transaction to save.`
          : `Parsed expense of ${amt} rupees for ${p.merchant}. Click Add Transaction to save.`;
        speakText(speechMsg);
        return;
      }
    } catch (e) {
      console.warn("Backend voice parse failed, falling back to local parsing rules.");
    }

    const t = text.toLowerCase();
    // Extract amount
    const amountMatch = t.match(/(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr)?/i) ||
                        t.match(/(?:rupees?|rs\.?)\s*(\d+(?:\.\d{1,2})?)/i);
    if (!amountMatch) { setError("Could not detect amount. Try saying 'Add 500 rupees for Swiggy'"); return; }
    const amount = parseFloat(amountMatch[1]);

    // Detect type
    const isCredit = /received|credited|got|income|salary|earned/i.test(t);

    // Extract merchant/description
    const forMatch = t.match(/(?:for|at|to|from|on)\s+([a-z\s]+?)(?:\s+food|\s+shopping|\s+transport|\s+bill|$)/i);
    const merchant = forMatch ? forMatch[1].trim() : "Unknown";

    // Detect category
    const categories = {
      "Food & Dining": ["food","swiggy","zomato","restaurant","eat","lunch","dinner","breakfast","coffee","cafe"],
      "Transport": ["uber","ola","auto","bus","petrol","fuel","metro","travel","transport","rapido"],
      "Shopping": ["amazon","flipkart","shopping","clothes","shoes","mall","market","store"],
      "Utilities": ["electricity","water","gas","internet","wifi","bill","recharge","airtel","jio"],
      "Entertainment": ["movie","netflix","hotstar","prime","game","entertainment","cinema"],
      "Healthcare": ["medicine","doctor","hospital","pharmacy","medical","health"],
      "Education": ["college","school","fees","course","book","tuition"],
    };
    let category = "Others";
    for (const [cat, kws] of Object.entries(categories)) {
      if (kws.some(k => t.includes(k))) { category = cat; break; }
    }

    const cleanMerchant = merchant.charAt(0).toUpperCase() + merchant.slice(1);
    setParsed({ amount: isCredit ? amount : -amount, merchant: cleanMerchant, category, type: isCredit ? "CREDIT" : "DEBIT", description: `${isCredit ? "Received from" : "Paid to"} ${merchant}` });
    setError("");

    const speechMsg = isCredit
      ? `Parsed income of ${amount} rupees from ${cleanMerchant}. Click Add Transaction to save.`
      : `Parsed expense of ${amount} rupees for ${cleanMerchant}. Click Add Transaction to save.`;
    speakText(speechMsg);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    setTranscript("");
    setParsed(null);
    setError("");
    setSuccess(false);
    setListening(true);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setListening(false);
  };

  const saveTransaction = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const smsText = `Your account ${parsed.amount < 0 ? "debited" : "credited"} Rs.${Math.abs(parsed.amount)} at ${parsed.merchant}`;
      const res = await axios.post(`${API}/api/sms/webhook`, { phone: "voice", message: smsText, sender: "VOICE" }, { headers });
      if (res.data.success) {
        setSuccess(true);
        setHistory(prev => [{ ...parsed, transcript, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);
        setTranscript("");
        setParsed(null);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.data.message || "Failed to save");
      }
    } catch (e) { setError("Failed to save transaction"); }
    finally { setSaving(false); }
  };

  const examples = [
    "Add 500 rupees for Swiggy food",
    "Paid 1200 rupees for Amazon shopping",
    "Received 50000 rupees salary",
    "200 rupees for Uber transport",
    "Spent 800 at restaurant food",
  ];

  if (!supported) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">😕</div>
        <h2 className="text-white font-bold text-lg">Voice Not Supported</h2>
        <p className="text-red-300 text-sm mt-2">Please use Chrome or Edge browser for voice recognition.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">🎙️ Voice Transaction Entry</h1>
        <p className="text-purple-100 mt-1">Speak to add transactions instantly</p>
      </div>

      {/* Success */}
      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-semibold">Transaction added successfully!</p>
        </div>
      )}

      {/* Mic button */}
      <div className="bg-dark-800 border border-dark-500 rounded-2xl p-6 flex flex-col items-center gap-4">
        <button
          onClick={listening ? stopListening : startListening}
          className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl transition-all shadow-lg ${
            listening
              ? "bg-red-500 animate-pulse shadow-red-500/50 scale-110"
              : "bg-gradient-to-br from-purple-600 to-pink-600 hover:scale-105 shadow-purple-500/30"
          }`}
        >
          {listening ? "⏹️" : "🎙️"}
        </button>
        <p className="text-gray-400 text-sm">
          {listening ? "🔴 Listening... speak now" : "Tap to start speaking"}
        </p>
        {transcript && (
          <div className="w-full bg-dark-700 rounded-xl p-3 text-center">
            <p className="text-white text-sm italic">"{transcript}"</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">⚠️ {error}</div>
      )}

      {/* Parsed result */}
      {parsed && (
        <div className="bg-dark-800 border border-purple-500/30 rounded-2xl p-5 space-y-4">
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
          <button onClick={saveTransaction} disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-lg">
            {saving ? "⏳ Saving..." : "➕ Add Transaction"}
          </button>
        </div>
      )}

      {/* Keyboard simulation input */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/20 to-slate-900 border border-purple-500/20 rounded-2xl p-5 space-y-3 text-left animate-fade-in">
        <label className="text-white font-bold text-sm block flex items-center gap-2">
          <span>⌨️</span> Keyboard Command Simulator
        </label>
        <p className="text-xs text-gray-400 leading-relaxed">
          No microphone? Type a voice command here (e.g. <em>"Add 500 rupees for Swiggy food"</em>) to test parser rules and hear speech synthesis.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={kbdInput}
            onChange={(e) => setKbdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (kbdInput.trim()) {
                  setTranscript(kbdInput);
                  parseVoice(kbdInput);
                  setKbdInput("");
                }
              }
            }}
            placeholder="Type command and hit Enter..."
            className="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => {
              if (kbdInput.trim()) {
                setTranscript(kbdInput);
                parseVoice(kbdInput);
                setKbdInput("");
              }
            }}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            Parse
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-3">
        <h3 className="text-gray-400 text-sm font-semibold">💡 Try saying these:</h3>
        {examples.map((ex, i) => (
          <div key={i} onClick={() => { setTranscript(ex); parseVoice(ex); setError(""); }}
            className="bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded-xl p-3 cursor-pointer transition-colors flex items-center gap-3">
            <span className="text-purple-400">🎙️</span>
            <p className="text-xs text-gray-300">"{ex}"</p>
          </div>
        ))}
      </div>

      {/* Recent voice transactions */}
      {history.length > 0 && (
        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-3">
          <h3 className="text-gray-400 text-sm font-semibold">🕐 Recent Voice Entries:</h3>
          {history.map((h, i) => (
            <div key={i} className="flex items-center justify-between bg-dark-700 rounded-xl p-3">
              <div>
                <p className="text-white text-xs font-medium">"{h.transcript}"</p>
                <p className="text-gray-500 text-xs mt-0.5">{h.merchant} • {h.category} • {h.time}</p>
              </div>
              <span className={`text-sm font-bold ${h.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                {h.amount > 0 ? "+" : ""}₹{Math.abs(h.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
