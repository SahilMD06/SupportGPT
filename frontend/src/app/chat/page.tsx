'use client';
import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Copy, Check, ArrowUp, Sparkles, Languages } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import AppLayout from '@/components/layout/AppLayout';
import { useChatStore, useAuthStore, usePreferencesStore } from '@/lib/store';
import { chatAPI, historyAPI } from '@/lib/api';
import Cookies from 'js-cookie';

const AGENT_LABELS: Record<string, { label: string; className: string }> = {
  billing:   { label: 'Billing',   className: 'badge badge-billing' },
  technical: { label: 'Technical', className: 'badge badge-technical' },
  product:   { label: 'Product',   className: 'badge badge-product' },
  complaint: { label: 'Complaint', className: 'badge badge-complaint' },
  privacy:   { label: 'Privacy',   className: 'badge badge-privacy' },
  faq:       { label: 'FAQ',       className: 'badge badge-faq' },
};

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--accent-600)' }}>
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex gap-1.5 items-center h-4">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({ message }: { message: any }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const showLanguageBadge = !isUser && message.language_name && message.language_name !== 'English';

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? '' : ''}`}
        style={isUser
          ? { background: 'var(--bg-muted)', border: '1px solid var(--border-default)' }
          : { background: 'var(--accent-600)' }
        }>
        {isUser
          ? <User className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          : <Bot className="w-3.5 h-3.5 text-white" />
        }
      </div>

      {/* Bubble */}
      <div className={`group max-w-[72%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className="relative px-4 py-3 rounded-2xl"
          style={isUser ? {
            background: 'var(--accent-600)',
            color: 'white',
            borderRadius: '16px 4px 16px 16px',
          } : {
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px 16px 16px 16px',
          }}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="chat-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}

          {!isUser && (
            <button
              onClick={copy}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}
            >
              {copied
                ? <Check className="w-3 h-3" style={{ color: 'var(--success)' }} />
                : <Copy className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
              }
            </button>
          )}
        </div>

        {/* Agent badges + source + language + meta */}
        <div className={`flex flex-wrap items-center gap-1.5 px-1 ${isUser ? 'justify-end' : ''}`}>
          {!isUser && message.agents_used?.map((a: string) => {
            const cfg = AGENT_LABELS[a];
            return cfg ? <span key={a} className={cfg.className}>{cfg.label}</span> : null;
          })}
          {showLanguageBadge && (
            <span className="badge" style={{
              background: 'var(--bg-subtle)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-subtle)'
            }}>
              <Languages className="w-2.5 h-2.5" /> {message.language_name}
            </span>
          )}
          {!isUser && message.sources?.map((s: string) => (
            <span key={s} className="badge" style={{
              background: 'var(--bg-subtle)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-subtle)'
            }}>📎 {s}</span>
          ))}
          <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

const SUGGESTIONS = [
  'My Sentry Cam won\'t connect to Wi-Fi',
  'I want to return my LockGuard smart lock',
  '¿Qué incluye el paquete inicial para casa inteligente?',
  'My order hasn\'t shipped in over a week',
];

function EmptyState({ onSuggest }: { onSuggest: (t: string) => void }) {
  const { preferences } = usePreferencesStore();
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'var(--accent-600)', boxShadow: '0 0 0 8px var(--accent-50)' }}>
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          How can I help you today?
        </h2>
        <p className="text-sm max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
          Ask about your NovaTech devices, orders, or account — in any language.
        </p>
      </motion.div>

      {preferences.show_suggestions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
          {SUGGESTIONS.map((s, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.2 }}
              onClick={() => onSuggest(s)}
              className="text-left p-3.5 rounded-xl text-sm transition-all card card-hover"
              style={{ color: 'var(--text-secondary)' }}
            >
              {s}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatInner() {
  const searchParams = useSearchParams();
  const { messages, isTyping, addMessage, setTyping, setCurrentSession, currentSessionId, clearMessages } = useChatStore();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionParam = searchParams.get('session');

  useEffect(() => {
    // Reload whenever the URL's session param points somewhere new, OR
    // when it matches the store's "current" session but there are no
    // messages to show — the latter guards against stale currentSessionId
    // state (e.g. surviving a client-side logout/login round trip) that
    // would otherwise silently skip the fetch and leave the pane empty.
    if (sessionParam && (sessionParam !== currentSessionId || messages.length === 0)) {
      loadSession(sessionParam);
    }
  }, [sessionParam]);

  const loadSession = async (sid: string) => {
    try {
      const res = await historyAPI.getConversation(sid);
      console.log('[loadSession] Raw /history/{id} response:', res.data);

      // Handle a couple of plausible shapes defensively: messages could be
      // at res.data.messages, or the whole response could BE the messages
      // array directly, depending on how the actual endpoint serializes it.
      const msgs = Array.isArray(res.data) ? res.data : (res.data?.messages ?? []);
      const session_id = res.data?.session_id ?? sid;

      if (!Array.isArray(msgs) || msgs.length === 0) {
        console.warn('[loadSession] No messages array found in response, or it was empty. Raw response was:', res.data);
      }

      setCurrentSession(session_id);
      useChatStore.getState().setMessages(msgs.map((m: any, i: number) => ({
        id: `${i}-${Date.now()}`,
        role: m.role ?? m.sender ?? m.type ?? 'assistant',
        content: m.content ?? m.text ?? m.message ?? '',
        timestamp: m.timestamp ?? m.created_at ?? new Date().toISOString(),
        agents_used: m.agent_used ?? m.agents_used,
        intents: m.intents,
        language_name: m.language_name,
      })));
    } catch (err) {
      console.error('[loadSession] Failed to load conversation:', err);
      toast.error('Failed to load conversation');
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }

    addMessage({ id: `u-${Date.now()}`, role: 'user', content: msg, timestamp: new Date().toISOString() });
    setTyping(true);

    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, session_id: currentSessionId }),
      });

      if (!res.ok) throw new Error('Stream failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let fullText = '';
      let intents: string[] = [];
      let agents: string[] = [];
      let sources: string[] = [];
      let languageName: string | undefined;
      let msgAdded = false;
      let streamErrored = false;

      setTyping(false);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'session') { setCurrentSession(data.session_id); }
            else if (data.type === 'intents') { intents = data.intents; }
            else if (data.type === 'language') { languageName = data.language_name; }
            else if (data.type === 'token') {
              if (!msgAdded) {
                addMessage({ id: `a-${Date.now()}`, role: 'assistant', content: data.content, timestamp: new Date().toISOString(), isStreaming: true });
                msgAdded = true;
              } else {
                useChatStore.getState().updateLastMessage(data.content);
              }
              fullText += data.content;
            } else if (data.type === 'done') {
              agents = data.agents_used || intents;
              sources = data.sources || [];
              const msgs = useChatStore.getState().messages;
              const updated = [...msgs];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last, agents_used: agents, intents, sources,
                  language_name: languageName, isStreaming: false,
                };
                useChatStore.getState().setMessages(updated);
              }
            } else if (data.type === 'error') {
              streamErrored = true;
              console.error('Backend stream error:', data.message);
              if (msgAdded) {
                // Stop the spinner on whatever partial content came through
                useChatStore.getState().updateLastMessage('', true);
              }
              toast.error(
                msgAdded
                  ? 'Response was cut off due to an error. Please try again.'
                  : 'Something went wrong generating a response. Please try again.'
              );
            }
          } catch {}
        }
        if (streamErrored) break;
      }

      if (streamErrored) {
        setSending(false);
        setTyping(false);
        textareaRef.current?.focus();
        return; // don't fall through to the non-streaming fallback — it would likely hit the same backend error
      }

      const sessRes = await historyAPI.getSessions();
      useChatStore.getState().setSessions(sessRes.data);

    } catch {
      setTyping(false);
      try {
        const res = await chatAPI.send({ message: msg, session_id: currentSessionId || undefined });
        const { response, session_id, intents, agents_used, sources, language_name } = res.data;
        setCurrentSession(session_id);
        addMessage({ id: `a-${Date.now()}`, role: 'assistant', content: response, timestamp: new Date().toISOString(), agents_used, intents, sources, language_name });
      } catch { toast.error('Failed to send. Please try again.'); }
    } finally {
      setSending(false);
      setTyping(false);
      textareaRef.current?.focus();
    }
  }, [input, sending, currentSessionId]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const onTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onSuggest={(t) => handleSend(t)} />
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
              {isTyping && <TypingIndicator />}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-end gap-3 p-3 rounded-2xl transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={onTextareaChange}
                onKeyDown={onKeyDown}
                placeholder="Ask about your order, device setup, or NovaTech products — in any language..."
                rows={1}
                className="flex-1 bg-transparent resize-none focus:outline-none text-sm leading-relaxed"
                style={{ color: 'var(--text-primary)', minHeight: '40px', maxHeight: '160px' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || sending}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-30"
                style={{ background: input.trim() ? 'var(--accent-600)' : 'var(--bg-muted)' }}
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-disabled)' }}>
              Enter to send · Shift+Enter for new line · Powered by Gemini 2.5 Flash
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ background: 'var(--bg-base)' }} className="min-h-screen" />}>
      <ChatInner />
    </Suspense>
  );
}
