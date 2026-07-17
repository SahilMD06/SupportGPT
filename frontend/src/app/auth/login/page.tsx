'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ArrowRight, Wifi, Sun, Moon, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { getErrorMessage } from '@/lib/errors';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { key: 'light' as const, icon: Sun },
    { key: 'system' as const, icon: Monitor },
    { key: 'dark' as const, icon: Moon },
  ];
  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-lg"
      style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {options.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          title={key.charAt(0).toUpperCase() + key.slice(1)}
          className="p-1.5 rounded-md transition-all"
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
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      const { access_token, user } = res.data;
      setAuth(user, access_token);
      toast.success('Welcome back!');
      router.push('/chat');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>

      {/* ── Left branding panel (desktop only) ── */}
      <div
        className="hidden lg:flex flex-col w-[460px] flex-shrink-0 relative overflow-hidden"
        style={{
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 15%, rgba(14,165,233,0.14) 0%, transparent 55%), radial-gradient(circle at 75% 85%, rgba(56,189,248,0.10) 0%, transparent 55%)',
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo — NovaTech (company) + SupportGPT (the AI service that powers support) */}
          <div className="flex items-center gap-2.5 mb-16">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-600)' }}
            >
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                NovaTech Solutions
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--accent-500)' }}>
                SupportGPT
              </span>
            </div>
          </div>

          {/* Hero text */}
          <div className="flex-1">
            <p
              className="text-xs font-semibold uppercase mb-5"
              style={{ color: 'var(--accent-500)', letterSpacing: '0.1em' }}
            >
              Smart Home Support
            </p>
            <h1
              className="text-3xl font-semibold leading-snug mb-5"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Smart devices deserve smart support
            </h1>
            <p className="text-sm leading-relaxed mb-10" style={{ color: 'var(--text-tertiary)' }}>
              SupportGPT, NovaTech's AI support platform, routes every question to the
              right specialist automatically — five agents working together to help you
              faster.
            </p>

            {/* Agent list */}
            <div className="space-y-3.5">
              {[
                { emoji: '💳', label: 'Billing Agent',   desc: 'Orders, refunds, payment plans' },
                { emoji: '🔧', label: 'Technical Agent', desc: 'Device setup, app issues, troubleshooting' },
                { emoji: '📦', label: 'Product Agent',   desc: 'Devices, specs, bundles & pricing' },
                { emoji: '🎯', label: 'Complaint Agent', desc: 'Escalations, damaged or delayed orders' },
                { emoji: '❓', label: 'FAQ Agent',       desc: 'Shipping, warranty, general questions' },
              ].map((agent) => (
                <div key={agent.label} className="flex items-center gap-3">
                  <span className="text-base w-6 text-center">{agent.emoji}</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {agent.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      — {agent.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs mt-8" style={{ color: 'var(--text-disabled)' }}>
            Powering smarter homes, one device at a time
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'var(--accent-600)' }}
            >
              <Wifi className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                NovaTech Solutions
              </span>
              <span className="text-[10px] font-medium" style={{ color: 'var(--accent-500)' }}>
                SupportGPT
              </span>
            </div>
          </div>
          <div className="hidden lg:block" />

          {/* Theme toggle — visible on all screen sizes */}
          <ThemeToggle />
        </div>

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm"
          >
            <h2
              className="text-2xl font-semibold mb-1"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Sign in
            </h2>
            <p className="text-sm mb-8" style={{ color: 'var(--text-tertiary)' }}>
              Welcome back — enter your credentials to continue.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-premium"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input-premium pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-disabled)' }}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-md w-full mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              Don't have an account?{' '}
              <Link
                href="/auth/register"
                className="font-medium transition-colors"
                style={{ color: 'var(--accent-500)' }}
              >
                Create one
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
