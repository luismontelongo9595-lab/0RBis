import React, { useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  ShoppingBag,
  Flag,
  UserPlus,
  Plus,
  Lock,
  Globe,
  MapPin,
  Shield,
  MessageSquare,
  Check,
  X,
  Upload,
} from 'lucide-react';
import { apiFetch, uploadMedia } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { Post } from '../types';
import { Avatar, SafeImage, VerifiedBadge } from './OrbisUI';
import { CreatePostCard } from './CreatePostCard';
import { PostCard } from './PostCard';

type SubTab = 'groups' | 'pages' | 'events' | 'friends' | 'marketplace';

export function CommunitiesView() {
  const { currentUser, setAuthModalOpen, openProfile, startDmWithUser } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('groups');

  // Groups
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroupDetail, setActiveGroupDetail] = useState<{ group: any; members: any[] } | null>(null);
  const [groupPosts, setGroupPosts] = useState<Post[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);

  // Pages
  const [pages, setPages] = useState<any[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [pagePosts, setPagePosts] = useState<Post[]>([]);
  const [showNewPage, setShowNewPage] = useState(false);
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('Creator & Studio');
  const [pageDesc, setPageDesc] = useState('');

  // Events
  const [events, setEvents] = useState<any[]>([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [evTitle, setEvTitle] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evStartsAt, setEvStartsAt] = useState('');
  const [evDesc, setEvDesc] = useState('');

  // Friends
  const [friendsData, setFriendsData] = useState<{ incoming: any[]; friends: any[]; people: any[] }>({
    incoming: [],
    friends: [],
    people: [],
  });

  // Marketplace
  const [listings, setListings] = useState<any[]>([]);
  const [marketQuery, setMarketQuery] = useState('');
  const [marketCat, setMarketCat] = useState('All');
  const [showNewListing, setShowNewListing] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCat, setItemCat] = useState('Cameras & Gear');
  const [itemLoc, setItemLoc] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemImg, setItemImg] = useState<string | null>(null);

  const loadGroups = async () => {
    const res = await apiFetch<{ groups: any[] }>('/api/groups');
    setGroups(res.groups || []);
  };

  const openGroup = async (groupId: string) => {
    setActiveGroupId(groupId);
    const [detail, pRes] = await Promise.all([
      apiFetch<{ group: any; members: any[] }>(`/api/groups/${groupId}`),
      apiFetch<{ posts: Post[] }>(`/api/posts?groupId=${groupId}`),
    ]);
    setActiveGroupDetail(detail);
    setGroupPosts(pRes.posts || []);
  };

  const loadPages = async () => {
    const res = await apiFetch<{ pages: any[] }>('/api/pages');
    setPages(res.pages || []);
  };

  const openPage = async (pageId: string) => {
    setActivePageId(pageId);
    const pRes = await apiFetch<{ posts: Post[] }>(`/api/posts?pageId=${pageId}`);
    setPagePosts(pRes.posts || []);
  };

  const loadEvents = async () => {
    const res = await apiFetch<{ events: any[] }>('/api/events');
    setEvents(res.events || []);
  };

  const loadFriends = async () => {
    if (!currentUser) return;
    const res = await apiFetch<{ incoming: any[]; friends: any[]; people: any[] }>('/api/friends');
    setFriendsData(res);
  };

  const loadMarketplace = async () => {
    const res = await apiFetch<{ listings: any[] }>(
      `/api/marketplace?q=${encodeURIComponent(marketQuery)}&category=${encodeURIComponent(marketCat)}`
    );
    setListings(res.listings || []);
  };

  useEffect(() => {
    if (subTab === 'groups') loadGroups();
    else if (subTab === 'pages') loadPages();
    else if (subTab === 'events') loadEvents();
    else if (subTab === 'friends') loadFriends();
    else if (subTab === 'marketplace') loadMarketplace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, currentUser?.id]);

  useEffect(() => {
    if (subTab === 'marketplace') {
      const t = setTimeout(loadMarketplace, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketQuery, marketCat]);

  const requireLogin = () => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold">Communities &amp; Marketplace</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Groups, Creator Pages, Events, Friends &amp; Local Marketplace
        </p>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
        {(
          [
            { id: 'groups', label: 'Groups', icon: Users },
            { id: 'pages', label: 'Pages', icon: Flag },
            { id: 'events', label: 'Events', icon: Calendar },
            { id: 'friends', label: 'Friends', icon: UserPlus },
            { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSubTab(t.id);
                setActiveGroupId(null);
                setActivePageId(null);
              }}
              className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                subTab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== GROUPS ==================== */}
      {subTab === 'groups' && !activeGroupId && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => requireLogin() && setShowNewGroup((v) => !v)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Create Group
            </button>
          </div>

          {showNewGroup && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/groups', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: newGroupName,
                    description: newGroupDesc,
                    isPrivate: newGroupPrivate,
                  }),
                });
                setNewGroupName('');
                setNewGroupDesc('');
                setShowNewGroup(false);
                loadGroups();
              }}
              className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <input
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                rows={2}
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="What is this community about?"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={newGroupPrivate}
                  onChange={(e) => setNewGroupPrivate(e.target.checked)}
                  className="accent-indigo-600"
                />
                Private Group
              </label>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Create Group
              </button>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div>
                  <div className="h-28 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <SafeImage src={g.coverUrl} alt={g.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 text-sm font-bold">
                      <span className="truncate">{g.name}</span>
                      {g.isPrivate ? (
                        <Lock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {g.description}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 tabular-nums">
                      {g.membersCount} members · {g.postsCount} posts
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => openGroup(g.id)}
                    className="flex-1 min-h-[38px] rounded-xl border border-zinc-200 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Open Discussion
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!requireLogin()) return;
                      await apiFetch(`/api/groups/${g.id}/join`, { method: 'POST' });
                      loadGroups();
                    }}
                    className={`min-h-[38px] rounded-xl px-4 text-xs font-semibold ${
                      g.myRole
                        ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {g.myRole ? 'Joined' : 'Join'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'groups' && activeGroupId && activeGroupDetail && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setActiveGroupId(null)}
            className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← Back to all groups
          </button>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">{activeGroupDetail.group.name}</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {activeGroupDetail.group.description}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!requireLogin()) return;
                  await apiFetch(`/api/groups/${activeGroupId}/join`, { method: 'POST' });
                  openGroup(activeGroupId);
                }}
                className="min-h-[38px] rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white"
              >
                {activeGroupDetail.group.myRole ? 'Leave Group' : 'Join Group'}
              </button>
            </div>

            {/* Members & Admin/Moderator Role Controls */}
            <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-xs font-semibold text-zinc-500 mb-2">
                Members ({activeGroupDetail.members.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {activeGroupDetail.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800"
                  >
                    <Avatar src={m.avatar_url} name={m.display_name} size="xs" />
                    <button
                      type="button"
                      onClick={() => openProfile(m.username)}
                      className="font-semibold hover:underline"
                    >
                      {m.display_name}
                    </button>
                    <span className="text-zinc-400">· {m.role}</span>
                    {activeGroupDetail.group.myRole === 'ADMIN' && m.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          const nextRole = m.role === 'MODERATOR' ? 'MEMBER' : 'MODERATOR';
                          await apiFetch(`/api/groups/${activeGroupId}/members/${m.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ role: nextRole }),
                          });
                          openGroup(activeGroupId);
                        }}
                        title="Toggle Moderator"
                        className="ml-1 text-indigo-500 hover:underline"
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {activeGroupDetail.group.myRole && (
            <CreatePostCard
              groupId={activeGroupId}
              placeholder="Start a discussion in this group..."
              onPostCreated={(np) => setGroupPosts((prev) => [np, ...prev])}
            />
          )}

          <div className="space-y-4">
            {groupPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onDelete={(id) => setGroupPosts((prev) => prev.filter((item) => item.id !== id))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ==================== PAGES ==================== */}
      {subTab === 'pages' && !activePageId && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => requireLogin() && setShowNewPage((v) => !v)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Create Business / Creator Page
            </button>
          </div>

          {showNewPage && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/pages', {
                  method: 'POST',
                  body: JSON.stringify({ name: pageName, category: pageCategory, description: pageDesc }),
                });
                setPageName('');
                setPageDesc('');
                setShowNewPage(false);
                loadPages();
              }}
              className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <input
                required
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder="Page or brand name"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                value={pageCategory}
                onChange={(e) => setPageCategory(e.target.value)}
                placeholder="Category (e.g. Architecture, Coffee Roaster)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <textarea
                rows={2}
                value={pageDesc}
                onChange={(e) => setPageDesc(e.target.value)}
                placeholder="Describe your page or studio..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Launch Page
              </button>
            </form>
          )}

          <div className="space-y-3">
            {pages.map((pg) => (
              <div
                key={pg.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={pg.avatarUrl} name={pg.name} size="lg" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-bold truncate">
                      <span>{pg.name}</span>
                      {pg.isVerified && <VerifiedBadge />}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      @{pg.handle} · {pg.category} · {pg.followersCount} followers
                    </p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300 line-clamp-1">
                      {pg.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openPage(pg.id)}
                    className="min-h-[38px] rounded-xl border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!requireLogin()) return;
                      await apiFetch(`/api/pages/${pg.id}/follow`, { method: 'POST' });
                      loadPages();
                    }}
                    className={`min-h-[38px] rounded-xl px-4 text-xs font-semibold ${
                      pg.followedByMe
                        ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {pg.followedByMe ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'pages' && activePageId && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setActivePageId(null)}
            className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            ← Back to all pages
          </button>
          {pages.find((p) => p.id === activePageId)?.ownerId === currentUser?.id && (
            <CreatePostCard
              pageId={activePageId}
              placeholder="Publish an update from your Page..."
              onPostCreated={(np) => setPagePosts((prev) => [np, ...prev])}
            />
          )}
          <div className="space-y-4">
            {pagePosts.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">No page posts published yet.</p>
            ) : (
              pagePosts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </div>
        </div>
      )}

      {/* ==================== EVENTS ==================== */}
      {subTab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => requireLogin() && setShowNewEvent((v) => !v)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Host Event
            </button>
          </div>

          {showNewEvent && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/events', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: evTitle,
                    location: evLocation,
                    startsAt: evStartsAt,
                    description: evDesc,
                  }),
                });
                setEvTitle('');
                setEvLocation('');
                setEvStartsAt('');
                setEvDesc('');
                setShowNewEvent(false);
                loadEvents();
              }}
              className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <input
                required
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Event title"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  value={evLocation}
                  onChange={(e) => setEvLocation(e.target.value)}
                  placeholder="Location or Livestream URL"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  required
                  type="datetime-local"
                  value={evStartsAt}
                  onChange={(e) => setEvStartsAt(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <textarea
                rows={2}
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                placeholder="Event details..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Publish Event
              </button>
            </form>
          )}

          <div className="space-y-4">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                {ev.coverUrl && (
                  <SafeImage src={ev.coverUrl} alt={ev.title} className="h-44 w-full object-cover" />
                )}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>{new Date(ev.startsAt).toLocaleString()}</span>
                    <span aria-hidden="true">·</span>
                    <span>Hosted by {ev.creatorName}</span>
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold">{ev.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <MapPin className="h-3.5 w-3.5" /> {ev.location}
                  </p>
                  {ev.description && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{ev.description}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {ev.goingCount} going · {ev.interestedCount} interested
                    </span>
                    <div className="flex gap-2">
                      {(['GOING', 'INTERESTED'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={async () => {
                            if (!requireLogin()) return;
                            const next = ev.myRsvp === status ? 'NONE' : status;
                            await apiFetch(`/api/events/${ev.id}/rsvp`, {
                              method: 'POST',
                              body: JSON.stringify({ status: next }),
                            });
                            loadEvents();
                          }}
                          className={`min-h-[38px] rounded-xl px-3.5 text-xs font-semibold ${
                            ev.myRsvp === status
                              ? 'bg-indigo-600 text-white'
                              : 'border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {status === 'GOING' ? 'Going' : 'Interested'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== FRIENDS ==================== */}
      {subTab === 'friends' && (
        <div className="space-y-6">
          {!currentUser ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 mb-3">Sign in to manage friend requests and connect.</p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="min-h-[40px] rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white"
              >
                Sign in
              </button>
            </div>
          ) : (
            <>
              {friendsData.incoming.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="font-display text-sm font-bold text-zinc-500">Friend Requests</h2>
                  <div className="space-y-2">
                    {friendsData.incoming.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
                      >
                        <button
                          type="button"
                          onClick={() => openProfile(req.username)}
                          className="flex items-center gap-3 text-left"
                        >
                          <Avatar src={req.avatar_url} name={req.display_name} />
                          <div>
                            <p className="text-sm font-semibold">{req.display_name}</p>
                            <p className="text-xs text-zinc-500">@{req.username}</p>
                          </div>
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch('/api/friends/respond', {
                                method: 'POST',
                                body: JSON.stringify({ senderId: req.user_id, accept: true }),
                              });
                              loadFriends();
                            }}
                            className="flex min-h-[38px] items-center gap-1 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white"
                          >
                            <Check className="h-3.5 w-3.5" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch('/api/friends/respond', {
                                method: 'POST',
                                body: JSON.stringify({ senderId: req.user_id, accept: false }),
                              });
                              loadFriends();
                            }}
                            className="flex min-h-[38px] items-center gap-1 rounded-xl border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
                          >
                            <X className="h-3.5 w-3.5" /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2.5">
                <h2 className="font-display text-sm font-bold text-zinc-500">
                  Your Friends ({friendsData.friends.length})
                </h2>
                {friendsData.friends.length === 0 ? (
                  <p className="text-xs text-zinc-500">No friends added yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {friendsData.friends.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
                      >
                        <button
                          type="button"
                          onClick={() => openProfile(f.username)}
                          className="flex items-center gap-3 text-left min-w-0"
                        >
                          <Avatar src={f.avatar_url} name={f.display_name} isOnline={Boolean(f.is_online)} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{f.display_name}</p>
                            <p className="text-xs text-zinc-500 truncate">@{f.username}</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => startDmWithUser(f.id)}
                          className="flex min-h-[38px] items-center gap-1 rounded-xl bg-zinc-100 px-3 text-xs font-semibold dark:bg-zinc-800"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Chat
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2.5">
                <h2 className="font-display text-sm font-bold text-zinc-500">People on Orbis</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {friendsData.people.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
                    >
                      <button
                        type="button"
                        onClick={() => openProfile(p.username)}
                        className="flex items-center gap-3 text-left min-w-0"
                      >
                        <Avatar src={p.avatar_url} name={p.display_name} isOnline={Boolean(p.is_online)} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{p.display_name}</p>
                          <p className="text-xs text-zinc-500 truncate">@{p.username}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch('/api/friends/request', {
                            method: 'POST',
                            body: JSON.stringify({ userId: p.id }),
                          });
                          loadFriends();
                        }}
                        className="min-h-[38px] rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white"
                      >
                        Add Friend
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ==================== MARKETPLACE ==================== */}
      {subTab === 'marketplace' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={marketQuery}
              onChange={(e) => setMarketQuery(e.target.value)}
              placeholder="Search items, locations..."
              className="flex-1 min-w-[200px] rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900"
            />
            <select
              value={marketCat}
              onChange={(e) => setMarketCat(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="All">All Categories</option>
              <option value="Cameras & Gear">Cameras &amp; Gear</option>
              <option value="Home & Craft">Home &amp; Craft</option>
              <option value="Electronics">Electronics</option>
              <option value="General">General</option>
            </select>
            <button
              type="button"
              onClick={() => requireLogin() && setShowNewListing((v) => !v)}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Sell Item
            </button>
          </div>

          {showNewListing && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/marketplace', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: itemTitle,
                    priceDollars: Number(itemPrice),
                    category: itemCat,
                    location: itemLoc,
                    description: itemDesc,
                    imageUrl: itemImg,
                  }),
                });
                setItemTitle('');
                setItemPrice('');
                setItemLoc('');
                setItemDesc('');
                setItemImg(null);
                setShowNewListing(false);
                loadMarketplace();
              }}
              className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  required
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="Item title"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="Price (USD)"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={itemCat}
                  onChange={(e) => setItemCat(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="Cameras & Gear">Cameras &amp; Gear</option>
                  <option value="Home & Craft">Home &amp; Craft</option>
                  <option value="Electronics">Electronics</option>
                  <option value="General">General</option>
                </select>
                <input
                  required
                  value={itemLoc}
                  onChange={(e) => setItemLoc(e.target.value)}
                  placeholder="City / Neighborhood"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <textarea
                rows={2}
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder="Condition and details..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Upload className="h-4 w-4" />
                  {itemImg ? 'Photo Uploaded' : 'Upload Item Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const res = await uploadMedia(f);
                        setItemImg(res.url);
                      }
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className="min-h-[40px] rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white"
                >
                  List Item
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {listings.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div>
                  <div className="h-44 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <SafeImage src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        ${(item.price_cents / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {item.status === 'SOLD' ? 'Sold' : item.location}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold">{item.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-zinc-100 p-3 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => openProfile(item.seller_username)}
                    className="flex items-center gap-2 text-xs font-medium hover:underline"
                  >
                    <Avatar src={item.seller_avatar} name={item.seller_name} size="xs" />
                    <span>{item.seller_name}</span>
                  </button>
                  {currentUser?.id === item.seller_id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/marketplace/${item.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: item.status === 'SOLD' ? 'AVAILABLE' : 'SOLD' }),
                        });
                        loadMarketplace();
                      }}
                      className="min-h-[36px] rounded-xl border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
                    >
                      {item.status === 'SOLD' ? 'Relist' : 'Mark Sold'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startDmWithUser(item.seller_id)}
                      className="min-h-[36px] rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white"
                    >
                      Message Seller
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
