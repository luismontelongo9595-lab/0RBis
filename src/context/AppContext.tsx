import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { User } from '../types';
import { apiFetch, getAuthToken, setAuthToken } from '../lib/api';

export type NavTab =
  | 'feed'
  | 'reels'
  | 'explore'
  | 'communities'
  | 'messages'
  | 'notifications'
  | 'creator'
  | 'admin'
  | 'profile'
  | 'settings';

interface WsListener {
  (event: string, payload: any): void;
}

interface AppContextValue {
  currentUser: User | null;
  authLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  profileUsername: string | null;
  openProfile: (username: string) => void;
  exploreQuery: string;
  openExplore: (query?: string) => void;
  activeConversationId: string | null;
  openConversation: (convId: string | null) => void;
  startDmWithUser: (userId: string) => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  unreadNotifications: number;
  setUnreadNotifications: React.Dispatch<React.SetStateAction<number>>;
  unreadMessages: number;
  refreshUnreadCounts: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginSuccess: (user: User, token: string) => void;
  logout: () => Promise<void>;
  subscribeWs: (fn: WsListener) => () => void;
  sendWs: (event: string, payload: any) => void;
  onlineUserIds: Set<string>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [exploreQuery, setExploreQuery] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<WsListener>>(new Set());

  const syncThemeMeta = (mode: 'light' | 'dark') => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', mode === 'dark' ? '#09090b' : '#fafafa');
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('orbis-theme') as 'light' | 'dark' | null;
    const initial = saved === 'light' ? 'light' : 'dark';
    setTheme(initial);
    syncThemeMeta(initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('orbis-theme', next);
    syncThemeMeta(next);
  };

  const refreshUnreadCounts = useCallback(async () => {
    if (!getAuthToken() && !currentUser) return;
    try {
      const [nRes, cRes] = await Promise.all([
        apiFetch<{ unreadCount: number }>('/api/notifications'),
        apiFetch<{ conversations: { unreadCount: number }[] }>('/api/conversations'),
      ]);
      setUnreadNotifications(nRes.unreadCount || 0);
      setUnreadMessages(
        (cRes.conversations || []).reduce((acc, c) => acc + (c.unreadCount || 0), 0)
      );
    } catch {
      // ignore if unauthenticated
    }
  }, [currentUser]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User | null; token: string | null }>('/api/auth/me');
      if (data.token) setAuthToken(data.token);
      setCurrentUser(data.user);
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!currentUser) {
      setUnreadNotifications(0);
      setUnreadMessages(0);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    refreshUnreadCounts();

    const token = getAuthToken();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByEffect = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          const { event, payload } = parsed;

          if (event === 'presence:update') {
            setOnlineUserIds((prev) => {
              const next = new Set(prev);
              if (payload.isOnline) next.add(payload.userId);
              else next.delete(payload.userId);
              return next;
            });
          } else if (event === 'notification:new') {
            setUnreadNotifications((c) => c + 1);
          } else if (event === 'message:new') {
            if (payload.senderId !== currentUser.id) {
              setUnreadMessages((c) => c + 1);
            }
          }

          for (const fn of listenersRef.current) {
            fn(event, payload);
          }
        } catch {
          // ignore invalid frame
        }
      };

      ws.onclose = () => {
        if (!closedByEffect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentUser, refreshUnreadCounts]);

  const subscribeWs = useCallback((fn: WsListener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const sendWs = useCallback((event: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    }
  }, []);

  const loginSuccess = (user: User, token: string) => {
    setAuthToken(token);
    setCurrentUser(user);
    setAuthModalOpen(false);
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthToken(null);
    setCurrentUser(null);
    setActiveTab('feed');
  };

  const openProfile = (username: string) => {
    setProfileUsername(username);
    setActiveTab('profile');
  };

  const openExplore = (query = '') => {
    setExploreQuery(query);
    setActiveTab('explore');
  };

  const openConversation = (convId: string | null) => {
    setActiveConversationId(convId);
    setActiveTab('messages');
  };

  const startDmWithUser = async (userId: string) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const res = await apiFetch<{ conversationId: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantIds: [userId] }),
    });
    setActiveConversationId(res.conversationId);
    setActiveTab('messages');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        authLoading,
        theme,
        toggleTheme,
        activeTab,
        setActiveTab,
        profileUsername,
        openProfile,
        exploreQuery,
        openExplore,
        activeConversationId,
        openConversation,
        startDmWithUser,
        authModalOpen,
        setAuthModalOpen,
        unreadNotifications,
        setUnreadNotifications,
        unreadMessages,
        refreshUnreadCounts,
        refreshUser,
        loginSuccess,
        logout,
        subscribeWs,
        sendWs,
        onlineUserIds,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
