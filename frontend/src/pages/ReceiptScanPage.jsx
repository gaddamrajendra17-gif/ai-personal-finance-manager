import { useState, useEffect } from "react";
import api from "../services/api";

export default function ReceiptScanPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Edit form states
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");

  useEffect(() => {
    // Fetch accounts to link transaction to
    api.get("/api/accounts/").then((res) => {
      setAccounts(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedAccount(res.data[0].id);
      }
    }).catch(() => {});
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setParsed(null);
      setError("");
      setSuccess(false);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setParsed(null);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/ocr/scan", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data && res.data.success) {
        const data = res.data.parsed_data;
        setParsed(data);
        setMerchant(data.merchant);
        setAmount(data.amount);
        setCategory(data.category);
        setDescription(`Receipt scan purchase at ${data.merchant}`);
      } else {
        setError("Failed to parse receipt. Try editing details manually.");
      }
    } catch (e) {
      setError("Failed to scan receipt. Please input details manually.");
    } finally {
      setScanning(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!selectedAccount) {
      setError("Please select a bank account.");
      return;
    }
    if (!merchant || !amount) {
      setError("Please specify both merchant and amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await api.post("/api/transactions/", {
        account_id: selectedAccount,
        amount: parseFloat(amount),
        merchant: merchant,
        transaction_type: "DEBIT",
        category: category,
        description: description,
        timestamp: new Date().toISOString(),
      });

      setSuccess(true);
      // Dispatch event to refresh live charts/lists on dashboard
      window.dispatchEvent(new CustomEvent("new-transaction-event", { detail: res.data }));
      
      // Clear forms
      setFile(null);
      setPreview(null);
      setParsed(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError("Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    "Food & Dining",
    "Rent",
    "Transport",
    "Entertainment",
    "Health & Medical",
    "Utilities",
    "Shopping",
    "EMI & Loans",
    "Education",
    "Travel",
    "Investments",
    "Other",
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
        .scan-line {
          animation: scan 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">🧾 AI Receipt Scanner</h1>
        <p className="text-cyan-100 mt-1">Upload a bill to extract and categorize transaction data using Tesseract OCR.</p>
      </div>

      {success && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-semibold">Transaction parsed and added successfully!</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Upload & Scan */}
        <div className="space-y-4">
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 flex flex-col items-center gap-4">
            <h3 className="text-white font-semibold text-sm self-start">Upload Receipt Image</h3>
            
            {!preview ? (
              <label className="w-full h-64 border-2 border-dashed border-dark-500 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 hover:bg-dark-700/30 transition-all">
                <span className="text-4xl mb-2">📸</span>
                <span className="text-xs text-gray-400">Drag & drop or click to upload receipt</span>
                <span className="text-[10px] text-gray-600 mt-1">Accepts JPG, JPEG, PNG</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            ) : (
              <div className="w-full relative rounded-xl overflow-hidden border border-dark-500 bg-dark-900">
                <img src={preview} alt="Receipt preview" className="w-full h-64 object-contain" />
                {scanning && (
                  <div className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-lg shadow-cyan-400/50 scan-line"></div>
                )}
                <button
                  onClick={() => { setFile(null); setPreview(null); setParsed(null); }}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            <button
              onClick={handleScan}
              disabled={!file || scanning}
              className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md cursor-pointer"
            >
              {scanning ? "⏳ Running OCR OCR..." : "⚡ Extract Transaction Data"}
            </button>
          </div>
        </div>

        {/* Right Side: Parsed Results / Validation Form */}
        <div className="space-y-4">
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">Transaction Details</h3>

            {scanning ? (
              <div className="py-20 text-center space-y-3">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
                <p className="text-xs text-gray-400">Processing receipt with neural text parser...</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {parsed && (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 flex justify-between items-center text-xs">
                    <span className="text-cyan-400 font-medium">OCR Extraction Method:</span>
                    <span className="bg-dark-700 px-2 py-0.5 rounded text-white font-semibold">{parsed.method}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Linked Bank Account</label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    {accounts.length === 0 ? (
                      <option value="">No Accounts Available</option>
                    ) : (
                      accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bank_name} (*{a.account_last4}) - Bal: ₹{a.balance.toLocaleString()}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Merchant / Store</label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Merchant name"
                    className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Amount (Rs.)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Transaction description"
                    className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  onClick={handleSaveTransaction}
                  disabled={saving || !selectedAccount || !amount || !merchant}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md mt-2 cursor-pointer text-sm"
                >
                  {saving ? "⏳ Saving..." : "➕ Confirm and Log Expense"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

