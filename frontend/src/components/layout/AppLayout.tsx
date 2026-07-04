'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, MessageSquare, Plus, BarChart2, Shield,
  LogOut, ChevronLeft, Trash2, X, Moon, Sun, Monitor,
  PanelLeftClose, PanelLeft, Settings
} from 'lucide-react';
import { useAuthStore, useChatStore } from '@/lib/store';
import { historyAPI } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import toast from 'react-hot-toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { sessions, setSessions, setCurrentSession, clearMessages, currentSessionId } = useChatStore();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    try {
      const res = await historyAPI.getSessions();
      setSessions(res.data);
    } catch {}
  };

  const handleNewChat = () => {
    clearMessages();
    router.push('/chat');
    setMobileOpen(false);
  };

  const handleSessionClick = (sessionId: string) => {
    setCurrentSession(sessionId);
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

  const handleLogout = () => { clearAuth(); router.push('/auth/login'); };

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

  const SidebarInner = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`flex items-center h-14 px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-600)' }}>
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SupportGPT</span>
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

        {/* User */}
        <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
            style={{ background: 'var(--accent-600)' }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                <p className="text-xs truncate capitalize" style={{ color: 'var(--text-tertiary)' }}>{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md transition-all"
                style={{ color: 'var(--text-disabled)' }}
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
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
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>SupportGPT</span>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
