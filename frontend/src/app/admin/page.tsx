'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Upload, RefreshCw, Users, FileText, MessageSquare,
  Trash2, Database, Loader2, X, File, CheckCircle2, AlertCircle,
  ChevronRight, MoreHorizontal
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { adminAPI, knowledgeAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'documents' | 'users' | 'conversations';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
      style={{
        background: active ? 'var(--bg-elevated)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        boxShadow: active ? 'var(--shadow-xs)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function StatBadge({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--accent-600)15' }}>
        <Icon className="w-4 h-4" style={{ color: 'var(--accent-600)' }} />
      </div>
      <div>
        <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {value?.toLocaleString() ?? '—'}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      </div>
    </div>
  );
}

function UploadZone({ onSuccess }: { onSuccess: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const pdfs = Array.from(fl).filter((f) => f.type === 'application/pdf');
    if (pdfs.length < fl.length) toast.error('Only PDF files are accepted');
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const remove = (i: number) => setFiles(files.filter((_, j) => j !== i));

  const upload = async () => {
    if (!files.length) return;
    setUploading(true);
    const p: Record<string, 'pending' | 'done' | 'error'> = {};
    files.forEach((f) => { p[f.name] = 'pending'; });
    setProgress(p);

    let ok = 0;
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        await knowledgeAPI.upload(fd);
        setProgress((prev) => ({ ...prev, [file.name]: 'done' }));
        ok++;
      } catch {
        setProgress((prev) => ({ ...prev, [file.name]: 'error' }));
      }
    }

    setUploading(false);
    if (ok > 0) {
      toast.success(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
      setTimeout(() => { setFiles([]); setProgress({}); onSuccess(); }, 1200);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl p-8 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? 'var(--accent-500)' : 'var(--border-default)'}`,
          background: dragging ? 'var(--accent-50)' : 'var(--bg-subtle)',
        }}
      >
        <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          Drop PDF files here
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          or click to browse · Max 50MB per file
        </p>
        <input ref={inputRef} type="file" multiple accept=".pdf" className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => {
            const state = progress[f.name];
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <File className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent-500)' }} />
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-disabled)' }}>
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                {state === 'done' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#16A34A' }} />}
                {state === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#DC2626' }} />}
                {!state && (
                  <button onClick={(e) => { e.stopPropagation(); remove(i); }} className="btn btn-ghost p-0.5">
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-disabled)' }} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={upload}
            disabled={uploading}
            className="btn btn-primary btn-md w-full"
          >
            {uploading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
              : <><Upload className="w-3.5 h-3.5" /> Upload {files.length} file{files.length > 1 ? 's' : ''}</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') { router.replace('/chat'); return; }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, d, u, c] = await Promise.all([
        adminAPI.getStats(),
        knowledgeAPI.list(),
        adminAPI.listUsers(),
        adminAPI.listConversations(),
      ]);
      setStats(s.data);
      setDocs(d.data);
      setUsers(u.data);
      setConvs(c.data);
    } catch { toast.error('Failed to load admin data'); }
    finally { setLoading(false); }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await adminAPI.rebuildEmbeddings();
      toast.success(`Rebuilt: ${res.data.chunks_created} chunks from ${res.data.documents_processed} docs`);
      await loadAll();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Rebuild failed');
    } finally { setRebuilding(false); }
  };

  const handleDeleteDoc = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await knowledgeAPI.delete(id);
      setDocs(docs.filter((d) => d.id !== id));
      toast.success('Document deleted');
    } catch { toast.error('Delete failed'); }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminAPI.updateUserRole(userId, role);
      setUsers(users.map((u) => u.id === userId ? { ...u, role } : u));
      toast.success('Role updated');
    } catch { toast.error('Failed to update role'); }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: `Documents (${docs.length})` },
    { id: 'users', label: `Users (${users.length})` },
    { id: 'conversations', label: 'Conversations' },
  ];

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#F59E0B20' }}>
              <Shield className="w-4.5 h-4.5" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Admin
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Manage your SupportGPT platform
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
            style={{ background: 'var(--bg-subtle)' }}>
            {tabs.map((t) => (
              <TabButton key={t.id} active={activeTab === t.id} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </TabButton>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-4 h-20 skeleton" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* ── Overview ── */}
                {activeTab === 'overview' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatBadge label="Total Users" value={stats?.total_users} icon={Users} />
                      <StatBadge label="Conversations" value={stats?.total_conversations} icon={MessageSquare} />
                      <StatBadge label="Documents" value={stats?.total_documents} icon={FileText} />
                      <StatBadge label="Chat Events" value={stats?.total_chat_events} icon={Database} />
                    </div>

                    {/* Vector index card */}
                    <div className="card p-5">
                      <div className="flex items-start justify-between mb-5">
                        <div>
                          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Vector Index
                          </h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            FAISS index for semantic search
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                          style={{
                            background: stats?.faiss_index?.index_loaded ? '#10B98115' : '#EF444415',
                            color: stats?.faiss_index?.index_loaded ? '#10B981' : '#EF4444',
                          }}>
                          <div className="w-1.5 h-1.5 rounded-full"
                            style={{ background: stats?.faiss_index?.index_loaded ? '#10B981' : '#EF4444' }} />
                          {stats?.faiss_index?.index_loaded ? 'Loaded' : 'Not loaded'}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-5">
                        {[
                          { label: 'Chunks', value: stats?.faiss_index?.total_chunks ?? 0 },
                          { label: 'Documents', value: stats?.total_documents ?? 0 },
                          { label: 'Model', value: 'MiniLM-L6' },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg p-3 text-center"
                            style={{ background: 'var(--bg-subtle)' }}>
                            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleRebuild}
                        disabled={rebuilding}
                        className="btn btn-primary btn-md w-full"
                      >
                        {rebuilding
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding index...</>
                          : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild vector index</>
                        }
                      </button>
                    </div>

                    {/* Upload */}
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                        Upload Documents
                      </h3>
                      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                        Add PDFs to the knowledge base — FAQ, pricing, policies, manuals
                      </p>
                      <UploadZone onSuccess={loadAll} />
                    </div>
                  </div>
                )}

                {/* ── Documents ── */}
                {activeTab === 'documents' && (
                  <div className="space-y-4">
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                        Upload new document
                      </h3>
                      <UploadZone onSuccess={loadAll} />
                    </div>

                    <div className="card overflow-hidden">
                      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Knowledge base · {docs.length} files
                        </h3>
                      </div>
                      {docs.length === 0 ? (
                        <div className="py-16 text-center">
                          <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} />
                          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No documents yet</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
                            Upload PDFs to enable knowledge retrieval
                          </p>
                        </div>
                      ) : (
                        <div>
                          {docs.map((doc, i) => (
                            <div key={doc.id}
                              className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                              style={{
                                borderBottom: i < docs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                              }}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'var(--accent-600)15' }}>
                                <FileText className="w-4 h-4" style={{ color: 'var(--accent-600)' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                  {doc.filename}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                  {doc.chunk_count} chunks · {(doc.file_size / 1024).toFixed(0)} KB · {new Date(doc.upload_date).toLocaleDateString()}
                                </p>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: '#10B98115', color: '#10B981' }}>
                                {doc.status}
                              </span>
                              <button
                                onClick={() => handleDeleteDoc(doc.id, doc.filename)}
                                className="btn btn-ghost p-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-disabled)' }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Users ── */}
                {activeTab === 'users' && (
                  <div className="card overflow-hidden">
                    <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Users · {users.length}
                      </h3>
                    </div>
                    {users.length === 0 ? (
                      <div className="py-16 text-center">
                        <Users className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No users found</p>
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
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{u.email}</p>
                          </div>
                          <p className="text-xs hidden sm:block" style={{ color: 'var(--text-disabled)' }}>
                            {new Date(u.created_at).toLocaleDateString()}
                          </p>
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="text-xs rounded-lg px-2.5 py-1.5 font-medium transition-colors focus:outline-none"
                            style={{
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── Conversations ── */}
                {activeTab === 'conversations' && (
                  <div className="card overflow-hidden">
                    <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Recent conversations · {convs.length}
                      </h3>
                    </div>
                    {convs.length === 0 ? (
                      <div className="py-16 text-center">
                        <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No conversations yet</p>
                      </div>
                    ) : (
                      convs.map((c, i) => (
                        <div key={c.id}
                          className="flex items-center gap-4 px-5 py-3.5"
                          style={{ borderBottom: i < convs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--bg-subtle)' }}>
                            <MessageSquare className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>
                              {c.session_id}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {c.message_count} messages · User: {c.user_id?.slice(0, 8)}...
                            </p>
                          </div>
                          <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-disabled)' }}>
                            {new Date(c.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
