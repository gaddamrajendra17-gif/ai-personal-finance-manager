import { useState, useEffect, useRef } from "react";
import useAuthStore from "../store/authStore";

// Predefined Agent Personas
const DEFAULT_AGENTS = [
  {
    id: "max",
    name: "Max",
    role: "Budget Specialist",
    description: "Max specializes in budget optimization, savings targets, and cutting expenses.",
    avatar: "📊",
    color: "from-blue-600 to-indigo-700",
    glow: "shadow-blue-500/30",
    systemPrompt: "You are Max, a hyper-focused, direct, and slightly strict Financial Budgeting Expert. Your goal is to help the user cut unnecessary costs, stay under budget limits, and allocate money efficiently. Keep your responses short and punchy. Make sure to suggest create_budget, get_budgets, and create_savings_goal when appropriate."
  },
  {
    id: "zara",
    name: "Zara",
    role: "Simulated Stock Trader",
    description: "Zara operates investment accounts, stock trades, and robo-advisory reviews.",
    avatar: "📈",
    color: "from-emerald-600 to-teal-700",
    glow: "shadow-emerald-500/30",
    systemPrompt: "You are Zara, a high-frequency algorithmic trader and simulated investment advisor. You are energetic, data-driven, and talk fast. You help the user manage their simulated portfolio, suggest Rob-advisor allocations, and trade assets. Encourage the user to buy/sell assets using the trade_asset tool."
  },
  {
    id: "sophia",
    name: "Sophia",
    role: "Global Wealth Advisor",
    description: "Sophia covers full relational queries, transaction categorization, and general PFM queries.",
    avatar: "💎",
    color: "from-purple-600 to-pink-700",
    glow: "shadow-purple-500/30",
    systemPrompt: "You are Sophia, an elegant, empathetic, and comprehensive Wealth Advisor. You take a holistic look at the user's financial life. You explain transactions, categorize expenses, review portfolios, and offer strategic financial advice. Be thorough, polite, and strategic."
  }
];

export default function RealtimeAgentPage() {
  const { user, token } = useAuthStore();
  const [agents, setAgents] = useState(DEFAULT_AGENTS);
  const [activeAgent, setActiveAgent] = useState(DEFAULT_AGENTS[0]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // disconnected, connecting, connected
  const [agentState, setAgentState] = useState("idle"); // idle, listening, thinking, speaking, error
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("all"); // all, tools, thoughts, chat
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voices, setVoices] = useState([]);
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [customPromptOpen, setCustomPromptOpen] = useState(false);
  
  // Custom agent creator state
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [customAvatar, setCustomAvatar] = useState("🤖");

  // Web Speech API refs
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const socketRef = useRef(null);
  
  // Canvas visualization refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  
  const bottomRef = useRef(null);

  // Initialize available browser voices
  useEffect(() => {
    if (!synthRef.current) return;
    const loadVoices = () => {
      const allVoices = synthRef.current.getVoices();
      setVoices(allVoices);
      const enVoice = allVoices.find(v => v.lang.startsWith("en"));
      if (enVoice) setSelectedVoice(enVoice.name);
    };
    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    
    // Load custom agents from localStorage
    const saved = localStorage.getItem("pfm_custom_agents");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAgents([...DEFAULT_AGENTS, ...parsed]);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Audio Visualizer Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let angle = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let amplitude = 10;
      let frequency = 0.05;
      
      if (analyserRef.current && agentState === "listening") {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const sum = dataArrayRef.current.reduce((a, b) => a + b, 0);
        const average = sum / dataArrayRef.current.length;
        amplitude = Math.max(5, average * 0.8);
        frequency = 0.02 + (average * 0.002);
      } else if (agentState === "speaking") {
        amplitude = 25 + Math.sin(Date.now() * 0.015) * 15;
        frequency = 0.08;
      } else if (agentState === "thinking") {
        amplitude = 8 + Math.cos(Date.now() * 0.01) * 3;
        frequency = 0.12;
      } else {
        amplitude = 3;
        frequency = 0.02;
      }

      // Draw beautiful multi-layered glowing sine waves
      ctx.lineWidth = 2.5;
      
      // Dynamic colors based on agentState
      let primaryColor = "rgba(99, 102, 241, 0.8)"; // Indigo
      let secondaryColor = "rgba(0, 212, 255, 0.4)"; // Cyan
      
      if (agentState === "listening") {
        primaryColor = "rgba(34, 197, 94, 0.8)"; // Green
        secondaryColor = "rgba(52, 211, 153, 0.4)";
      } else if (agentState === "thinking") {
        primaryColor = "rgba(245, 158, 11, 0.8)"; // Amber
        secondaryColor = "rgba(251, 191, 36, 0.4)";
      } else if (agentState === "speaking") {
        primaryColor = "rgba(236, 72, 153, 0.8)"; // Pink
        secondaryColor = "rgba(168, 85, 247, 0.4)"; // Purple
      } else if (agentState === "error") {
        primaryColor = "rgba(239, 68, 68, 0.8)"; // Red
        secondaryColor = "rgba(248, 113, 113, 0.4)";
      }

      // Wave 1
      ctx.beginPath();
      ctx.strokeStyle = primaryColor;
      ctx.shadowBlur = 15;
      ctx.shadowColor = primaryColor;
      for (let x = 0; x < width; x++) {
        const y = (height / 2) + Math.sin(x * frequency + angle) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 2
      ctx.beginPath();
      ctx.strokeStyle = secondaryColor;
      ctx.shadowBlur = 5;
      ctx.shadowColor = secondaryColor;
      for (let x = 0; x < width; x++) {
        const y = (height / 2) + Math.sin(x * (frequency * 0.7) - angle * 0.8) * (amplitude * 0.6);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 3 (Center reference line)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.shadowBlur = 0;
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      angle += 0.08;
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [agentState]);

  // Setup Web Audio Analyzer for microphone volume monitoring
  const startAudioMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);
      
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.warn("Failed to initialize audio input monitor (continuing without real mic amplitudes):", e);
    }
  };

  const stopAudioMonitoring = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  // Add Log Entry
  const addLog = (category, text, data = null) => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      category, // system, thoughts, tool, user, voice
      text,
      data
    }]);
  };

  // Speak Response Out Loud
  const speakText = (text) => {
    if (!synthRef.current) return;
    
    // Cancel any current speaking
    synthRef.current.cancel();
    
    setAgentState("speaking");
    addLog("voice", `Speaking: "${text}"`);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    
    const allVoices = synthRef.current.getVoices();
    const voice = allVoices.find(v => v.name === selectedVoice);
    if (voice) utterance.voice = voice;
    
    utterance.onend = () => {
      setAgentState("idle");
      // If continuous mode is enabled, restart continuous listening
      if (isHandsFree && connectionStatus === "connected") {
        startListening();
      }
    };

    utterance.onerror = (e) => {
      console.error(e);
      setAgentState("idle");
    };

    synthRef.current.speak(utterance);
  };

  // Start continuous Web Speech Recognition
  const startListening = () => {
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        addLog("system", "Speech recognition not supported in this browser. Please use Chrome/Edge.", null);
        return;
      }
      
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-IN";
      
      rec.onstart = () => {
        setAgentState("listening");
        addLog("system", "Microphone listening...");
      };
      
      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        addLog("user", `Speech Input: "${text}"`);
        sendToAgent(text);
      };
      
      rec.onerror = (event) => {
        if (event.error !== "no-speech") {
          addLog("system", `Microphone error: ${event.error}`);
          setAgentState("idle");
        }
      };
      
      rec.onend = () => {
        // If not thinking or speaking, reset to idle
        setAgentState(prev => (prev === "listening" ? "idle" : prev));
      };
      
      recognitionRef.current = rec;
    }
    
    // Stop any active SpeechSynthesis before starting to listen (prevent echoes)
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      // recognition already running
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setAgentState("idle");
  };

  // Connect WebSocket to real-time agent backend pipeline
  const connectAgent = () => {
    if (!token || !user?.id) return;
    setConnectionStatus("connecting");
    addLog("system", `Establishing WebSocket connection for ${activeAgent.name}...`);

    const ws = new WebSocket(`ws://localhost:8000/api/realtime-agent/ws/${user.id}`);

    ws.onopen = () => {
      setConnectionStatus("connected");
      addLog("system", `Successfully connected to ${activeAgent.name} pipeline.`);
      speakText(`Hi, I am ${activeAgent.name}, your real-time ${activeAgent.role}. I am ready to advise you, boss!`);
      startAudioMonitoring();
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "status") {
          if (data.status === "thinking") {
            setAgentState("thinking");
          } else if (data.status === "idle" && agentState !== "speaking") {
            setAgentState("idle");
          }
        }
        
        if (data.type === "agent_response") {
          if (data.thoughts) {
            addLog("thoughts", data.thoughts);
          }
          
          if (data.actions && data.actions.length > 0) {
            data.actions.forEach(act => {
              addLog("tool", `Executed Tool: ${act.tool}`, act);
              // Dispatch local events to notify pages of writes (budgets, transactions, goals)
              if (["create_transaction", "create_budget", "create_savings_goal", "add_savings_contribution", "trade_asset"].includes(act.tool) && act.result?.status === "success") {
                window.dispatchEvent(new CustomEvent("new-transaction-event"));
              }
            });
          }
          
          if (data.response) {
            speakText(data.response);
          }
        }
        
        if (data.type === "error") {
          addLog("system", `Error: ${data.message}`);
          setAgentState("error");
          setTimeout(() => setAgentState("idle"), 3000);
        }
      } catch (err) {
        console.error("WS error parsing response:", err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setAgentState("idle");
      addLog("system", "Agent connection closed.");
      stopAudioMonitoring();
    };

    ws.onerror = () => {
      addLog("system", "Network connection error encountered.");
      ws.close();
    };

    socketRef.current = ws;
  };

  const disconnectAgent = () => {
    if (synthRef.current) synthRef.current.cancel();
    stopListening();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  // Hot swap Agent
  const selectAgent = (agent) => {
    disconnectAgent();
    setActiveAgent(agent);
  };

  // Send query/message to the active Agent via WebSocket
  const sendToAgent = (msg) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addLog("system", "Cannot send. Agent pipeline is not connected.");
      return;
    }
    
    addLog("system", "Sending query to AI Agent...", { query: msg });
    
    socketRef.current.send(JSON.stringify({
      type: "user_message",
      message: msg,
      system_prompt: activeAgent.systemPrompt
    }));
  };

  // Clear Session History
  const clearSession = () => {
    setLogs([]);
    addLog("system", `Cleared console trace logs.`);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "clear_history" }));
    }
  };

  // Add Custom Agent Persona
  const handleCreateCustomAgent = (e) => {
    e.preventDefault();
    if (!customName || !customPrompt) return;
    
    const newAgent = {
      id: `custom_${Date.now()}`,
      name: customName,
      role: customRole || "Custom Assistant",
      description: customDesc || "A custom imported real-time financial advisor persona.",
      avatar: customAvatar,
      color: "from-slate-700 to-slate-900 border border-slate-500",
      glow: "shadow-slate-500/20",
      systemPrompt: customPrompt
    };
    
    const updated = [...agents, newAgent];
    setAgents(updated);
    
    // Save to localStorage
    const customs = updated.filter(a => a.id.startsWith("custom_"));
    localStorage.setItem("pfm_custom_agents", JSON.stringify(customs));
    
    addLog("system", `Successfully imported custom agent: ${customName}`);
    
    // Reset forms
    setCustomName("");
    setCustomRole("");
    setCustomDesc("");
    setCustomPrompt("");
    setCustomAvatar("🤖");
    setCustomPromptOpen(false);
    
    // Select the new agent
    setActiveAgent(newAgent);
  };

  // Delete custom agent
  const deleteAgent = (e, id) => {
    e.stopPropagation();
    const updated = agents.filter(a => a.id !== id);
    setAgents(updated);
    
    const customs = updated.filter(a => a.id.startsWith("custom_"));
    localStorage.setItem("pfm_custom_agents", JSON.stringify(customs));
    
    addLog("system", "Deleted custom agent.");
    if (activeAgent.id === id) {
      setActiveAgent(DEFAULT_AGENTS[0]);
    }
  };

  // Filter logs for display
  const filteredLogs = logs.filter(log => {
    if (logFilter === "all") return true;
    if (logFilter === "tools") return log.category === "tool";
    if (logFilter === "thoughts") return log.category === "thoughts";
    if (logFilter === "chat") return log.category === "user" || log.category === "voice";
    return true;
  });

  return (
    <div className="flex flex-col lg:flex-row h-full bg-dark-900 text-gray-200 overflow-hidden">
      {/* Sidebar: Agents Grid & Settings */}
      <div className="w-full lg:w-80 bg-dark-800/60 border-r border-dark-500 flex flex-col overflow-y-auto p-5 space-y-6">
        <div>
          <h2 className="text-base font-bold text-white mb-3">Real-time Agent Library</h2>
          <div className="grid grid-cols-1 gap-3">
            {agents.map(agent => (
              <div 
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className={`cursor-pointer rounded-xl p-4 transition-all duration-300 relative border overflow-hidden ${
                  activeAgent.id === agent.id 
                    ? "bg-dark-700 border-primary shadow-lg" 
                    : "bg-dark-800/40 border-dark-500 hover:border-dark-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl shadow`}>
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white flex items-center gap-1.5 justify-between">
                      <span className="truncate">{agent.name}</span>
                      {agent.id.startsWith("custom_") && (
                        <button 
                          onClick={(e) => deleteAgent(e, agent.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-primary font-semibold tracking-wide uppercase truncate mt-0.5">{agent.role}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2.5 leading-relaxed">{agent.description}</p>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => setCustomPromptOpen(!customPromptOpen)}
            className="w-full mt-3.5 bg-gradient-to-r from-primary to-accent hover:opacity-95 text-dark-900 font-bold py-2 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <span>➕</span> Import Custom Agent
          </button>
        </div>

        {/* Custom Agent Importer Panel */}
        {customPromptOpen && (
          <form onSubmit={handleCreateCustomAgent} className="bg-dark-900/60 border border-dark-500/60 rounded-xl p-4 space-y-3.5 animate-fade-in">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Configure Persona</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400">NAME *</label>
                <input 
                  type="text" required value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. Liam"
                  className="w-full bg-dark-800 border border-dark-500 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400">AVATAR ICON</label>
                <input 
                  type="text" value={customAvatar} onChange={e => setCustomAvatar(e.target.value)}
                  placeholder="e.g. 🤖"
                  className="w-full bg-dark-800 border border-dark-500 rounded-lg p-2 text-xs text-white text-center focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400">ROLE/TITLE</label>
              <input 
                type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
                placeholder="e.g. Crypto Advisor"
                className="w-full bg-dark-800 border border-dark-500 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400">DESCRIPTION</label>
              <textarea 
                rows="2" value={customDesc} onChange={e => setCustomDesc(e.target.value)}
                placeholder="Brief summary of agent expertise..."
                className="w-full bg-dark-800 border border-dark-500 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400">SYSTEM SYSTEM PROMPT (INSTRUCTIONS) *</label>
              <textarea 
                rows="4" required value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                placeholder="You are an expert who... Keep answers short..."
                className="w-full bg-dark-800 border border-dark-500 rounded-lg p-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button 
                type="button" onClick={() => setCustomPromptOpen(false)}
                className="flex-1 bg-dark-800 hover:bg-dark-700 text-gray-400 border border-dark-500 rounded-lg py-1.5 text-xs transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-primary text-dark-900 font-bold rounded-lg py-1.5 text-xs hover:opacity-90 transition-all"
              >
                Save Agent
              </button>
            </div>
          </form>
        )}

        {/* Audio / Speech Configurations */}
        <div className="border-t border-dark-500/50 pt-5 space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>⚙️</span> Audio Settings
          </h3>
          
          <div>
            <label className="text-[10px] text-gray-400 font-bold block mb-1">VOICE SELECTOR</label>
            <select
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              className="w-full bg-dark-900 border border-dark-500 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary"
            >
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1">SPEECH RATE: {voiceRate}x</label>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" value={voiceRate} onChange={e => setVoiceRate(parseFloat(e.target.value))}
                className="w-full accent-primary bg-dark-900"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-bold block mb-1">VOICE PITCH: {voicePitch}</label>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" value={voicePitch} onChange={e => setVoicePitch(parseFloat(e.target.value))}
                className="w-full accent-primary bg-dark-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-dark-900/60 p-2.5 rounded-xl border border-dark-500/40">
            <div>
              <div className="text-xs font-bold text-white">Hands-Free Dialog</div>
              <div className="text-[10px] text-gray-500">Auto-listens after response</div>
            </div>
            <button
              onClick={() => setIsHandsFree(!isHandsFree)}
              className={`w-10 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${isHandsFree ? "bg-primary" : "bg-dark-500"}`}
            >
              <div className={`w-5 h-5 rounded-full bg-dark-900 shadow-md transform transition-transform duration-300 ${isHandsFree ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Panel: Interactive Orb and Wave Visualizer */}
      <div className="flex-1 flex flex-col border-r border-dark-500 p-6 bg-gradient-to-b from-dark-900 to-dark-800 justify-between items-center relative min-h-[400px]">
        {/* Header Indicator */}
        <div className="w-full flex items-center justify-between bg-dark-800/40 backdrop-blur border border-white/5 rounded-2xl px-5 py-3 shadow">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${activeAgent.color} flex items-center justify-center text-lg shadow-md animate-pulse`}>
              {activeAgent.avatar}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{activeAgent.name}</div>
              <div className="text-xs text-gray-400">{activeAgent.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              connectionStatus === "connected" ? "bg-green-400 animate-ping" : 
              connectionStatus === "connecting" ? "bg-amber-400 animate-pulse" : "bg-gray-500"
            }`} />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-gray-300">
              {connectionStatus}
            </span>
          </div>
        </div>

        {/* Central Orb & Visualizer Canvas */}
        <div className="relative w-64 h-64 flex items-center justify-center my-6">
          <canvas 
            ref={canvasRef} 
            width={280} 
            height={280} 
            className="absolute inset-0 w-full h-full pointer-events-none rounded-full"
          />
          {/* Animated Central Core glass orb */}
          <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${activeAgent.color} ${activeAgent.glow} flex flex-col items-center justify-center transition-all duration-500 z-10 border border-white/20 select-none shadow-[0_0_40px_rgba(255,255,255,0.05)] ${
            agentState === "listening" ? "scale-105 shadow-green-500/20" :
            agentState === "thinking" ? "scale-95 animate-pulse shadow-amber-500/20" :
            agentState === "speaking" ? "scale-110 shadow-pink-500/20" : "scale-100"
          }`}>
            <span className="text-5xl">{activeAgent.avatar}</span>
            <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest mt-2">
              {agentState}
            </span>
          </div>
        </div>

        {/* Live Status Text Description */}
        <div className="text-center max-w-sm h-12 flex items-center justify-center px-4">
          <p className={`text-sm italic font-medium transition-all duration-300 ${
            agentState === "listening" ? "text-green-400" :
            agentState === "thinking" ? "text-amber-400 animate-pulse" :
            agentState === "speaking" ? "text-pink-400 font-semibold" : "text-gray-400"
          }`}>
            {agentState === "listening" && "🎙️ Live listening... say a command"}
            {agentState === "thinking" && "🧠 Scanning backend databases & tools..."}
            {agentState === "speaking" && "🔊 Agent answering..."}
            {agentState === "idle" && connectionStatus === "connected" && "✨ Live connected. Ready for instructions."}
            {agentState === "idle" && connectionStatus === "disconnected" && "🛑 Connect to start real-time voice pipeline."}
          </p>
        </div>

        {/* Controls Bar */}
        <div className="w-full flex justify-center gap-4 bg-dark-800/30 border border-white/5 rounded-2xl p-4 mt-4 shadow-lg backdrop-blur">
          {connectionStatus !== "connected" ? (
            <button
              onClick={connectAgent}
              disabled={connectionStatus === "connecting"}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-50 text-dark-900 font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-[0_4px_15px_rgba(0,212,255,0.2)] w-48"
            >
              {connectionStatus === "connecting" ? "⏳ Connecting..." : "🔌 Connect Agent"}
            </button>
          ) : (
            <>
              <button
                onClick={agentState === "listening" ? stopListening : startListening}
                disabled={agentState === "thinking" || agentState === "speaking"}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all shadow flex items-center gap-2 ${
                  agentState === "listening" 
                    ? "bg-red-500 text-white hover:bg-red-600 animate-pulse" 
                    : "bg-green-500 text-dark-900 hover:bg-green-400 disabled:opacity-40"
                }`}
              >
                <span>{agentState === "listening" ? "⏹️ Stop" : "🎙️ Talk"}</span>
              </button>
              <button
                onClick={disconnectAgent}
                className="bg-dark-700 hover:bg-dark-600 border border-dark-500 text-gray-300 font-bold px-6 py-3 rounded-xl text-sm transition-all"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Panel: Developer Console Log */}
      <div className="w-full lg:w-96 bg-dark-950 flex flex-col h-full overflow-hidden">
        {/* Terminal Header */}
        <div className="border-b border-dark-500 p-4 flex items-center justify-between bg-dark-900/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
            <span className="font-mono text-xs font-bold text-gray-400 ml-1.5">agent-execution-stream.log</span>
          </div>
          <button 
            onClick={clearSession}
            className="text-[10px] text-gray-500 hover:text-gray-300 border border-dark-500 rounded px-2 py-0.5 transition-colors font-mono"
          >
            clear
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex border-b border-dark-500/50 bg-dark-900/30 text-xs font-mono">
          {["all", "chat", "thoughts", "tools"].map(filter => (
            <button
              key={filter}
              onClick={() => setLogFilter(filter)}
              className={`flex-1 py-2 text-center border-r border-dark-500/30 transition-colors uppercase text-[10px] font-bold ${
                logFilter === filter ? "bg-dark-800 text-primary border-b-2 border-b-primary" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Logs terminal printouts */}
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-dark-500">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-600 italic select-none text-[11px]">
              Console is empty. Initiate connection or command.
            </div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="border-b border-dark-900/60 pb-2.5">
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-gray-600">
                  <span>[{log.timestamp}]</span>
                  <span className={`uppercase font-bold ${
                    log.category === "system" ? "text-cyan-400" :
                    log.category === "thoughts" ? "text-amber-500" :
                    log.category === "tool" ? "text-purple-400" :
                    log.category === "user" ? "text-green-400" : "text-pink-400"
                  }`}>
                    {log.category}
                  </span>
                </div>
                <div className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {log.text}
                </div>
                
                {/* Expandable JSON/Arguments logs */}
                {log.data && (
                  <div className="mt-2 bg-dark-900 border border-dark-500/30 rounded p-2 overflow-x-auto max-h-36 scrollbar-thin">
                    <pre className="text-[10px] text-cyan-300">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Direct text console prompt input */}
        <div className="p-4 border-t border-dark-500 bg-dark-900/60 flex gap-2">
          <input
            type="text"
            placeholder={
              connectionStatus === "connected"
                ? "Send command in text (e.g. 'spent 500' or 'show budgets')..."
                : "Connect agent to type instructions..."
            }
            disabled={connectionStatus !== "connected" || agentState === "thinking"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                const val = e.target.value.trim();
                addLog("user", `Text Input: "${val}"`);
                sendToAgent(val);
                e.target.value = "";
              }
            }}
            className="flex-1 bg-dark-950 border border-dark-500 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary disabled:opacity-40"
          />
        </div>
      </div>
    </div>
  );
}
