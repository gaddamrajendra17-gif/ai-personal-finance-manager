import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const typeStyles = {
  success: { bg: "bg-green-50", icon: "✅", dot: "bg-green-500" },
  warning: { bg: "bg-yellow-50", icon: "⚠️", dot: "bg-yellow-500" },
  danger:  { bg: "bg-red-50",   icon: "🚨", dot: "bg-red-500" },
  info:    { bg: "bg-blue-50",  icon: "ℹ️",  dot: "bg-blue-500" },
};

export default function NotificationBell({ token, userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [notifRes, countRes] = await Promise.all([
        axios.get(`${API}/api/notifications/?limit=20`, { headers }),
        axios.get(`${API}/api/notifications/unread-count`, { headers }),
      ]);
      setNotifications(notifRes.data);
      setUnreadCount(countRes.data.count);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const handler = (e) => {
      const notif = e.detail;
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    };
    
    window.addEventListener('new-notification-event', handler);
    return () => {
      window.removeEventListener('new-notification-event', handler);
    };
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { const i = setInterval(fetchNotifications, 30000); return () => clearInterval(i); }, [fetchNotifications]);
  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id) => {
    await axios.post(`${API}/api/notifications/${id}/read`, {}, { headers });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await axios.post(`${API}/api/notifications/mark-all-read`, {}, { headers });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    await axios.delete(`${API}/api/notifications/${id}`, { headers });
    const deleted = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (deleted && !deleted.is_read) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m/60)}h ago`;
    return `${Math.floor(m/1440)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <span>🔔</span>
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-blue-100 hover:text-white underline">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading && <div className="flex items-center justify-center py-8 text-gray-400"><span className="animate-spin mr-2">⏳</span> Loading...</div>}
            {!loading && notifications.length === 0 && (
              <div className="py-12 text-center text-gray-400"><div className="text-4xl mb-2">🎉</div><p className="text-sm">You are all caught up!</p></div>
            )}
            {notifications.map(n => {
              const style = typeStyles[n.type] || typeStyles.info;
              return (
                <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? style.bg : ""}`}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm text-gray-800 ${!n.is_read ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.is_read && <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>}
                        <button onClick={(e) => deleteNotif(n.id, e)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t text-center">
              <button onClick={fetchNotifications} className="text-xs text-blue-600 hover:underline">🔄 Refresh</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
