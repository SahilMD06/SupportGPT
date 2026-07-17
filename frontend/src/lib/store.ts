import { create } from "zustand";
import { persist } from "zustand/middleware";
import Cookies from "js-cookie";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  full_name?: string;
  profile_picture?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (fields: Partial<User>) => void;
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
      updateUser: (fields) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...fields } : state.user,
        })),
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
  // ISO string (e.g. new Date().toISOString()) — NOT a Date object.
  timestamp: string;
  agents_used?: string[];
  intents?: string[];
  sources?: string[];
  isStreaming?: boolean;
  language_code?: string;
  language_name?: string;
  frustration_level?: number;
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
  resetChatStore: () => void;
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
  // Full reset — called on logout so no state from the previous account
  // (messages, session list, "current" session pointer) survives into the
  // next login within the same browser tab.
  resetChatStore: () => set({ messages: [], sessions: [], currentSessionId: null, isTyping: false }),
}));

// ─── Preferences Store ─────────────────────────────────────────────────────────

export interface Preferences {
  theme_preference: string;
  font_size: string;
  notification_enabled: boolean;
  privacy_preferences: Record<string, boolean>;
  ai_model: string;
  response_length: string;
  show_citations: boolean;
  show_suggestions: boolean;
  response_language: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme_preference: "system",
  font_size: "medium",
  notification_enabled: true,
  privacy_preferences: {},
  ai_model: "gemini-2.5-flash",
  response_length: "balanced",
  show_citations: true,
  show_suggestions: true,
  response_language: "auto",
};

// Curated language list — shared between Settings and any display badges
export const LANGUAGE_OPTIONS = [
  { code: "auto", label: "Auto-detect (match customer)" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "hi", label: "Hindi" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ar", label: "Arabic" },
];

interface PreferencesState {
  preferences: Preferences;
  loaded: boolean;
  setPreferences: (p: Partial<Preferences>) => void;
  setLoaded: (loaded: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  preferences: DEFAULT_PREFERENCES,
  loaded: false,
  setPreferences: (p) =>
    set((state) => ({ preferences: { ...state.preferences, ...p } })),
  setLoaded: (loaded) => set({ loaded }),
}));
