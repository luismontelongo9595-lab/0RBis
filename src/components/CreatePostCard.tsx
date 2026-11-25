import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Video, X, Loader2, Send, Music, Globe, Lock } from 'lucide-react';
import { apiFetch, uploadMedia } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { Post } from '../types';
import { Avatar, SafeImage } from './OrbisUI';

export function CreatePostCard({
  onPostCreated,
  groupId,
  pageId,
  defaultReel = false,
  placeholder = 'Share an update, photo, video, or #hashtag...',
}: {
  onPostCreated: (post: Post) => void;
  groupId?: string;
  pageId?: string;
  defaultReel?: boolean;
  placeholder?: string;
}) {
  const { currentUser, setAuthModalOpen } = useApp();
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | 'NONE'>('NONE');
  const [isReel, setIsReel] = useState(defaultReel);
  const [soundTitle, setSoundTitle] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FOLLOWERS'>('PUBLIC');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Join Orbis to share posts, photos, Reels, and join discussions.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
        >
          Sign in / Join
        </button>
      </div>
    );
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await uploadMedia(file);
      if (res.mediaType === 'AUDIO') {
        setError('Please select a photo or video file.');
        return;
      }
      setMediaUrl(res.url);
      setMediaType(res.mediaType);
      if (res.mediaType === 'VIDEO') setIsReel(true);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && !mediaUrl) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch<{ post: Post }>('/api/posts', {
        method: 'POST',
        body: JSON.stringify({
          content,
          mediaUrl,
          mediaType,
          isReel,
          soundTitle: isReel && soundTitle.trim() ? soundTitle.trim() : null,
          visibility,
          groupId: groupId || null,
          pageId: pageId || null,
        }),
      });
      setContent('');
      setMediaUrl(null);
      setMediaType('NONE');
      setSoundTitle('');
      setIsReel(defaultReel);
      onPostCreated(data.post);
    } catch (err: any) {
      setError(err.message || 'Failed to publish post.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
    >
      <div className="flex gap-3">
        <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} />
        <div className="flex-1 min-w-0 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full resize-none bg-transparent text-sm sm:text-[15px] outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />

          {mediaUrl && (
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setMediaUrl(null);
                  setMediaType('NONE');
                }}
                aria-label="Remove attachment"
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
              {mediaType === 'VIDEO' ? (
                <video src={mediaUrl} controls className="max-h-80 w-full bg-black" />
              ) : (
                <SafeImage src={mediaUrl} alt="Upload preview" className="max-h-80 w-full object-cover" />
              )}
            </div>
          )}

          {isReel && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/60">
              <Music className="h-4 w-4 text-indigo-500 shrink-0" />
              <input
                value={soundTitle}
                onChange={(e) => setSoundTitle(e.target.value)}
                placeholder="Sound or music track title (optional)"
                className="w-full bg-transparent text-xs outline-none dark:text-zinc-100"
              />
            </div>
          )}

          {error && <p className="text-xs font-medium text-rose-500">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-rose-500" />
                )}
                Photo
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                <Video className="h-4 w-4 text-indigo-500" />
                Video
              </button>
              <button
                type="button"
                onClick={() => setIsReel((v) => !v)}
                className={`flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                  isReel
                    ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
                {isReel ? 'Reel Mode' : 'Make Reel'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!groupId && !pageId && (
                <button
                  type="button"
                  onClick={() => setVisibility((v) => (v === 'PUBLIC' ? 'FOLLOWERS' : 'PUBLIC'))}
                  className="flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap"
                  title="Toggle post visibility"
                >
                  {visibility === 'PUBLIC' ? (
                    <>
                      <Globe className="h-3.5 w-3.5" /> Public
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Followers
                    </>
                  )}
                </button>
              )}

              <button
                type="submit"
                disabled={submitting || uploading || (!content.trim() && !mediaUrl)}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Publish
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
