import React, { useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Music,
  Eye,
  Plus,
  X,
  UserPlus,
  UserCheck,
  Loader2,
  Check,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { CommentNode, Post } from '../types';
import { Avatar, SafeImage, VerifiedBadge } from './OrbisUI';
import { CreatePostCard } from './CreatePostCard';

export function ReelsView() {
  const { currentUser, setAuthModalOpen, openProfile } = useApp();
  const [reels, setReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [activeCommentReelId, setActiveCommentReelId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadReels = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ posts: Post[] }>('/api/posts?tab=reels&limit=25');
      setReels(data.posts || []);
      // Increment views for first reel
      if (data.posts?.[0]) {
        apiFetch(`/api/posts/${data.posts[0].id}/view`, { method: 'POST' }).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReels();
  }, [currentUser?.id]);

  async function toggleLike(reel: Post) {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const res = await apiFetch<{ liked: boolean; count: number }>(`/api/posts/${reel.id}/like`, {
      method: 'POST',
    });
    setReels((prev) =>
      prev.map((r) =>
        r.id === reel.id ? { ...r, likedByMe: res.liked, counts: { ...r.counts, likes: res.count } } : r
      )
    );
  }

  async function toggleFollow(reel: Post) {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!reel.author) return;
    const res = await apiFetch<{ status: string }>(`/api/users/${reel.author.username}/follow`, {
      method: 'POST',
    });
    const isNowFollowing = res.status === 'ACCEPTED';
    setReels((prev) =>
      prev.map((r) =>
        r.author?.id === reel.author?.id && r.author
          ? { ...r, author: { ...r.author, followingByMe: isNowFollowing } }
          : r
      )
    );
  }

  async function openComments(reelId: string) {
    setActiveCommentReelId(reelId);
    const res = await apiFetch<{ comments: CommentNode[] }>(`/api/posts/${reelId}/comments`);
    setComments(res.comments || []);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCommentReelId || !commentInput.trim()) return;
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const res = await apiFetch<{ comment: CommentNode }>(`/api/posts/${activeCommentReelId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: commentInput }),
    });
    setComments((prev) => [...prev, res.comment]);
    setCommentInput('');
    setReels((prev) =>
      prev.map((r) =>
        r.id === activeCommentReelId
          ? { ...r, counts: { ...r.counts, comments: r.counts.comments + 1 } }
          : r
      )
    );
  }

  async function shareReel(reel: Post) {
    const url = `${window.location.origin}/?reel=${reel.id}`;
    if (navigator.clipboard) await navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(reel.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Reels</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Short-form vertical videos, sounds &amp; creator clips
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!currentUser) {
              setAuthModalOpen(true);
              return;
            }
            setShowUpload((v) => !v);
          }}
          className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showUpload ? 'Close' : 'Upload Reel'}
        </button>
      </div>

      {showUpload && (
        <CreatePostCard
          defaultReel
          placeholder="Describe your Reel, add #hashtags or @mentions..."
          onPostCreated={(newPost) => {
            setReels((prev) => [newPost, ...prev]);
            setShowUpload(false);
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      ) : reels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No Reels uploaded yet. Upload a vertical video above!
        </div>
      ) : (
        <div className="h-[calc(100vh-190px)] min-h-[540px] snap-y snap-mandatory overflow-y-auto no-scrollbar space-y-4 rounded-2xl">
          {reels.map((reel) => (
            <div
              key={reel.id}
              onMouseEnter={() => {
                apiFetch(`/api/posts/${reel.id}/view`, { method: 'POST' })
                  .then((d) =>
                    setReels((prev) =>
                      prev.map((r) => (r.id === reel.id ? { ...r, viewsCount: d.viewsCount } : r))
                    )
                  )
                  .catch(() => {});
              }}
              className="relative flex h-full min-h-[540px] w-full snap-start items-center justify-center overflow-hidden rounded-2xl bg-black text-white"
            >
              {reel.mediaType === 'VIDEO' && reel.mediaUrl ? (
                <video
                  src={reel.mediaUrl}
                  autoPlay
                  loop
                  muted={muted}
                  playsInline
                  controls={false}
                  onClick={(e) => {
                    const v = e.currentTarget;
                    if (v.paused) v.play();
                    else v.pause();
                  }}
                  className="h-full w-full object-contain cursor-pointer"
                />
              ) : (
                <SafeImage
                  src={reel.mediaUrl}
                  alt={reel.content || 'Reel'}
                  className="h-full w-full object-cover"
                />
              )}

              {/* Mute toggle top-right */}
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/75"
              >
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>

              {/* Right Action Rail */}
              <div className="absolute bottom-20 right-3 z-10 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={() => toggleLike(reel)}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ${
                      reel.likedByMe ? 'text-rose-500' : 'text-white'
                    }`}
                  >
                    <Heart className={`h-5 w-5 ${reel.likedByMe ? 'fill-current' : ''}`} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{reel.counts.likes}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openComments(reel.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{reel.counts.comments}</span>
                </button>

                <button
                  type="button"
                  onClick={() => shareReel(reel)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                    {copiedId === reel.id ? (
                      <Check className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Share2 className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs font-semibold">
                    {copiedId === reel.id ? 'Copied' : 'Share'}
                  </span>
                </button>
              </div>

              {/* Bottom Metadata Scrim */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 pt-16 pr-16">
                {reel.author && (
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => openProfile(reel.author!.username)}
                      className="flex items-center gap-2 text-left"
                    >
                      <Avatar src={reel.author.avatarUrl} name={reel.author.displayName} size="sm" />
                      <span className="text-sm font-bold flex items-center gap-1">
                        {reel.author.displayName}
                        {reel.author.isVerified && <VerifiedBadge />}
                      </span>
                    </button>

                    {currentUser?.id !== reel.author.id && (
                      <button
                        type="button"
                        onClick={() => toggleFollow(reel)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          reel.author.followingByMe
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {reel.author.followingByMe ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5" /> Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" /> Follow
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {reel.content && <p className="text-sm leading-snug line-clamp-2 mb-2">{reel.content}</p>}

                <div className="flex flex-wrap items-center gap-3 text-xs text-white/80 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Music className="h-3.5 w-3.5" />
                    {reel.soundTitle || 'Original Audio'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {reel.viewsCount} views
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reel Comments Drawer */}
      {activeCommentReelId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[75vh] w-full max-w-md flex-col rounded-t-3xl sm:rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h3 className="font-display text-base font-bold">Comments</h3>
              <button
                type="button"
                onClick={() => setActiveCommentReelId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-8">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 text-xs">
                    <Avatar src={c.author.avatarUrl} name={c.author.displayName} size="xs" />
                    <div>
                      <span className="font-semibold">{c.author.displayName}</span>
                      <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitComment} className="flex gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <input
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
