import React, { useEffect, useState } from 'react';
import {
  Home,
  Film,
  Compass,
  Users,
  MessageSquare,
  Bell,
  Sparkles,
  Shield,
  Settings,
  Sun,
  Moon,
  LogIn,
  LogOut,
  Search,
  Hash,
  User as UserIcon,
} from 'lucide-react';
import { AppProvider, useApp, type NavTab } from './context/AppContext';
import { apiFetch } from './lib/api';
import type { User } from './types';
import { AuthModal, Avatar, OrbisLogo, VerifiedBadge } from './components/OrbisUI';
import { FeedView } from './components/FeedView';
import { ReelsView } from './components/ReelsView';
import { ExploreView } from './components/ExploreView';
import { CommunitiesView } from './components/CommunitiesView';
import { MessagesView } from './components/MessagesView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { CreatorStudioView } from './components/CreatorStudioView';
import { AdminView } from './components/AdminView';

function OrbisShell() {
  const {
    currentUser,
    theme,
    toggleTheme,
    activeTab,
    setActiveTab,
    setAuthModalOpen,
    logout,
    openProfile,
    openExplore,
    unreadMessages,
    unreadNotifications,
    onlineUserIds,
  } = useApp();

  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ id: string; tag: string; posts_count: number }[]>([]);
  const [quickSearch, setQuickSearch] = useState('');

  useEffect(() => {
    apiFetch<{ users: User[]; hashtags: any[] }>('/api/explore')
      .then((d) => {
        setSuggestedUsers((d.users || []).slice(0, 5));
        setTrendingTags((d.hashtags || []).slice(0, 6));
      })
      .catch(() => {});
  }, [currentUser?.id]);

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotifications },
    { id: 'creator', label: 'Creator Studio', icon: Sparkles },
    ...(currentUser
      ? [
          { id: 'profile' as NavTab, label: 'Profile', icon: UserIcon },
          { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
        ]
      : []),
    { id: 'admin', label: 'Admin', icon: Shield },
  ];

  const mobileTabs: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'feed', label: 'Feed', icon: Home },
    { id: 'reels', label: 'Reels', icon: Film },
    { id: 'communities', label: 'Groups', icon: Users },
    { id: 'messages', label: 'Chat', icon: MessageSquare, badge: unreadMessages },
    { id: 'explore', label: 'Explore', icon: Compass },
  ];

  const handleNavClick = (id: NavTab) => {
    if (id === 'profile' && currentUser) {
      openProfile(currentUser.username);
    } else {
      setActiveTab(id);
    }
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Compact Mobile Top Header (52px) */}
      <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-zinc-200/80 bg-white/90 px-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90 md:hidden">
        <button type="button" onClick={() => setActiveTab('feed')} className="shrink-0">
          <OrbisLogo size={26} />
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('creator')}
            aria-label="Creator Studio"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300"
          >
            <Sparkles className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={() => openProfile(currentUser.username)}
              aria-label="Open profile"
              className="flex h-11 w-11 items-center justify-center"
            >
              <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="xs" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="ml-1 min-h-[38px] rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white whitespace-nowrap"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Desktop 3-Column Container */}
      <div className="mx-auto flex max-w-7xl justify-center gap-6 px-3 sm:px-6">
        {/* Left Navigation Rail */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-zinc-200/70 py-5 pr-4 dark:border-zinc-800/70 md:flex">
          <div className="space-y-5 overflow-y-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className="px-2 text-left"
            >
              <OrbisLogo size={32} />
            </button>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`flex min-h-[42px] w-full items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium transition whitespace-nowrap ${
                      active
                        ? 'bg-indigo-600/10 text-indigo-600 font-semibold dark:text-indigo-400'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-[40px] w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {currentUser ? (
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => openProfile(currentUser.username)}
                  className="flex items-center gap-2.5 min-w-0 text-left"
                >
                  <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size="sm" isOnline />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-xs font-semibold truncate">
                      <span className="truncate">{currentUser.displayName}</span>
                      {currentUser.isVerified && <VerifiedBadge />}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">@{currentUser.username}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-800 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign in / Join Orbis</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main Active View */}
        <main className="w-full max-w-2xl py-4 md:py-6 min-w-0">
          {activeTab === 'feed' && <FeedView />}
          {activeTab === 'reels' && <ReelsView />}
          {activeTab === 'explore' && <ExploreView />}
          {activeTab === 'communities' && <CommunitiesView />}
          {activeTab === 'messages' && <MessagesView />}
          {activeTab === 'notifications' && <NotificationsView />}
          {activeTab === 'creator' && <CreatorStudioView />}
          {activeTab === 'admin' && <AdminView />}
          {activeTab === 'profile' && <ProfileView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Right Discovery Rail (Desktop) */}
        <aside className="sticky top-0 hidden h-screen w-76 shrink-0 space-y-5 py-6 pl-2 lg:block overflow-y-auto no-scrollbar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openExplore(quickSearch);
            }}
            className="relative"
          >
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search Orbis..."
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900/70"
            />
          </form>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <h3 className="font-display text-xs font-bold text-zinc-500 mb-3">
              Suggested Creators
            </h3>
            <div className="space-y-3">
              {suggestedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => openProfile(u.username)}
                  className="flex w-full items-center justify-between gap-2 text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={u.avatarUrl}
                      name={u.displayName}
                      size="sm"
                      isOnline={onlineUserIds.has(u.id) || u.isOnline}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-xs font-semibold group-hover:text-indigo-500 truncate">
                        <span className="truncate">{u.displayName}</span>
                        {u.isVerified && <VerifiedBadge />}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">@{u.username}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                    View
                  </span>
                </button>
              ))}
            </div>
          </div>

          {trendingTags.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
              <h3 className="font-display text-xs font-bold text-zinc-500 mb-3">
                Trending Hashtags
              </h3>
              <div className="space-y-2">
                {trendingTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openExplore(`#${t.tag}`)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Hash className="h-3.5 w-3.5 text-indigo-500" />
                      {t.tag}
                    </span>
                    <span className="text-zinc-400 tabular-nums">{t.posts_count} posts</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links Footer */}
          <div className="px-2 text-[11px] text-zinc-400 flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveTab('communities')} className="hover:underline">
              Marketplace
            </button>
            <span>·</span>
            <button type="button" onClick={() => setActiveTab('creator')} className="hover:underline">
              Monetization
            </button>
            <span>·</span>
            <button type="button" onClick={() => setActiveTab('admin')} className="hover:underline">
              Admin
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile Bottom Navigation Bar (56px, >= 44px touch targets) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-5 items-center border-t border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`relative flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 ${
                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute right-4 top-2 h-2 w-2 rounded-full bg-rose-600" />
              )}
            </button>
          );
        })}
      </nav>

      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <OrbisShell />
    </AppProvider>
  );
}
