'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ArrowRight, Wifi, Check, Sun, Moon, Monitor } from 'lucide-react';
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

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const checks = [
    { label: 'At least 8 characters', pass: form.password.length >= 8 },
    { label: 'One uppercase letter',  pass: /[A-Z]/.test(form.password) },
    { label: 'One number',            pass: /[0-9]/.test(form.password) },
  ];
  const strength = checks.filter((c) => c.pass).length;

  const strengthColor =
    strength === 0 ? 'var(--border-default)' :
    strength === 1 ? '#DC2626' :
    strength === 2 ? '#D97706' :
                     '#16A34A';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      const { access_token, user } = res.data;
      setAuth(user, access_token);
      toast.success('Account created!');
      router.push('/chat');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo — NovaTech (company) + SupportGPT (the AI service) */}
        <div className="flex items-center gap-2">
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

        {/* Theme toggle */}
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
            Create account
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-tertiary)' }}>
            Get support for your NovaTech devices and orders.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Full name
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-premium"
                placeholder="Alex Johnson"
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-premium"
                placeholder="alex@example.com"
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
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-premium pr-10"
                  placeholder="Create a strong password"
                  autoComplete="new-password"
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

              {/* Strength indicator */}
              {form.password && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background: i <= strength ? strengthColor : 'var(--bg-muted)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    {checks.map(({ label, pass }) => (
                      <div key={label} className="flex items-center gap-2">
                        <Check
                          className="w-3 h-3 flex-shrink-0 transition-colors"
                          style={{ color: pass ? '#16A34A' : 'var(--text-disabled)' }}
                        />
                        <span
                          className="text-xs transition-colors"
                          style={{ color: pass ? 'var(--text-secondary)' : 'var(--text-disabled)' }}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                  Creating account...
                </>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-medium transition-colors"
              style={{ color: 'var(--accent-500)' }}
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
