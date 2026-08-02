import { useState, useRef, useEffect } from 'react'
import api from '../services/api'

const SUGGESTIONS = [
  "set food budget to 8000",
  "spent 350 at Starbucks for Coffee",
  "create goal iPhone target 80000",
  "buy 10 shares of RELIANCE",
  "show my budgets",
  "my investments",
]

// Simple bold and line break text formatter
const formatMessage = (text) => {
  if (!text) return '';
  const parts = text.split('\n');
  return parts.map((part, index) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const items = [];
    let lastIndex = 0;
    let match;
    while ((match = boldRegex.exec(part)) !== null) {
      if (match.index > lastIndex) {
        items.push(part.substring(lastIndex, match.index));
      }
      items.push(<strong key={match.index} className="text-white font-bold">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }
    if (lastIndex < part.length) {
      items.push(part.substring(lastIndex));
    }
    return <div key={index} className="min-h-[1.2rem]">{items}</div>;
  });
};

function AgentThoughtBlock({ thoughts, actions }) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!thoughts && (!actions || actions.length === 0)) return null;
  
  return (
    <div className="mt-3 border border-dark-400/40 rounded-xl overflow-hidden bg-dark-800/60 shadow-lg transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-dark-700/50 hover:bg-dark-700/80 text-xs font-semibold text-gray-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={isOpen ? "animate-pulse text-primary" : "text-gray-400"}>🧠</span>
          <span>Agent Execution Trace {actions?.length > 0 && `(${actions.length} tool${actions.length > 1 ? 's' : ''})`}</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono bg-dark-900/50 px-2 py-0.5 rounded border border-dark-500">
          {isOpen ? 'CLOSE ▲' : 'EXPAND ▼'}
        </span>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-dark-400/20 space-y-4 bg-dark-900/30">
          {thoughts && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1.5">
                <span>💭</span> Thought Monologue
              </div>
              <div className="font-mono text-[11px] text-primary/90 bg-dark-900 border border-dark-500/50 rounded-lg p-3 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto shadow-inner">
                {thoughts}
              </div>
            </div>
          )}
          
          {actions && actions.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2 flex items-center gap-1.5">
                <span>🔧</span> Active Tool Invocations
              </div>
              <div className="space-y-2.5">
                {actions.map((act, i) => {
                  const isSuccess = act.result?.status === 'success';
                  return (
                    <div key={i} className="border border-dark-500 rounded-lg p-3 bg-dark-800/40 hover:border-dark-400 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                            {act.tool}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 ${
                          isSuccess 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-green-400 animate-ping' : 'bg-red-400'}`} />
                          {isSuccess ? 'Success' : 'Error'}
                        </span>
                      </div>
                      
                      {act.arguments && Object.keys(act.arguments).length > 0 && (
                        <div className="mb-2 text-[11px] text-gray-400 font-mono bg-dark-900 p-2 rounded border border-dark-500/40 overflow-x-auto">
                          <span className="text-gray-500 font-semibold">// Parameters:</span>
                          <pre className="text-cyan-300 mt-1 whitespace-pre-wrap">
                            {JSON.stringify(act.arguments, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-300 flex items-start gap-2 bg-dark-700/40 p-2.5 rounded border border-dark-500/20">
                        <span className="text-sm">✔</span>
                        <span>{act.result?.message || 'Action executed successfully.'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: "Hi! I'm your AI financial assistant 💎 I'm now running in **Agent Mode**. I can directly query your transactions, configure budgets, contribute to savings goals, and trade assets. Try asking me: `set a budget of ₹8000 for Food` or `spent 350 at Starbucks`!" 
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await api.post('/api/chat/', { message: msg })
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: res.data.response, 
          suggestions: res.data.suggestions,
          thoughts: res.data.thoughts,
          actions: res.data.actions
        }
      ])
      
      // Dispatch database write action notifications to the rest of the application
      if (res.data.actions && res.data.actions.length > 0) {
        const hasWriteAction = res.data.actions.some(act => 
          ['create_transaction', 'create_budget', 'create_savings_goal', 'add_savings_contribution', 'trade_asset'].includes(act.tool) &&
          act.result?.status === 'success'
        );
        if (hasWriteAction) {
          window.dispatchEvent(new CustomEvent('new-transaction-event'));
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect to the AI service. Make sure the backend is running and check your API keys in .env" }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Header */}
      <div className="border-b border-dark-500 px-6 py-4 flex items-center gap-3 bg-dark-800 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center text-base shadow-[0_0_15px_rgba(0,212,255,0.4)] animate-pulse">🤖</div>
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>AI Financial Agent</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 tracking-wider uppercase font-semibold">Active</span>
          </div>
          <div className="text-xs text-green-400 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
            Connected to database sandbox
          </div>
        </div>
        <button 
          onClick={() => { 
            api.delete('/api/chat/history').catch(() => {}); 
            setMessages([{ role: 'assistant', content: "Chat cleared! How can I help you, boss?" }]) 
          }}
          className="ml-auto text-xs text-gray-400 hover:text-white bg-dark-700/60 hover:bg-dark-600 border border-dark-500 rounded-lg px-3 py-1.5 transition-all"
        >
          Clear history
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-dark-900 to-dark-800">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-lg ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-primary to-accent text-dark-900 font-bold rounded-br-sm shadow-[0_4px_15px_rgba(0,212,255,0.2)]'
                : 'bg-dark-700 border border-dark-500 text-gray-200 rounded-bl-sm border-l-4 border-l-primary'
            }`}>
              <div className="space-y-1">
                {msg.role === 'user' ? msg.content : formatMessage(msg.content)}
              </div>
              
              {msg.role === 'assistant' && (msg.thoughts || msg.actions?.length > 0) && (
                <AgentThoughtBlock thoughts={msg.thoughts} actions={msg.actions} />
              )}
              
              {msg.suggestions?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-dark-500/40">
                  {msg.suggestions.map((s, si) => (
                    <button key={si} onClick={() => sendMessage(s)}
                      className="text-xs bg-dark-800 border border-dark-500 text-gray-300 rounded-full px-3.5 py-1.5 hover:border-primary hover:text-primary transition-all duration-200 font-medium">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-700 border border-dark-500 rounded-2xl rounded-bl-sm px-5 py-4 shadow-lg border-l-4 border-l-primary/40">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce shadow-[0_0_10px_rgba(0,212,255,0.4)]" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
                <span className="text-xs font-semibold text-gray-400 font-mono">Agent thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions Container */}
      <div className="px-6 pb-2.5 pt-1.5 flex gap-2 overflow-x-auto bg-dark-800/20 border-t border-dark-500/20">
        {SUGGESTIONS.map(s => (
          <button 
            key={s} 
            onClick={() => sendMessage(s)} 
            className="text-xs bg-dark-800/80 border border-dark-500 hover:border-primary/50 text-gray-400 hover:text-primary rounded-full px-4 py-2 transition-all shrink-0 font-medium"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-dark-500 px-6 py-5 flex gap-3 bg-dark-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Command the AI agent (e.g. 'set budget of 5000 for Food', 'spent 400 at Uber')..."
          disabled={loading}
          className="flex-1 bg-dark-900 border border-dark-500 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-all duration-200 disabled:opacity-50 shadow-inner"
        />
        <button 
          onClick={() => sendMessage()} 
          disabled={loading || !input.trim()}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-95 text-dark-900 font-bold px-6 py-3 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(0,212,255,0.2)]"
        >
          Send Command
        </button>
      </div>
    </div>
  )
}
