import React, { useEffect, useState } from 'react';
import { Search, Hash, Film } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { Post, User } from '../types';
import { Avatar, VerifiedBadge } from './OrbisUI';
import { PostCard } from './PostCard';

export function ExploreView() {
  const { exploreQuery, openProfile, setActiveTab } = useApp();
  const [query, setQuery] = useState(exploreQuery);
  const [users, setUsers] = useState<User[]>([]);
  const [hashtags, setHashtags] = useState<{ id: string; tag: string; posts_count: number }[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    setQuery(exploreQuery);
  }, [exploreQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      apiFetch<{ users: User[]; hashtags: any[]; posts: Post[] }>(
        `/api/explore?q=${encodeURIComponent(query)}`
      )
        .then((d) => {
          setUsers(d.users || []);
          setHashtags(d.hashtags || []);
          setPosts(d.posts || []);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people, #hashtags, or posts..."
          className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-12 pr-4 text-sm outline-none focus:border-indigo-600 dark:border-zinc-800 dark:bg-zinc-900/70"
        />
      </div>

      {/* Trending Hashtags (interactive filter buttons) */}
      {hashtags.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-display text-sm font-bold text-zinc-500 dark:text-zinc-400">
            Trending Topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setQuery(`#${h.tag}`)}
                className="flex min-h-[38px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold hover:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Hash className="h-3.5 w-3.5 text-indigo-500" />
                <span>{h.tag}</span>
                <span className="text-zinc-400 tabular-nums">({h.posts_count})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Matching / Suggested Creators */}
      {users.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-display text-sm font-bold text-zinc-500 dark:text-zinc-400">
            {query ? 'Matching Accounts' : 'Trending & Suggested Creators'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => openProfile(u.username)}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left transition hover:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <Avatar src={u.avatarUrl} name={u.displayName} isOnline={u.isOnline} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-semibold truncate">
                    <span className="truncate">{u.displayName}</span>
                    {u.isVerified && <VerifiedBadge />}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
                  {u.bio && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 truncate">{u.bio}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Trending Reels Link Banner */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Discover Trending Reels</p>
            <p className="text-xs text-zinc-500">Full-screen vertical videos &amp; sounds</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className="min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Watch Reels
        </button>
      </div>

      {/* Matching Posts */}
      <section className="space-y-4">
        <h2 className="font-display text-sm font-bold text-zinc-500 dark:text-zinc-400">
          {query ? 'Matching Posts' : 'Popular Posts'}
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6">No matching posts found.</p>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onDelete={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
            />
          ))
        )}
      </section>
    </div>
  );
}
