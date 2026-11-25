import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  Trash2,
  Flag,
  CornerDownRight,
  Music,
  Check,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { CommentNode, Post } from '../types';
import { Avatar, SafeImage, VerifiedBadge, formatRelativeTime } from './OrbisUI';

export function PostCard({
  post,
  onDelete,
  onReposted,
}: {
  post: Post;
  onDelete?: (id: string) => void;
  onReposted?: (newPost: Post) => void;
}) {
  const { currentUser, setAuthModalOpen, openProfile, openExplore } = useApp();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.counts.likes);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByMe);
  const [commentsCount, setCommentsCount] = useState(post.counts.comments);
  const [repostsCount, setRepostsCount] = useState(post.counts.reposts);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);

  const displayPost = post.repostOf ?? post;
  if (!displayPost.author) return null;

  async function toggleLike() {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const prev = liked;
    setLiked(!prev);
    setLikesCount((c) => (prev ? Math.max(0, c - 1) : c + 1));
    try {
      const res = await apiFetch<{ liked: boolean; count: number }>(`/api/posts/${post.id}/like`, {
        method: 'POST',
      });
      setLiked(res.liked);
      setLikesCount(res.count);
    } catch {
      setLiked(prev);
      setLikesCount(post.counts.likes);
    }
  }

  async function toggleBookmark() {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const res = await apiFetch<{ bookmarked: boolean }>(`/api/posts/${post.id}/bookmark`, {
        method: 'POST',
      });
      setBookmarked(res.bookmarked);
    } catch {
      setBookmarked(prev);
    }
  }

  async function handleRepost() {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const res = await apiFetch<{ post: Post }>(`/api/posts/${post.id}/repost`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setRepostsCount((c) => c + 1);
    onReposted?.(res.post);
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next) {
      const res = await apiFetch<{ comments: CommentNode[] }>(`/api/posts/${post.id}/comments`);
      setComments(res.comments || []);
    }
  }

  async function submitComment(e: React.FormEvent, parentId: string | null = null) {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const text = (parentId ? replyText : commentText).trim();
    if (!text) return;

    const res = await apiFetch<{ comment: CommentNode }>(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: text, parentId }),
    });

    if (parentId) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replies: [...(c.replies || []), res.comment] } : c
        )
      );
      setReplyToId(null);
      setReplyText('');
    } else {
      setComments((prev) => [...prev, res.comment]);
      setCommentText('');
    }
    setCommentsCount((c) => c + 1);
  }

  async function handleShare() {
    const url = `${window.location.origin}/?user=${displayPost.author?.username}`;
    if (navigator.share) {
      await navigator.share({ title: `${displayPost.author?.displayName} on Orbis`, url }).catch(() => {});
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  async function handleDelete() {
    await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    onDelete?.(post.id);
  }

  async function handleReport() {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (reported) return;
    await apiFetch(`/api/posts/${post.id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Reported from feed by community member' }),
    });
    setReported(true);
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
      {post.repostOf && post.author && (
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          <Repeat2 className="h-3.5 w-3.5 text-emerald-500" />
          <button
            type="button"
            onClick={() => openProfile(post.author!.username)}
            className="hover:underline"
          >
            {post.author.displayName}
          </button>
          <span>reposted</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => openProfile(displayPost.author!.username)}
          className="flex items-center gap-3 text-left min-w-0"
        >
          <Avatar
            src={displayPost.author.avatarUrl}
            name={displayPost.author.displayName}
            isOnline={displayPost.author.isOnline}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              <span className="truncate">{displayPost.author.displayName}</span>
              {displayPost.author.isVerified && <VerifiedBadge />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
              <span>@{displayPost.author.username}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelativeTime(displayPost.createdAt)}</span>
              {displayPost.group && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate text-indigo-600 dark:text-indigo-400">
                    {displayPost.group.name}
                  </span>
                </>
              )}
              {displayPost.page && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate text-indigo-600 dark:text-indigo-400">
                    {displayPost.page.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {currentUser && (currentUser.id === post.authorId || currentUser.role === 'ADMIN') ? (
            <button
              type="button"
              onClick={handleDelete}
              title="Delete post"
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReport}
              title={reported ? 'Reported to moderators' : 'Report post'}
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                reported
                  ? 'text-amber-500'
                  : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Flag className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Text Content with clickable #hashtags and @mentions */}
      {displayPost.content && (
        <p className="mt-3 whitespace-pre-wrap text-sm sm:text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
          {displayPost.content.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+)/g).map((part, idx) => {
            if (part.startsWith('#')) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openExplore(part)}
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {part}
                </button>
              );
            }
            if (part.startsWith('@')) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openProfile(part.slice(1).toLowerCase())}
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {part}
                </button>
              );
            }
            return <React.Fragment key={idx}>{part}</React.Fragment>;
          })}
        </p>
      )}

      {/* Sound attribution if Reel */}
      {displayPost.isReel && displayPost.soundTitle && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Music className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span className="truncate">{displayPost.soundTitle}</span>
        </div>
      )}

      {/* Media */}
      {displayPost.mediaUrl && (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {displayPost.mediaType === 'VIDEO' ? (
            <video
              src={displayPost.mediaUrl}
              controls
              playsInline
              className="max-h-[520px] w-full bg-black"
            />
          ) : (
            <SafeImage
              src={displayPost.mediaUrl}
              alt={displayPost.content || 'Post attachment'}
              className="max-h-[540px] w-full object-cover"
            />
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-2.5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition tabular-nums ${
            liked ? 'text-rose-600 bg-rose-500/10 dark:text-rose-400' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          <span>{likesCount}</span>
        </button>

        <button
          type="button"
          onClick={toggleComments}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 tabular-nums"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{commentsCount}</span>
        </button>

        <button
          type="button"
          onClick={handleRepost}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 tabular-nums"
        >
          <Repeat2 className="h-4 w-4" />
          <span>{repostsCount}</span>
        </button>

        <button
          type="button"
          onClick={toggleBookmark}
          aria-label="Save post"
          className={`flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
            bookmarked
              ? 'text-amber-600 bg-amber-500/10 dark:text-amber-400'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
          {copied && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Copied</span>}
        </button>
      </div>

      {/* Comments & Nested Replies */}
      {showComments && (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <form onSubmit={(e) => submitComment(e, null)} className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={currentUser ? 'Write a comment...' : 'Sign in to comment'}
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="min-h-[38px] rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Post
            </button>
          </form>

          {comments.length === 0 ? (
            <p className="text-xs text-zinc-500 py-1">No comments yet. Start the conversation.</p>
          ) : (
            <div className="space-y-2.5">
              {comments.map((c) => (
                <div key={c.id} className="space-y-2">
                  <div className="flex items-start gap-2.5 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                    <Avatar src={c.author.avatarUrl} name={c.author.displayName} size="xs" />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openProfile(c.author.username)}
                          className="flex items-center gap-1 font-semibold hover:underline truncate"
                        >
                          {c.author.displayName}
                          {c.author.isVerified && <VerifiedBadge />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyToId(replyToId === c.id ? null : c.id)}
                          className="text-zinc-500 hover:text-indigo-500 shrink-0"
                        >
                          Reply
                        </button>
                      </div>
                      <p className="mt-1 text-zinc-700 dark:text-zinc-200">{c.content}</p>
                    </div>
                  </div>

                  {c.replies?.map((r) => (
                    <div
                      key={r.id}
                      className="ml-6 flex items-start gap-2 rounded-xl bg-zinc-50/70 p-2.5 dark:bg-zinc-800/40"
                    >
                      <CornerDownRight className="h-3.5 w-3.5 text-zinc-400 mt-1 shrink-0" />
                      <Avatar src={r.author.avatarUrl} name={r.author.displayName} size="xs" />
                      <div className="text-xs min-w-0">
                        <button
                          type="button"
                          onClick={() => openProfile(r.author.username)}
                          className="font-semibold hover:underline"
                        >
                          {r.author.displayName}
                        </button>
                        <p className="mt-0.5 text-zinc-700 dark:text-zinc-300">{r.content}</p>
                      </div>
                    </div>
                  ))}

                  {replyToId === c.id && (
                    <form onSubmit={(e) => submitComment(e, c.id)} className="ml-6 flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to ${c.author.displayName}...`}
                        className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Reply
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
