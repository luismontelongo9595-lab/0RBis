import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Eye, Trash2, Loader2 } from 'lucide-react';
import { apiFetch, uploadMedia } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { StoryGroup } from '../types';
import { Avatar, SafeImage, VerifiedBadge, formatRelativeTime } from './OrbisUI';

export function StoriesBar() {
  const { currentUser, setAuthModalOpen, openProfile } = useApp();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [captionPromptOpen, setCaptionPromptOpen] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; mediaType: 'IMAGE' | 'VIDEO' } | null>(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStories = async () => {
    try {
      const data = await apiFetch<{ storyGroups: StoryGroup[] }>('/api/stories');
      setStoryGroups(data.storyGroups || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStories();
  }, [currentUser?.id]);

  // Auto-mark seen when opening a story
  useEffect(() => {
    if (activeGroupIdx === null) return;
    const group = storyGroups[activeGroupIdx];
    const item = group?.items[activeItemIdx];
    if (!item) return;

    if (currentUser && !item.seenByMe) {
      apiFetch(`/api/stories/${item.id}/view`, { method: 'POST' }).catch(() => {});
      setStoryGroups((prev) =>
        prev.map((g, gi) =>
          gi === activeGroupIdx
            ? {
                ...g,
                items: g.items.map((it, ii) =>
                  ii === activeItemIdx ? { ...it, seenByMe: true, viewsCount: it.viewsCount + 1 } : it
                ),
              }
            : g
        )
      );
    }

    const timer = setTimeout(() => {
      handleNext();
    }, 6500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupIdx, activeItemIdx]);

  const handleNext = () => {
    if (activeGroupIdx === null) return;
    const group = storyGroups[activeGroupIdx];
    if (!group) return;
    if (activeItemIdx < group.items.length - 1) {
      setActiveItemIdx((i) => i + 1);
    } else if (activeGroupIdx < storyGroups.length - 1) {
      setActiveGroupIdx((g) => (g !== null ? g + 1 : null));
      setActiveItemIdx(0);
    } else {
      setActiveGroupIdx(null);
    }
  };

  const handlePrev = () => {
    if (activeGroupIdx === null) return;
    if (activeItemIdx > 0) {
      setActiveItemIdx((i) => i - 1);
    } else if (activeGroupIdx > 0) {
      const prevGroup = storyGroups[activeGroupIdx - 1];
      setActiveGroupIdx(activeGroupIdx - 1);
      setActiveItemIdx(Math.max(0, prevGroup.items.length - 1));
    }
  };

  async function handleSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file);
      if (uploaded.mediaType === 'AUDIO') return;
      setPendingMedia({ url: uploaded.url, mediaType: uploaded.mediaType });
      setCaptionPromptOpen(true);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function publishStory(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingMedia) return;
    await apiFetch('/api/stories', {
      method: 'POST',
      body: JSON.stringify({
        mediaUrl: pendingMedia.url,
        mediaType: pendingMedia.mediaType,
        caption,
      }),
    });
    setPendingMedia(null);
    setCaption('');
    setCaptionPromptOpen(false);
    await loadStories();
  }

  async function deleteStory(storyId: string) {
    await apiFetch(`/api/stories/${storyId}`, { method: 'DELETE' });
    setActiveGroupIdx(null);
    await loadStories();
  }

  const activeGroup = activeGroupIdx !== null ? storyGroups[activeGroupIdx] : null;
  const activeItem = activeGroup ? activeGroup.items[activeItemIdx] : null;

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          onChange={handleSelectFile}
          className="hidden"
        />

        {/* Add Story Button */}
        <button
          type="button"
          onClick={() => {
            if (!currentUser) {
              setAuthModalOpen(true);
              return;
            }
            fileRef.current?.click();
          }}
          className="flex flex-col items-center gap-1.5 shrink-0 min-w-[68px]"
        >
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-indigo-500/70 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          </div>
          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[68px]">
            Your Story
          </span>
        </button>

        {/* Active 24h Stories */}
        {storyGroups.map((sg, idx) => (
          <button
            key={sg.author.id}
            type="button"
            onClick={() => {
              setActiveGroupIdx(idx);
              setActiveItemIdx(0);
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 min-w-[68px]"
          >
            <div
              className={`rounded-full p-[2.5px] ${
                sg.hasUnseen
                  ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600'
                  : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <div className="rounded-full bg-white p-[2px] dark:bg-zinc-950">
                <Avatar src={sg.author.avatarUrl} name={sg.author.displayName} size="lg" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[68px]">
              {sg.author.displayName.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Add Story Caption Modal */}
      {captionPromptOpen && pendingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={publishStory}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Share 24-Hour Story</h3>
              <button
                type="button"
                onClick={() => {
                  setCaptionPromptOpen(false);
                  setPendingMedia(null);
                }}
                className="p-1.5 rounded-full hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-hidden rounded-xl bg-black aspect-[9/16] max-h-80 mx-auto">
              {pendingMedia.mediaType === 'VIDEO' ? (
                <video src={pendingMedia.url} controls className="h-full w-full object-contain" />
              ) : (
                <SafeImage src={pendingMedia.url} alt="Story preview" className="h-full w-full object-cover" />
              )}
            </div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add an optional caption..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="min-h-[44px] w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Publish Story
            </button>
          </form>
        </div>
      )}

      {/* Fullscreen Story Viewer */}
      {activeGroup && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-6">
          <div className="relative flex h-full max-h-[820px] w-full max-w-[430px] flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl">
            {/* Progress Bars */}
            <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
              {activeGroup.items.map((it, i) => (
                <div key={it.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                  <div
                    className={`h-full bg-white transition-all duration-300 ${
                      i < activeItemIdx ? 'w-full' : i === activeItemIdx ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="absolute top-7 left-3 right-3 z-20 flex items-center justify-between text-white">
              <button
                type="button"
                onClick={() => {
                  setActiveGroupIdx(null);
                  openProfile(activeGroup.author.username);
                }}
                className="flex items-center gap-2.5 text-left"
              >
                <Avatar src={activeGroup.author.avatarUrl} name={activeGroup.author.displayName} size="sm" />
                <div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {activeGroup.author.displayName}
                    {activeGroup.author.isVerified && <VerifiedBadge />}
                  </div>
                  <p className="text-[11px] text-white/75">{formatRelativeTime(activeItem.createdAt)}</p>
                </div>
              </button>

              <div className="flex items-center gap-1">
                {currentUser?.id === activeGroup.author.id && (
                  <button
                    type="button"
                    onClick={() => deleteStory(activeItem.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-rose-600"
                    title="Delete story"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveGroupIdx(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70"
                  aria-label="Close story"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Media */}
            <div className="relative flex-1 bg-black">
              {activeItem.mediaType === 'VIDEO' ? (
                <video
                  src={activeItem.mediaUrl}
                  autoPlay
                  playsInline
                  controls
                  className="h-full w-full object-contain"
                />
              ) : (
                <SafeImage
                  src={activeItem.mediaUrl}
                  alt={activeItem.caption || 'Story'}
                  className="h-full w-full object-cover"
                />
              )}

              {/* Tap Navigation Zones */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous story"
                className="absolute inset-y-16 left-0 w-1/3 flex items-center justify-start pl-2 text-white/0 hover:text-white/80 transition"
              >
                <ChevronLeft className="h-7 w-7 drop-shadow" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next story"
                className="absolute inset-y-16 right-0 w-1/3 flex items-center justify-end pr-2 text-white/0 hover:text-white/80 transition"
              >
                <ChevronRight className="h-7 w-7 drop-shadow" />
              </button>

              {/* Bottom Caption & Views Scrim */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-12 text-white">
                {activeItem.caption && <p className="text-sm leading-relaxed mb-2">{activeItem.caption}</p>}
                <div className="flex items-center gap-1.5 text-xs text-white/75 tabular-nums">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{activeItem.viewsCount} views · Expires in 24h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
