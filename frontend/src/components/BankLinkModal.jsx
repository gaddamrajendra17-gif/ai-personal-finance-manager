import { useState, useEffect } from "react";
import api from "../services/api";

const POPULAR_BANKS = [
  { id: "sbi", name: "State Bank of India", country: "IN", color: "from-cyan-500 to-blue-600", logoText: "SBI", style: "sbi" },
  { id: "hdfc", name: "HDFC Bank", country: "IN", color: "from-blue-700 to-blue-900", logoText: "HDFC", style: "hdfc" },
  { id: "icici", name: "ICICI Bank", country: "IN", color: "from-orange-500 to-red-800", logoText: "ICICI", style: "icici" },
  { id: "chase", name: "Chase", country: "US", color: "from-blue-600 to-indigo-900", logoText: "Chase", style: "chase" },
  { id: "wells_fargo", name: "Wells Fargo", country: "US", color: "from-red-600 to-yellow-600", logoText: "WF", style: "wells" },
  { id: "bofa", name: "Bank of America", country: "US", color: "from-red-500 via-blue-600 to-blue-800", logoText: "BofA", style: "bofa" },
];

const ACCOUNT_TYPES = [
  { val: "savings", label: "Savings Account" },
  { val: "checking", label: "Checking / Current Account" },
  { val: "credit", label: "Credit Card" },
];

// Custom SVG bank logos to make the UI look extremely premium
export const BankLogo = ({ type, className = "w-10 h-10" }) => {
  if (type === "sbi") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#00a1e4" />
        <circle cx="50" cy="50" r="18" fill="#ffffff" />
        <rect x="45" y="50" width="10" height="40" fill="#ffffff" />
      </svg>
    );
  }
  if (type === "hdfc") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="16" fill="#1c3f94" />
        <rect x="15" y="15" width="70" height="70" stroke="#ffffff" strokeWidth="6" fill="transparent" />
        <rect x="35" y="15" width="30" height="70" fill="#e41e26" />
        <rect x="15" y="35" width="70" height="30" fill="#e41e26" />
        <rect x="35" y="35" width="30" height="30" fill="#ffffff" />
      </svg>
    );
  }
  if (type === "icici") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="16" fill="#751e1a" />
        <path d="M25 80V20H38C48 20 54 26 54 35C54 41 50 47 43 49L57 80H42L31 56H25V80H25Z" fill="#e47911" />
        <circle cx="75" cy="50" r="10" fill="#e47911" />
      </svg>
    );
  }
  if (type === "chase") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="16" fill="#11295e" />
        <path d="M50 15L15 50L50 85L85 50L50 15ZM50 31L69 50L50 69L31 50L50 31Z" fill="#ffffff" opacity="0.2" />
        <path d="M50 15V36L64 50L85 50L50 15Z" fill="#11a3df" />
        <path d="M85 50H64L50 64V85L85 50Z" fill="#11a3df" />
        <path d="M50 85V64L36 50H15L50 85Z" fill="#11a3df" />
        <path d="M15 50H36L50 36V15L15 50Z" fill="#11a3df" />
      </svg>
    );
  }
  if (type === "wells") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="16" fill="#d91e18" />
        <rect x="10" y="10" width="80" height="80" rx="8" fill="#f4b000" />
        <text x="50" y="65" fontFamily="Outfit, Inter, Arial" fontWeight="bold" fontSize="40" fill="#d91e18" textAnchor="middle">W</text>
      </svg>
    );
  }
  if (type === "bofa") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="16" fill="#012169" />
        <path d="M15 25H45V45H15V25Z" fill="#E4002B" />
        <path d="M55 25H85V45H55V25Z" fill="#ffffff" />
        <path d="M15 55H85V75H15V55Z" fill="#E4002B" />
        <rect x="42" y="15" width="16" height="70" fill="#012169" />
      </svg>
    );
  }
  if (type === "plaid") {
    return (
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="16" fill="#111111" />
        <circle cx="35" cy="35" r="8" fill="#000000" stroke="#00c853" strokeWidth="5" />
        <circle cx="65" cy="35" r="8" fill="#000000" stroke="#00c853" strokeWidth="5" />
        <circle cx="35" cy="65" r="8" fill="#000000" stroke="#00c853" strokeWidth="5" />
        <circle cx="65" cy="65" r="8" fill="#000000" stroke="#00c853" strokeWidth="5" />
        <path d="M35 35H65M35 65H65M35 35V65M65 35V65" stroke="#ffffff" strokeWidth="4" />
      </svg>
    );
  }
  return <div className={`${className} bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold`}>🏦</div>;
};

export default function BankLinkModal({ isOpen, onClose, onSuccess, onManualClick }) {
  const [step, setStep] = useState(1); // 1: Method selection, 2: Choose bank, 3: Login form, 4: Plaid Simulation, 5: Gateway secure connect, 6: OTP input, 7: Custom balance, 8: Success screen
  const [method, setMethod] = useState(null); // 'plaid' or 'direct'
  const [selectedBank, setSelectedBank] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [customBalance, setCustomBalance] = useState("45000");
  const [customAccountType, setCustomAccountType] = useState("savings");
  const [loadingText, setLoadingText] = useState("Establishing secure tunnel...");
  const [plaidConfig, setPlaidConfig] = useState({ enabled: false, env: "sandbox" });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch plaid config
    api.get("/api/plaid/config")
      .then(res => {
        setPlaidConfig(res.data);
      })
      .catch(() => {});
  }, []);

  // Load Plaid Link script dynamically if Plaid is enabled
  useEffect(() => {
    if (plaidConfig.enabled) {
      const script = document.createElement("script");
      script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      script.async = true;
      document.body.appendChild(script);
      return () => {
        const existingScript = document.querySelector(`script[src="${script.src}"]`);
        if (existingScript) document.body.removeChild(existingScript);
      };
    }
  }, [plaidConfig.enabled]);

  // Loading animation messages
  useEffect(() => {
    if (step === 5) {
      const messages = [
        "Establishing secure connection to bank server...",
        "Validating encrypted gateway handshake...",
        "Initiating OAuth secure transaction scope...",
        "Requesting Multi-Factor Authentication payload...",
        "OTP session verified. Generating mock token...",
        "Synching bank accounts..."
      ];
      let counter = 0;
      const interval = setInterval(() => {
        if (counter < messages.length - 1) {
          counter++;
          setLoadingText(messages[counter]);
        }
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [step]);

  if (!isOpen) return null;

  const handlePlaidRealLink = async () => {
    try {
      const res = await api.post("/api/plaid/create_link_token");
      const linkToken = res.data.link_token;

      if (linkToken.startsWith("mock_plaid_link_token_")) {
        // Switch to high-fidelity Plaid simulator since keys are placeholders
        setStep(4);
      } else if (window.Plaid) {
        const handler = window.Plaid.create({
          token: linkToken,
          onSuccess: async (public_token, metadata) => {
            setStep(5);
            setLoadingText("Exchanging security tokens with Plaid...");
            try {
              await api.post("/api/plaid/exchange_public_token", {
                public_token,
                institution_name: metadata.institution?.name || "Plaid Connected Bank",
                account_name: metadata.account?.name,
                account_type: metadata.account?.subtype || "savings",
                account_last4: metadata.account?.mask || "9999",
                balance: 25000.0,
              });
              setStep(8);
              if (onSuccess) onSuccess();
            } catch (err) {
              alert("Error linking Plaid account: " + (err.response?.data?.detail || err.message));
              setStep(1);
            }
          },
          onExit: (err, metadata) => {
            console.log("Plaid exited", err, metadata);
          }
        });
        handler.open();
      } else {
        // Plaid SDK did not load. Fallback to Plaid simulator.
        setStep(4);
      }
    } catch (err) {
      console.error(err);
      // Fallback to simulator if backend endpoint fails
      setStep(4);
    }
  };

  const handleConnectDirect = (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setStep(5); // Loading screen
    setTimeout(() => {
      setStep(6); // OTP Screen
    }, 2800);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (!otp) return;
    setStep(7); // Custom balance / account config screen
  };

  const handleCompleteDirectLink = async (e) => {
    e.preventDefault();
    setStep(5);
    setLoadingText("Configuring database schemas and seeding initial history...");
    try {
      // We pass the simulated params to exchange_public_token.
      // We use mock_direct_<bank> to trigger simulated direct seeding on the backend.
      const bankName = selectedBank ? selectedBank.name : "Simulated Bank";
      await api.post("/api/plaid/exchange_public_token", {
        public_token: "mock_direct_" + (selectedBank ? selectedBank.id : "generic"),
        institution_name: bankName,
        account_type: customAccountType,
        account_last4: Math.floor(1000 + Math.random() * 9000).toString(),
        balance: parseFloat(customBalance) || 25000.0
      });

      setStep(8); // Success
      if (onSuccess) onSuccess();
    } catch (err) {
      alert("Error seeding simulated bank: " + (err.response?.data?.detail || err.message));
      setStep(1);
    }
  };

  // Mock Plaid selection
  const handlePlaidMockSelectBank = (bankName) => {
    setSelectedBank({ id: bankName.toLowerCase(), name: bankName });
    setStep(3); // Go to login
  };

  const handleReset = () => {
    setStep(1);
    setMethod(null);
    setSelectedBank(null);
    setUsername("");
    setPassword("");
    setOtp("");
    setCustomBalance("45000");
  };

  const filteredBanks = POPULAR_BANKS.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-slate-900 border border-slate-800/80 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative">
        
        {/* Top Header / Bank Specific Accent */}
        <div className={`h-1.5 w-full bg-gradient-to-r ${selectedBank ? selectedBank.color : "from-indigo-500 via-purple-500 to-pink-500"}`}></div>
        
        {/* Close Button */}
        {step !== 5 && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800/40 p-2 rounded-full hover:bg-slate-800 transition-all z-10"
          >
            ✕
          </button>
        )}

        <div className="p-8">
          
          {/* STEP 1: METHOD SELECTION */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Link Your Bank</h2>
                <p className="text-slate-400 text-sm">Synchronize your accounts to view real-time transactions automatically</p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-4">
                
                {/* Method 1: Plaid */}
                <button 
                  onClick={() => { setMethod("plaid"); handlePlaidRealLink(); }}
                  className="flex items-center gap-4 text-left p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 hover:border-emerald-500/40 hover:bg-slate-850/60 hover:shadow-lg hover:shadow-emerald-950/20 group transition-all duration-300"
                >
                  <div className="flex-shrink-0 p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-115 transition-transform duration-300">
                    <BankLogo type="plaid" className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">Secure Plaid Link</span>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">Secure Gateway</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">Connect instantly to Chase, Wells Fargo, BofA, and 11,000+ banks. Sandbox fallback integrated.</p>
                  </div>
                </button>

                {/* Method 2: Direct Simulated */}
                <button 
                  onClick={() => { setMethod("direct"); setStep(2); }}
                  className="flex items-center gap-4 text-left p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 hover:border-indigo-500/40 hover:bg-slate-850/60 hover:shadow-lg hover:shadow-indigo-950/20 group transition-all duration-300"
                >
                  <div className="flex-shrink-0 p-3 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-115 transition-transform duration-300">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-indigo-500/20">⚡</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">Direct Bank Sync (Simulated)</span>
                      <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full">Instant Test</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">Simulate real-time feeds from SBI, HDFC, ICICI, Chase, BofA. Real-time background ticks generate mock transactions.</p>
                  </div>
                </button>

                {/* Option 3: Manual Fallback */}
                <div className="text-center pt-2">
                  <button 
                    onClick={() => { onClose(); if (onManualClick) onManualClick(); }} 
                    className="text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                  >
                    Looking for standard manual entry? Click here to add manually.
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CHOOSE BANK (DIRECT SIMULATED) */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white text-sm bg-slate-800/60 p-1.5 px-3 rounded-xl">
                  ← Back
                </button>
                <h3 className="text-xl font-bold text-white">Select Your Bank</h3>
              </div>

              {/* Search */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">🔍</span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search popular banks..." 
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500 transition-all"
                />
              </div>

              {/* Bank Grid */}
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                {filteredBanks.map(b => (
                  <button 
                    key={b.id} 
                    onClick={() => { setSelectedBank(b); setStep(3); }}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-800/30 border border-slate-800 hover:bg-slate-800/60 hover:border-slate-700/80 hover:-translate-y-0.5 active:translate-y-0 text-center transition-all duration-200"
                  >
                    <BankLogo type={b.style} className="w-12 h-12 shadow-lg" />
                    <div>
                      <div className="text-white font-bold text-sm tracking-tight">{b.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{b.country === "IN" ? "India" : "United States"}</div>
                    </div>
                  </button>
                ))}
                {filteredBanks.length === 0 && (
                  <div className="col-span-2 text-center text-slate-500 py-8">No banks found matching "{searchQuery}"</div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: LOGIN FORM */}
          {step === 3 && selectedBank && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(method === "plaid" ? 4 : 2)} className="text-slate-400 hover:text-white text-sm bg-slate-800/60 p-1.5 px-3 rounded-xl">
                  ← Back
                </button>
                <div className="flex items-center gap-2">
                  <BankLogo type={selectedBank.style} className="w-8 h-8" />
                  <h3 className="text-lg font-bold text-white">Login to {selectedBank.name}</h3>
                </div>
              </div>

              {/* Fake URL Padlock Bar */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-[11px] text-slate-500 font-mono">
                <span className="text-emerald-400">🔒</span>
                <span className="text-slate-400 font-semibold select-none">https://</span>
                <span className="text-slate-300">secure.{selectedBank.id}.com/oauth/signin</span>
              </div>

              <form onSubmit={handleConnectDirect} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Username / Customer ID</label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={`Enter your ${selectedBank.name} login ID`}
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">Password / IPIN</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    className={`w-full bg-gradient-to-r ${selectedBank.color} text-white font-bold py-3 rounded-xl text-sm transition-all transform active:scale-[0.99] hover:shadow-lg hover:brightness-110`}
                  >
                    Authenticate Securely
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center">
                <span>🔐</span>
                <span>PFM sync reads balances and transactions. We never write transactions or see password details.</span>
              </div>
            </div>
          )}

          {/* STEP 4: MOCK PLAID PORTAL SIMULATOR */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center pb-2 border-b border-slate-850">
                <div className="flex items-center justify-center gap-2">
                  <BankLogo type="plaid" className="w-8 h-8 animate-pulse" />
                  <span className="text-2xl font-bold text-white font-serif">PLAID</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Select a sandbox bank to connect your app with Plaid Link Simulator</p>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2 max-h-[250px] overflow-y-auto pr-1">
                {["Chase", "Wells Fargo", "Bank of America", "Citi Bank", "US Bank", "Fidelity"].map(bank => (
                  <button
                    key={bank}
                    onClick={() => handlePlaidMockSelectBank(bank)}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-850/50 border border-slate-800 hover:bg-slate-800 hover:border-emerald-500/30 text-left group transition-all"
                  >
                    <span className="text-white font-bold text-sm">{bank} (Sandbox)</span>
                    <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">Select →</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-850/30 p-3 rounded-xl">
                <span>⚠️ Developer Plaid credentials missing</span>
                <span className="text-emerald-400 font-semibold">Running in high-fidelity simulator mode</span>
              </div>
            </div>
          )}

          {/* STEP 5: GATEWAY CONNECTOR (LOADING SCREEN) */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              {/* Complex Premium Loader */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-3 rounded-full border-2 border-indigo-600/30 border-b-transparent animate-spin [animation-duration:1.5s]"></div>
                <span className="text-3xl animate-pulse">🔒</span>
              </div>
              <div className="space-y-2 text-center max-w-sm">
                <h4 className="text-white font-bold text-lg">Secure Connecting...</h4>
                <p className="text-indigo-400 text-xs font-mono min-h-[32px]">{loadingText}</p>
                <p className="text-[10px] text-slate-500">Do not refresh or close this window.</p>
              </div>
            </div>
          )}

          {/* STEP 6: 2FA OTP SCREEN */}
          {step === 6 && selectedBank && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl mx-auto">📱</div>
                <h3 className="text-xl font-bold text-white">Enter Security Code</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">A 6-digit verification code has been sent to your mobile number registered with {selectedBank.name}.</p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4 max-w-xs mx-auto">
                <div>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 123456"
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-3 text-center text-white text-xl font-bold tracking-widest focus:outline-none focus:border-indigo-500 placeholder-slate-700"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all"
                >
                  Verify Code
                </button>
              </form>

              <div className="text-center">
                <button type="button" onClick={() => alert("OTP resent!")} className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                  Didn't receive the code? Resend OTP
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: ACCOUNT CONFIG & STARTING BALANCE */}
          {step === 7 && selectedBank && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-white">Configure Linked Account</h3>
                <p className="text-xs text-slate-400">Set the initial properties of your simulated bank account</p>
              </div>

              <form onSubmit={handleCompleteDirectLink} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Account Type</label>
                    <select 
                      value={customAccountType} 
                      onChange={e => setCustomAccountType(e.target.value)} 
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {ACCOUNT_TYPES.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold mb-1 block">Starting Balance (Rs.)</label>
                    <input 
                      type="number" 
                      required
                      value={customBalance}
                      onChange={(e) => setCustomBalance(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-850/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="text-indigo-400 font-semibold text-xs">✨ Seeding Initial Sync</h4>
                  <p className="text-[11px] text-slate-400">
                    We will seed 4 to 7 historical mock transactions representing standard spends over the last 5 days (e.g. Starbucks, Amazon, Zomato) to populate your ledger immediately.
                  </p>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all"
                >
                  Create & Seed Account
                </button>
              </form>
            </div>
          )}

          {/* STEP 8: SUCCESS SCREEN */}
          {step === 8 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
              
              {/* Premium Animated SVG Checkmark */}
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-4xl text-emerald-400 shadow-xl shadow-emerald-950/20 border border-emerald-500/20">
                <svg className="w-10 h-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-2 max-w-sm">
                <h3 className="text-2xl font-bold text-white">Connection Established!</h3>
                <p className="text-slate-400 text-sm">
                  Your bank account for <strong>{selectedBank ? selectedBank.name : "Simulated Bank"}</strong> has been linked successfully.
                </p>
                <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 mt-2">
                  🎉 Background simulation active! Mock transactions will generate dynamically. Feel free to trigger manual sync anytime on the accounts page.
                </p>
              </div>

              <button 
                onClick={onClose} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20"
              >
                Go to Accounts
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
