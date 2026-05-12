import { useEffect, useState } from 'react';
import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import type { Notification, NotificationSeverity } from '../../types/notification';
import { SETTINGS_PREFS_KEY } from '../../utils/themePreference';
import { Badge } from '../ui/Badge';

const severityTone: Record<NotificationSeverity, 'blue' | 'green' | 'orange' | 'red'> = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  critical: 'red',
};

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString();
}

function readNotificationsEnabled() {
  const raw = localStorage.getItem(SETTINGS_PREFS_KEY);
  if (!raw) return true;

  try {
    const preferences = JSON.parse(raw) as { showNotifications?: boolean };
    return preferences.showNotifications !== false;
  } catch {
    return true;
  }
}

export function Topbar({ title = 'SecureOps' }: { title?: string }) {
  const navigate = useNavigate();
  const { logoutUser, user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => readNotificationsEnabled());

  async function loadUnreadCount() {
    if (!isAuthenticated || !notificationsEnabled) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await getUnreadNotificationCount());
    } catch {
      setUnreadCount(0);
    }
  }

  async function loadNotifications() {
    if (!isAuthenticated || !notificationsEnabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const nextNotifications = await getNotifications({ limit: 20 });
      setNotifications(nextNotifications);
      await loadUnreadCount();
    } catch {
      setNotifications([]);
      setError('Notifications are unavailable right now.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUnreadCount();
  }, [isAuthenticated, user?.id, notificationsEnabled]);

  useEffect(() => {
    function syncPreferences() {
      const enabled = readNotificationsEnabled();
      setNotificationsEnabled(enabled);
      if (!enabled) {
        setUnreadCount(0);
        setNotifications([]);
      }
    }

    window.addEventListener('storage', syncPreferences);
    window.addEventListener('secureops-preferences-updated', syncPreferences);
    return () => {
      window.removeEventListener('storage', syncPreferences);
      window.removeEventListener('secureops-preferences-updated', syncPreferences);
    };
  }, []);

  async function handleLogout() {
    await logoutUser();
    navigate('/login', { replace: true });
  }

  async function toggleNotifications() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen && notificationsEnabled) {
      await loadNotifications();
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (notification.is_read) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await loadUnreadCount();
    } catch {
      setError('Could not update notification.');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      setError('');
    } catch {
      setError('Could not update notifications.');
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl lg:ml-72">
      <div className="flex h-20 items-center justify-between gap-4 px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <button className="rounded-xl bg-slate-100 p-2 lg:hidden">
            <Menu size={20} />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
            <div className="mt-1 flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
              <Search size={16} /> Search inventory, events, files...
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge tone="green">
            <span className="mr-1 h-2 w-2 animate-pulseSoft rounded-full bg-emerald-500" /> All Systems Operational
          </Badge>

          <div className="relative">
            <button
              onClick={toggleNotifications}
              className="relative rounded-2xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200"
              title="Notifications"
            >
              <Bell size={18} />
              {notificationsEnabled && unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-extrabold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">Notifications</p>
                    <p className="text-xs font-semibold text-slate-500">{notificationsEnabled ? `${unreadCount} unread` : 'Disabled in Settings'}</p>
                  </div>
                  {notificationsEnabled && (
                    <button
                      onClick={handleMarkAllRead}
                      className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto p-3">
                  {!notificationsEnabled && <p className="px-2 py-6 text-center text-sm font-semibold text-slate-500">Notifications are rejected in Settings.</p>}
                  {notificationsEnabled && isLoading && <p className="px-2 py-6 text-center text-sm font-semibold text-slate-500">Loading notifications...</p>}
                  {notificationsEnabled && !isLoading && error && <p className="rounded-2xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{error}</p>}
                  {notificationsEnabled && !isLoading && !error && notifications.length === 0 && (
                    <p className="px-2 py-6 text-center text-sm font-semibold text-slate-500">No notifications yet.</p>
                  )}
                  {notificationsEnabled && !isLoading && !error && notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => void handleNotificationClick(notification)}
                      className="mb-2 w-full rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {!notification.is_read && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                            <p className="truncate text-sm font-extrabold text-slate-900">{notification.title}</p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">{notification.message}</p>
                        </div>
                        <Badge tone={severityTone[notification.severity]}>{notification.severity}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-400">
                        <span className="capitalize">{notification.category}</span>
                        <span>{formatCreatedAt(notification.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white md:block">
            {user?.role === 'admin' ? 'Admin Profile' : 'User Profile'}
          </div>
          <button onClick={handleLogout} className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition hover:bg-red-50 hover:text-red-600" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
