import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      setAuth: (user, token) => {
        Cookies.set("auth_token", token, { expires: 1, secure: true });
        set({ user, token, isLoading: false });
      },
      clearAuth: () => {
        Cookies.remove("auth_token");
        set({ user: null, token: null });
      },
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: "supportgpt-auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

// ─── Chat Store ───────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  agents_used?: string[];
  intents?: string[];
  sources?: string[];
  isStreaming?: boolean;
}

interface Session {
  id: string;
  session_id: string;
  preview: string;
  created_at: string;
  updated_at: string;
}

interface ChatState {
  messages: Message[];
  sessions: Session[];
  currentSessionId: string | null;
  isTyping: boolean;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string, done?: boolean) => void;
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setTyping: (typing: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessions: [],
  currentSessionId: null,
  isTyping: false,
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessage: (content, done = false) =>
    set((state) => {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = {
          ...last,
          content: last.content + content,
          isStreaming: !done,
        };
      }
      return { messages: msgs };
    }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
  setTyping: (typing) => set({ isTyping: typing }),
  clearMessages: () => set({ messages: [], currentSessionId: null }),
}));
