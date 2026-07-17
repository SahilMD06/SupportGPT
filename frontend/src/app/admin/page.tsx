'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, MessageSquare, Database, Upload, Trash2, RefreshCw,
  Loader2, Shield, ShieldOff, CheckCircle2, AlertCircle, LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '@/components/layout/AppLayout';
import { adminAPI, knowledgeAPI } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

type Tab = 'overview' | 'documents' | 'users' | 'conversations';

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

function StatCard({ icon: Icon, label, value, color = '#0EA5E9' }: {
  icon: any; label: string; value: string | number; color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
        style={{ background: `${color}15` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <p className="text-2xl font-semibold mb-0.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getStats();
      console.log('[Admin Overview] Raw /admin/stats response:', res.data);
      setStats(res.data);
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await adminAPI.rebuildEmbeddings();
      toast.success(res.data.message || 'Vector index rebuilt successfully');
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Rebuild failed'));
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Documents"
          value={stats?.document_count ?? stats?.total_documents ?? stats?.documents ?? stats?.num_documents ?? 0}
          color="#0EA5E9" />
        <StatCard icon={Database} label="Indexed Chunks"
          value={stats?.chunk_count ?? stats?.total_chunks ?? stats?.chunks ?? 0}
          color="#10B981" />
        <StatCard icon={Users} label="Total Users"
          value={stats?.user_count ?? stats?.total_users ?? stats?.users ?? 0}
          color="#F59E0B" />
        <StatCard icon={MessageSquare} label="Conversations"
          value={stats?.conversation_count ?? stats?.total_conversations ?? stats?.conversations ?? 0}
          color="#8B5CF6" />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Vector Index</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Rebuild after uploading or deleting any knowledge base document — changes are not
          reflected automatically.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            Embedding model: {stats?.embedding_model ?? stats?.model ?? 'all-MiniLM-L6-v2'}
          </span>
          <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            Confidence threshold: {stats?.confidence_threshold ?? stats?.rag_confidence_threshold ?? '0.35'}
          </span>
          <span className="badge" style={{
            background: (stats?.index_loaded ?? true) ? 'var(--success-bg)' : 'var(--error-bg)',
            color: (stats?.index_loaded ?? true) ? 'var(--success)' : 'var(--error)',
            border: `1px solid ${(stats?.index_loaded ?? true) ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
          }}>
            {(stats?.index_loaded ?? true) ? 'Index loaded' : 'Index not loaded'}
          </span>
        </div>

        <button onClick={handleRebuild} disabled={rebuilding} className="btn btn-primary btn-md">
          {rebuilding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Rebuild Vector Index
        </button>
      </div>
    </div>
  );
}

// ─── Documents Tab ──────────────────────────────────────────────────────────

function DocumentsTab() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await knowledgeAPI.list();
      setDocs(res.data);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        await knowledgeAPI.upload(formData);
      }
      toast.success(`Uploaded ${files.length} document${files.length > 1 ? 's' : ''}`);
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    try {
      await knowledgeAPI.delete(id);
      setDocs(docs.filter((d) => d.id !== id));
      toast.success(`${filename} deleted — remember to rebuild the index`);
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Upload Documents</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          PDF files only. Upload, then go to Overview to rebuild the index.
        </p>
        <label className="btn btn-primary btn-md inline-flex cursor-pointer">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading...' : 'Upload PDF(s)'}
          <input type="file" accept=".pdf" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Knowledge Base ({docs.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No documents uploaded yet</p>
          </div>
        ) : (
          docs.map((doc, i) => (
            <div key={doc.id}
              className="flex items-center gap-4 px-5 py-3.5"
              style={{ borderBottom: i < docs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-subtle)' }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.filename}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {doc.chunk_count ? `${doc.chunk_count} chunks · ` : ''}
                  {new Date(doc.upload_date).toLocaleDateString()}
                </p>
              </div>
              <span className="badge" style={{
                background: doc.status === 'processed' ? 'var(--success-bg)' : 'var(--warning-bg)',
                color: doc.status === 'processed' ? 'var(--success)' : 'var(--warning)',
                border: `1px solid ${doc.status === 'processed' ? 'rgba(22,163,74,0.25)' : 'rgba(217,119,6,0.25)'}`,
              }}>
                {doc.status === 'processed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {doc.status || 'pending'}
              </span>
              <button
                onClick={() => handleDelete(doc.id, doc.filename)}
                className="p-1.5 rounded-md transition-colors flex-shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setUpdating(userId);
    try {
      await adminAPI.updateUserRole(userId, newRole);
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast.success(`Role updated to ${newRole}`);
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Users ({users.length})
        </h3>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : (
        users.map((u, i) => (
          <div key={u.id}
            className="flex items-center gap-4 px-5 py-3.5"
            style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
              style={{ background: 'var(--accent-600)' }}>
              {u.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{u.email}</p>
            </div>
            <span className="badge" style={{
              background: u.role === 'admin' ? 'var(--accent-50)' : 'var(--bg-subtle)',
              color: u.role === 'admin' ? 'var(--accent-700)' : 'var(--text-tertiary)',
              border: `1px solid ${u.role === 'admin' ? 'var(--accent-200)' : 'var(--border-subtle)'}`,
            }}>
              {u.role}
            </span>
            <button
              onClick={() => toggleRole(u.id, u.role)}
              disabled={updating === u.id}
              className="btn btn-secondary btn-sm flex-shrink-0"
            >
              {updating === u.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : u.role === 'admin' ? (
                <><ShieldOff className="w-3 h-3" /> Revoke admin</>
              ) : (
                <><Shield className="w-3 h-3" /> Make admin</>
              )}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Conversations Tab ──────────────────────────────────────────────────────

function ConversationsTab() {
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.listConversations()
      .then((res) => setConvs(res.data))
      .catch(() => toast.error('Failed to load conversations'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Recent Conversations ({convs.length})
        </h3>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : convs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No conversations yet</p>
        </div>
      ) : (
        convs.map((c, i) => (
          <div key={c.session_id}
            className="flex items-center gap-4 px-5 py-3.5"
            style={{ borderBottom: i < convs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-subtle)' }}>
              <MessageSquare className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {c.user_name || c.user_id}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                {c.message_count ?? c.messages?.length ?? 0} messages · {new Date(c.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  ];

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Admin
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Manage the SupportGPT platform powering NovaTech Solutions support
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
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'documents' && <DocumentsTab />}
              {activeTab === 'users' && <UsersTab />}
              {activeTab === 'conversations' && <ConversationsTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
