'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, MessageSquare, Plus, BarChart2, Shield,
  LogOut, ChevronLeft, Trash2, X, Moon, Sun, Monitor,
  PanelLeftClose, PanelLeft, Settings, ChevronUp
} from 'lucide-react';
import { useAuthStore, useChatStore, usePreferencesStore } from '@/lib/store';
import { historyAPI, userAPI } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Avatar } from '@/components/Avatar';
import toast from 'react-hot-toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth, updateUser } = useAuthStore();
  const { sessions, setSessions, setCurrentSession, clearMessages, resetChatStore, currentSessionId } = useChatStore();
  const { preferences, loaded, setPreferences, setLoaded } = usePreferencesStore();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSessions(); }, []);

  // Defensive sync: always pull the full profile (including full_name and
  // profile_picture) into the auth store on mount. This guards against the
  // login/register response ever being out of sync with the full profile
  // endpoint again in the future — the sidebar avatar no longer depends
  // solely on what the login call happened to return.
  useEffect(() => {
    userAPI.getProfile()
      .then((res) => {
        updateUser({
          full_name: res.data.full_name,
          profile_picture: res.data.profile_picture,
        });
      })
      .catch(() => {});
  }, []);

  // Load preferences once per session and apply font-size app-wide
  useEffect(() => {
    if (!loaded) loadPreferences();
  }, [loaded]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', preferences.font_size);
  }, [preferences.font_size]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadSessions = async () => {
    try {
      const res = await historyAPI.getSessions();
      setSessions(res.data);
    } catch {}
  };

  const loadPreferences = async () => {
    try {
      const res = await userAPI.getPreferences();
      setPreferences(res.data);
    } catch {
      // Non-fatal — defaults already in the store
    } finally {
      setLoaded(true);
    }
  };

  const handleNewChat = () => {
    clearMessages();
    router.push('/chat');
    setMobileOpen(false);
  };

  const handleSessionClick = (sessionId: string) => {
    // Don't set currentSessionId here — loadSession() on the chat page
    // sets it after actually fetching. Setting it eagerly here caused a
    // race: by the time the chat page's loading effect ran, currentSessionId
    // already matched the new session (and the old messages hadn't been
    // cleared yet), so the "should I fetch?" check saw no difference and
    // silently skipped loading — every click after the very first one.
    router.push(`/chat?session=${sessionId}`);
    setMobileOpen(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await historyAPI.deleteConversation(sessionId);
      setSessions(sessions.filter((s) => s.session_id !== sessionId));
      if (currentSessionId === sessionId) { clearMessages(); router.push('/chat'); }
      toast.success('Conversation deleted');
    } catch { toast.error('Delete failed'); }
  };

  const handleLogout = async () => {
    try { await userAPI.logout(); } catch {}
    clearAuth();
    // Fully reset the chat store too — otherwise messages, the session
    // list, and the "current session" pointer from THIS account survive
    // in memory (since logout navigates client-side, not a full page
    // reload) and can cause the next login's history clicks to silently
    // no-op, or briefly show the previous account's messages.
    resetChatStore();
    router.push('/auth/login');
  };

  const themeOptions = [
    { key: 'light', icon: Sun },
    { key: 'system', icon: Monitor },
    { key: 'dark', icon: Moon },
  ] as const;

  const navItems = [
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/analytics', icon: BarChart2, label: 'Analytics' },
    ...(user?.role === 'admin' ? [{ href: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  const displayName = user?.full_name || user?.name || '';

  const SidebarInner = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`flex items-center h-14 px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-600)' }}>
              <Wifi className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>NovaTech</span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>SupportGPT</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn btn-ghost p-1.5 hidden lg:flex"
        >
          {collapsed
            ? <PanelLeft className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            : <PanelLeftClose className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          }
        </button>
      </div>

      {/* New Chat */}
      <div className="p-2 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
          style={{
            background: 'var(--accent-600)',
            color: 'white',
          }}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Nav */}
      <div className="px-2 space-y-0.5 flex-shrink-0">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href === '/chat' && pathname.startsWith('/chat'));
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
              <div className={`nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {/* History */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden flex flex-col mt-4 min-h-0">
          <div className="px-3 mb-1.5 flex-shrink-0">
            <span className="text-xs font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-disabled)', letterSpacing: '0.08em' }}>
              Recents
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
            {sessions.length === 0 ? (
              <p className="text-xs px-3 py-2" style={{ color: 'var(--text-disabled)' }}>No conversations yet</p>
            ) : (
              sessions.slice(0, 25).map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => handleSessionClick(session.session_id)}
                  className="group nav-item"
                  style={currentSessionId === session.session_id ? { background: 'var(--bg-muted)', color: 'var(--text-primary)' } : {}}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-disabled)' }} />
                  <span className="flex-1 truncate text-xs">{session.preview || 'New conversation'}</span>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.session_id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom */}
      <div className="flex-shrink-0 p-2 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {/* Theme toggle */}
        {!collapsed && (
          <div className="flex items-center gap-1 p-1 rounded-lg mx-1" style={{ background: 'var(--bg-subtle)' }}>
            {themeOptions.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className="flex-1 flex items-center justify-center p-1.5 rounded-md transition-all"
                style={{
                  background: theme === key ? 'var(--bg-elevated)' : 'transparent',
                  color: theme === key ? 'var(--text-primary)' : 'var(--text-disabled)',
                  boxShadow: theme === key ? 'var(--shadow-xs)' : 'none',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}

        {/* User — click to open Settings/Logout dropdown */}
        <div className="relative" ref={userMenuRef}>
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 right-0 mb-2 rounded-xl overflow-hidden z-10"
                style={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                <Link
                  href="/settings"
                  onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Settings className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  Settings
                </Link>
                <div style={{ height: 1, background: 'var(--border-subtle)' }} />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left"
                  style={{ color: 'var(--error)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors ${collapsed ? 'justify-center' : ''}`}
            style={{ background: userMenuOpen ? 'var(--bg-subtle)' : 'transparent' }}
          >
            <Avatar profilePicture={user?.profile_picture} name={displayName} className="w-7 h-7" textClassName="text-xs" />
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                  <p className="text-xs truncate capitalize" style={{ color: 'var(--text-tertiary)' }}>{user?.role}</p>
                </div>
                <ChevronUp
                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
                  style={{ color: 'var(--text-disabled)', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }}
                />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 56 : 232 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{ background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-subtle)' }}
      >
        <SidebarInner />
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgb(0 0 0 / 0.4)', backdropFilter: 'blur(4px)' }}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-60 z-50 flex flex-col"
              style={{ background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-subtle)' }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3.5 btn btn-ghost p-1.5"
              >
                <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </button>
              <SidebarInner />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header
          className="lg:hidden flex items-center h-12 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
        >
          <button onClick={() => setMobileOpen(true)} className="btn btn-ghost p-1.5 mr-3">
            <PanelLeft className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'var(--accent-600)' }}>
              <Wifi className="w-3 h-3 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>NovaTech</span>
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-tertiary)' }}>SupportGPT</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
