import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { AdCampaign, Post } from '../types';
import { StoriesBar } from './StoriesBar';
import { CreatePostCard } from './CreatePostCard';
import { PostCard } from './PostCard';
import { SafeImage } from './OrbisUI';

export function FeedView() {
  const { currentUser, setAuthModalOpen } = useApp();
  const [tab, setTab] = useState<'foryou' | 'following' | 'saved'>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [ads, setAds] = useState<AdCampaign[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  async function fetchFeed(reset = false, nextOffset = 0) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await apiFetch<{ posts: Post[]; hasMore: boolean; nextOffset: number }>(
        `/api/posts?tab=${tab}&offset=${nextOffset}&limit=10`
      );
      setPosts((prev) => (reset ? data.posts : [...prev, ...data.posts]));
      setHasMore(data.hasMore);
      setOffset(data.nextOffset);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchFeed(true, 0);
    apiFetch<{ ads: AdCampaign[] }>('/api/ads?scope=feed')
      .then((d) => setAds(d.ads || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentUser?.id]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchFeed(false, offset);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, offset, tab]);

  const handleAdClick = (ad: AdCampaign) => {
    apiFetch(`/api/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <StoriesBar />

      {/* Feed Mode Segmented Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
        {(
          [
            { id: 'foryou', label: 'For You' },
            { id: 'following', label: 'Following' },
            { id: 'saved', label: 'Saved' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if ((item.id === 'following' || item.id === 'saved') && !currentUser) {
                setAuthModalOpen(true);
                return;
              }
              setTab(item.id);
            }}
            className={`flex-1 min-h-[40px] rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
              tab === item.id
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== 'saved' && (
        <CreatePostCard onPostCreated={(newPost) => setPosts((prev) => [newPost, ...prev])} />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {tab === 'following'
            ? 'Follow creators or friends to see their posts here.'
            : tab === 'saved'
            ? 'Bookmark posts you want to revisit and they will appear here.'
            : 'No posts yet. Publish the first update above!'}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, idx) => (
            <React.Fragment key={post.id}>
              <PostCard
                post={post}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                onReposted={(np) => setPosts((prev) => [np, ...prev])}
              />

              {/* Render Sponsored Ad after the 2nd post */}
              {idx === 1 && ads[0] && tab === 'foryou' && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                    <span>Sponsored · Partner Placement</span>
                    <span className="tabular-nums">{ads[0].impressions} views</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {ads[0].title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{ads[0].body}</p>
                  {ads[0].image_url && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <SafeImage
                        src={ads[0].image_url}
                        alt={ads[0].title}
                        className="max-h-64 w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <a
                      href={ads[0].target_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleAdClick(ads[0])}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Learn More <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="flex h-10 items-center justify-center">
        {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />}
      </div>
    </div>
  );
}
