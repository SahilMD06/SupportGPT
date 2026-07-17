'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Shield, Monitor, Sparkles, Laptop, Loader2, Save, Download,
  Trash2, LogOut, Eye, EyeOff, Check, X, AlertTriangle, Sun, Moon,
  Smartphone, Globe, Bell, Lock, Languages,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '@/components/layout/AppLayout';
import { userAPI } from '@/lib/api';
import { useAuthStore, usePreferencesStore, LANGUAGE_OPTIONS } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { getErrorMessage } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { AVATAR_PRESETS, presetAvatarValue, isPresetAvatar } from '@/lib/avatar';

type Tab = 'profile' | 'account' | 'sessions' | 'appearance' | 'ai';

function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: any; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0"
      style={{
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        boxShadow: active ? 'var(--shadow-xs)' : 'none',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
      {children}
    </label>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {subtitle && <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="pr-4">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors"
        style={{ background: checked ? 'var(--accent-600)' : 'var(--bg-muted)' }}
      >
        <motion.div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 18 : 2 }}
          transition={{ duration: 0.15 }}
        />
      </button>
    </div>
  );
}

// ─── Profile Tab ────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: '', full_name: '', email: '', phone: '', date_of_birth: '', profile_picture: '',
  });

  useEffect(() => {
    userAPI.getProfile()
      .then((res) => {
        const p = res.data;
        setForm({
          username: p.username || '',
          full_name: p.full_name || '',
          email: p.email || '',
          phone: p.phone || '',
          date_of_birth: p.date_of_birth || '',
          profile_picture: p.profile_picture || '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await userAPI.updateProfile(form);
      updateUser({
        full_name: res.data.full_name,
        profile_picture: res.data.profile_picture,
      });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
      </div>
    );
  }

  return (
    <SectionCard title="Profile information" subtitle="Update your personal details">
      <div className="flex items-center gap-4 mb-5">
        <Avatar profilePicture={form.profile_picture} name={form.full_name || user?.name} className="w-16 h-16" textClassName="text-xl" />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Profile picture</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Choose a color avatar below, or paste an image link</p>
        </div>
      </div>

      <div className="mb-5">
        <FieldLabel>Choose an avatar</FieldLabel>
        <div className="flex flex-wrap gap-2.5">
          {AVATAR_PRESETS.map((preset) => {
            const value = presetAvatarValue(preset);
            const selected = form.profile_picture === value;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                onClick={() => setForm({ ...form, profile_picture: value })}
                className="w-11 h-11 rounded-full overflow-hidden transition-transform"
                style={{
                  outline: selected ? '2px solid var(--text-primary)' : 'none',
                  outlineOffset: 2,
                  transform: selected ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <Avatar profilePicture={value} name={form.full_name || user?.name} className="w-11 h-11" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <FieldLabel>Or paste an image link</FieldLabel>
        <input
          type="url"
          value={isPresetAvatar(form.profile_picture) ? '' : form.profile_picture}
          onChange={(e) => setForm({ ...form, profile_picture: e.target.value })}
          className="input-premium"
          placeholder="https://example.com/your-photo.jpg"
        />
        {form.profile_picture && (
          <button
            type="button"
            onClick={() => setForm({ ...form, profile_picture: '' })}
            className="text-xs mt-1.5 font-medium"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Clear picture
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Username</FieldLabel>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="input-premium"
            placeholder="alexj"
          />
        </div>
        <div>
          <FieldLabel>Full name</FieldLabel>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="input-premium"
            placeholder="Alex Johnson"
          />
        </div>
        <div>
          <FieldLabel>Email address</FieldLabel>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input-premium"
            placeholder="alex@example.com"
          />
        </div>
        <div>
          <FieldLabel>Phone number</FieldLabel>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="input-premium"
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div>
          <FieldLabel>Date of birth</FieldLabel>
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            className="input-premium"
          />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-md mt-5">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save changes</>}
      </button>
    </SectionCard>
  );
}

// ─── Account Tab ────────────────────────────────────────────────────────────

function ChangePasswordCard() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error("New passwords don't match");
      return;
    }
    if (form.new_password.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await userAPI.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      toast.success('Password changed. Please sign in again.');
      setTimeout(() => { clearAuth(); router.push('/auth/login'); }, 1200);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Change password" subtitle="Changing your password signs you out everywhere">
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <FieldLabel>Current password</FieldLabel>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              required
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              className="input-premium pr-10"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-disabled)' }}>
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <FieldLabel>New password</FieldLabel>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              required
              minLength={8}
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              className="input-premium pr-10"
            />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-disabled)' }}>
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <FieldLabel>Confirm new password</FieldLabel>
          <input
            type={showNew ? 'text' : 'password'}
            required
            value={form.confirm_password}
            onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
            className="input-premium"
          />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary btn-md mt-1">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</> : 'Update password'}
        </button>
      </form>
    </SectionCard>
  );
}

function DeleteAccountModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(password);
    setConfirming(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgb(0 0 0 / 0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--error-bg)' }}>
            <AlertTriangle className="w-4.5 h-4.5" style={{ color: 'var(--error)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Delete account</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>This cannot be undone</p>
          </div>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          This permanently deletes your profile, conversation history, and preferences.
          Enter your password to confirm.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-premium mb-4"
          placeholder="Enter your password"
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-secondary btn-md flex-1">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!password || confirming}
            className="btn btn-danger btn-md flex-1"
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete permanently'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccountTab() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const { preferences, setPreferences } = usePreferencesStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const savePref = async (patch: Partial<typeof preferences>) => {
    setPreferences(patch);
    try {
      await userAPI.updatePreferences(patch);
    } catch {
      toast.error('Failed to save preference');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await userAPI.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novatech-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Data export downloaded');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (password: string) => {
    try {
      await userAPI.deleteAccount(password);
      toast.success('Account deleted');
      clearAuth();
      router.push('/auth/login');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to delete account'));
    }
  };

  return (
    <div className="space-y-4">
      <ChangePasswordCard />

      <SectionCard title="Privacy">
        <ToggleRow
          label="Share anonymized usage data"
          description="Helps NovaTech improve AI response quality"
          checked={preferences.privacy_preferences?.share_analytics ?? true}
          onChange={(v) => savePref({ privacy_preferences: { ...preferences.privacy_preferences, share_analytics: v } })}
        />
      </SectionCard>

      <SectionCard title="Your data">
        <button onClick={handleExport} disabled={exporting} className="btn btn-secondary btn-md">
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export my data
        </button>
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Downloads a JSON file with your profile, preferences, and conversation history.
        </p>
      </SectionCard>

      <div className="card p-5" style={{ borderColor: 'rgba(220,38,38,0.25)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--error)' }}>Danger zone</h3>
        <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Permanently delete your account and all associated data
        </p>
        <button onClick={() => setShowDeleteModal(true)} className="btn btn-danger btn-md">
          <Trash2 className="w-3.5 h-3.5" /> Delete account
        </button>
      </div>

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteAccountModal onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sessions Tab ───────────────────────────────────────────────────────────

function SessionsTab() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    userAPI.getSessions()
      .then((res) => setSessions(res.data))
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      await userAPI.logoutAll();
      toast.success('Logged out of all devices');
      clearAuth();
      router.push('/auth/login');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to log out'));
      setLoggingOutAll(false);
    }
  };

  const deviceIcon = (device: string) => {
    const d = device.toLowerCase();
    if (d.includes('iphone') || d.includes('android')) return Smartphone;
    if (d.includes('ipad')) return Laptop;
    return Laptop;
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Active sessions</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Devices currently signed into your account</p>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No active sessions found</p>
          </div>
        ) : (
          sessions.map((s, i) => {
            const Icon = deviceIcon(s.device);
            return (
              <div key={s.session_id}
                className="flex items-center gap-4 px-5 py-3.5"
                style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-subtle)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.device}</p>
                    {s.is_current && (
                      <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(22,163,74,0.25)' }}>
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {s.ip_address} · Last active {new Date(s.last_active).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sign out everywhere</h3>
        <p className="text-xs mt-0.5 mb-4" style={{ color: 'var(--text-tertiary)' }}>
          This signs you out on this device and all others — you'll need to log in again.
        </p>
        <button onClick={handleLogoutAll} disabled={loggingOutAll} className="btn btn-secondary btn-md">
          {loggingOutAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          Log out of all devices
        </button>
      </div>
    </div>
  );
}

// ─── Appearance Tab ─────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const { preferences, setPreferences } = usePreferencesStore();

  const savePref = async (patch: Partial<typeof preferences>) => {
    setPreferences(patch);
    try {
      await userAPI.updatePreferences(patch);
    } catch {
      toast.error('Failed to save preference');
    }
  };

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    savePref({ theme_preference: value });
  };

  const themeOptions = [
    { key: 'light' as const, icon: Sun, label: 'Light' },
    { key: 'system' as const, icon: Monitor, label: 'System' },
    { key: 'dark' as const, icon: Moon, label: 'Dark' },
  ];

  const fontOptions = [
    { key: 'small', label: 'Small', sample: 'text-xs' },
    { key: 'medium', label: 'Medium', sample: 'text-sm' },
    { key: 'large', label: 'Large', sample: 'text-base' },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="Theme" subtitle="Choose how NovaTech Support looks">
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => handleThemeChange(key)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
              style={{
                border: `1.5px solid ${theme === key ? 'var(--accent-500)' : 'var(--border-default)'}`,
                background: theme === key ? 'var(--accent-50)' : 'var(--bg-subtle)',
              }}
            >
              <Icon className="w-5 h-5" style={{ color: theme === key ? 'var(--accent-600)' : 'var(--text-tertiary)' }} />
              <span className="text-xs font-medium" style={{ color: theme === key ? 'var(--accent-700)' : 'var(--text-secondary)' }}>{label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Font size" subtitle="Adjust text size across the app">
        <div className="grid grid-cols-3 gap-3">
          {fontOptions.map(({ key, label, sample }) => (
            <button
              key={key}
              onClick={() => savePref({ font_size: key })}
              className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
              style={{
                border: `1.5px solid ${preferences.font_size === key ? 'var(--accent-500)' : 'var(--border-default)'}`,
                background: preferences.font_size === key ? 'var(--accent-50)' : 'var(--bg-subtle)',
              }}
            >
              <span className={sample} style={{ color: preferences.font_size === key ? 'var(--accent-700)' : 'var(--text-secondary)', fontWeight: 600 }}>Aa</span>
              <span className="text-xs font-medium" style={{ color: preferences.font_size === key ? 'var(--accent-700)' : 'var(--text-secondary)' }}>{label}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── AI Preferences Tab ─────────────────────────────────────────────────────

function AIPreferencesTab() {
  const { preferences, setPreferences } = usePreferencesStore();

  const savePref = async (patch: Partial<typeof preferences>) => {
    setPreferences(patch);
    try {
      await userAPI.updatePreferences(patch);
      toast.success('Preference saved');
    } catch {
      toast.error('Failed to save preference');
    }
  };

  const lengthOptions = [
    { key: 'concise', label: 'Concise', desc: '2-3 sentences' },
    { key: 'balanced', label: 'Balanced', desc: 'Default length' },
    { key: 'detailed', label: 'Detailed', desc: 'Comprehensive answers' },
  ];

  return (
    <div className="space-y-4">
      <SectionCard title="AI model" subtitle="Which model powers your support agents">
        <select
          value={preferences.ai_model}
          onChange={(e) => savePref({ ai_model: e.target.value })}
          className="input-premium max-w-xs"
        >
          <option value="gemini-2.5-flash">Gemini 2.5 Flash (recommended)</option>
        </select>
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Currently the only validated model for this deployment. Additional models can be enabled later.
        </p>
      </SectionCard>

      <SectionCard title="Response language" subtitle="Which language should agents reply in">
        <div className="flex items-center gap-2 max-w-xs">
          <Languages className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          <select
            value={preferences.response_language}
            onChange={(e) => savePref({ response_language: e.target.value })}
            className="input-premium"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
          Auto-detect replies in whatever language you write in. Choosing a specific
          language always responds in that language, even if you type in another.
        </p>
      </SectionCard>

      <SectionCard title="Response length" subtitle="How detailed should agent replies be">
        <div className="grid sm:grid-cols-3 gap-3">
          {lengthOptions.map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => savePref({ response_length: key })}
              className="flex flex-col items-start gap-1 p-3.5 rounded-xl text-left transition-all"
              style={{
                border: `1.5px solid ${preferences.response_length === key ? 'var(--accent-500)' : 'var(--border-default)'}`,
                background: preferences.response_length === key ? 'var(--accent-50)' : 'var(--bg-subtle)',
              }}
            >
              <span className="text-sm font-medium" style={{ color: preferences.response_length === key ? 'var(--accent-700)' : 'var(--text-primary)' }}>{label}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Chat display">
        <ToggleRow
          label="Show source citations"
          description="Display which document an answer was grounded in"
          checked={preferences.show_citations}
          onChange={(v) => savePref({ show_citations: v })}
        />
        <div style={{ height: 1, background: 'var(--border-subtle)' }} />
        <ToggleRow
          label="Show suggested questions"
          description="Display example prompts on a new chat"
          checked={preferences.show_suggestions}
          onChange={(v) => savePref({ show_suggestions: v })}
        />
      </SectionCard>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Lock },
    { id: 'sessions', label: 'Sessions', icon: Globe },
    { id: 'appearance', label: 'Appearance', icon: Monitor },
    { id: 'ai', label: 'AI Preferences', icon: Sparkles },
  ];

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Settings
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Manage your profile, account, and preferences
            </p>
          </div>

          <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto"
            style={{ background: 'var(--bg-subtle)' }}>
            {tabs.map((t) => (
              <TabButton
                key={t.id}
                active={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                icon={t.icon}
                label={t.label}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'account' && <AccountTab />}
              {activeTab === 'sessions' && <SessionsTab />}
              {activeTab === 'appearance' && <AppearanceTab />}
              {activeTab === 'ai' && <AIPreferencesTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
