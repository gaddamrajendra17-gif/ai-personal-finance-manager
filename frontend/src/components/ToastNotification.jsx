import { useEffect } from "react";

const toastStyles = {
  success: {
    border: "border-emerald-500/30",
    bg: "bg-slate-900/90 backdrop-blur-md",
    glow: "shadow-emerald-950/20",
    iconBg: "bg-emerald-500/10 text-emerald-400",
    icon: "💰",
  },
  danger: {
    border: "border-rose-500/30",
    bg: "bg-slate-900/90 backdrop-blur-md",
    glow: "shadow-rose-950/20 animate-pulse",
    iconBg: "bg-rose-500/10 text-rose-400",
    icon: "🚨",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-slate-900/90 backdrop-blur-md",
    glow: "shadow-amber-950/20",
    iconBg: "bg-amber-500/10 text-amber-400",
    icon: "⚠️",
  },
  info: {
    border: "border-sky-500/30",
    bg: "bg-slate-900/90 backdrop-blur-md",
    glow: "shadow-sky-950/20",
    iconBg: "bg-sky-500/10 text-sky-400",
    icon: "ℹ️",
  },
};

export default function ToastNotification({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type] || toastStyles.info;
        return (
          <ToastCard 
            key={toast.id} 
            toast={toast} 
            style={style} 
            onClose={() => removeToast(toast.id)} 
          />
        );
      })}
    </div>
  );
}

function ToastCard({ toast, style, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`pointer-events-auto flex items-start gap-4 p-4 rounded-2xl border ${style.border} ${style.bg} ${style.glow} shadow-2xl transform transition-all duration-300 hover:scale-102 translate-x-0 animate-slide-in`}>
      <div className={`p-2.5 rounded-xl ${style.iconBg} text-xl flex-shrink-0 flex items-center justify-center font-bold`}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-white font-extrabold text-sm tracking-tight">{toast.title}</p>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            ✕
          </button>
        </div>
        <p className="text-slate-350 text-xs mt-1 leading-relaxed">{toast.message}</p>
        
        {toast.category && (
          <span className="inline-block mt-2 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            🏷️ {toast.category}
          </span>
        )}
      </div>
    </div>
  );
}
