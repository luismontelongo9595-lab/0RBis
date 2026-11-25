import React, { useEffect, useState } from 'react';
import {
  Lock,
  Globe,
  Link as LinkIcon,
  MessageSquare,
  UserPlus,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { Post, User } from '../types';
import { Avatar, SafeImage, VerifiedBadge } from './OrbisUI';
import { PostCard } from './PostCard';

export function ProfileView() {
  const {
    currentUser,
    profileUsername,
    setActiveTab,
    setAuthModalOpen,
    openProfile,
    startDmWithUser,
  } = useApp();

  const targetUsername = profileUsername || currentUser?.username || 'elena_vance';

  const [profile, setProfile] = useState<(User & { counts: any }) | null>(null);
  const [followStatus, setFollowStatus] = useState<'NONE' | 'PENDING' | 'ACCEPTED'>('NONE');
  const [friendStatus, setFriendStatus] = useState<'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS'>('NONE');
  const [subscribed, setSubscribed] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaTab, setMediaTab] = useState<'all' | 'reels'>('all');
  const [modalList, setModalList] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`/api/users/${encodeURIComponent(targetUsername)}`);
      setProfile(data.profile);
      setFollowStatus(data.followStatus);
      setFriendStatus(data.friendStatus);
      setSubscribed(Boolean(data.subscribedToCreator));
      setFollowers(data.followers || []);
      setFollowing(data.following || []);

      const pRes = await apiFetch<{ posts: Post[] }>(
        `/api/posts?authorId=${data.profile.id}&limit=30`
      );
      setPosts(pRes.posts || []);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUsername, currentUser?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Profile not found.
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const canViewPosts = !profile.isPrivate || isOwnProfile || followStatus === 'ACCEPTED';
  const displayedPosts = mediaTab === 'reels' ? posts.filter((p) => p.isReel) : posts;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/70">
        {/* Cover Photo */}
        <div className="h-40 sm:h-48 w-full overflow-hidden bg-gradient-to-r from-indigo-600 via-rose-500 to-amber-500">
          {profile.coverUrl && (
            <SafeImage
              src={profile.coverUrl}
              alt={`${profile.displayName} cover`}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="px-5 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName}
              size="xl"
              isOnline={profile.isOnline}
            />

            <div className="flex flex-wrap items-center gap-2">
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentUser) return setAuthModalOpen(true);
                      const res = await apiFetch<{ status: any }>(
                        `/api/users/${profile.username}/follow`,
                        { method: 'POST' }
                      );
                      setFollowStatus(res.status);
                      loadProfile();
                    }}
                    className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold transition ${
                      followStatus === 'ACCEPTED'
                        ? 'border border-zinc-200 dark:border-zinc-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {followStatus === 'ACCEPTED'
                      ? 'Following'
                      : followStatus === 'PENDING'
                      ? 'Requested'
                      : 'Follow'}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentUser) return setAuthModalOpen(true);
                      await apiFetch('/api/friends/request', {
                        method: 'POST',
                        body: JSON.stringify({ userId: profile.id }),
                      });
                      loadProfile();
                    }}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {friendStatus === 'FRIENDS'
                      ? 'Friends'
                      : friendStatus === 'PENDING_SENT'
                      ? 'Request Sent'
                      : 'Add Friend'}
                  </button>

                  <button
                    type="button"
                    onClick={() => startDmWithUser(profile.id)}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Message
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentUser) return setAuthModalOpen(true);
                      const res = await apiFetch<{ subscribed: boolean }>('/api/subscriptions', {
                        method: 'POST',
                        body: JSON.stringify({ creatorId: profile.id }),
                      });
                      setSubscribed(res.subscribed);
                    }}
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                      subscribed
                        ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {subscribed
                      ? 'Member'
                      : `Join $${((profile.creatorTierPriceCents || 499) / 100).toFixed(2)}/mo`}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-xl font-bold font-display">
              <span>{profile.displayName}</span>
              {profile.isVerified && <VerifiedBadge />}
              {profile.isPrivate ? (
                <Lock className="h-4 w-4 text-zinc-400" aria-label="Private account" />
              ) : (
                <Globe className="h-4 w-4 text-zinc-400" aria-label="Public account" />
              )}
            </div>
            <p className="text-sm text-zinc-500">@{profile.username}</p>

            {profile.bio && (
              <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {profile.bio}
              </p>
            )}

            {profile.website && /^https?:\/\//i.test(profile.website) && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                {profile.website}
              </a>
            )}

            <div className="mt-4 flex flex-wrap gap-5 text-sm tabular-nums">
              <span>
                <strong>{profile.counts?.postsCount ?? 0}</strong>{' '}
                <span className="text-zinc-500">Posts</span>
              </span>
              <button
                type="button"
                onClick={() => setModalList('followers')}
                className="hover:underline"
              >
                <strong>{profile.counts?.followersCount ?? 0}</strong>{' '}
                <span className="text-zinc-500">Followers</span>
              </button>
              <button
                type="button"
                onClick={() => setModalList('following')}
                className="hover:underline"
              >
                <strong>{profile.counts?.followingCount ?? 0}</strong>{' '}
                <span className="text-zinc-500">Following</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts vs Reels Tabs */}
      {canViewPosts && (
        <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
          {(['all', 'reels'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMediaTab(t)}
              className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold ${
                mediaTab === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {t === 'all' ? 'Posts' : 'Reels'}
            </button>
          ))}
        </div>
      )}

      {!canViewPosts ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          <Lock className="mx-auto mb-2 h-6 w-6" />
          This account is private. Follow to view their posts and Reels.
        </div>
      ) : displayedPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No {mediaTab === 'reels' ? 'Reels' : 'posts'} published yet.
        </div>
      ) : (
        <div className="space-y-4">
          {displayedPosts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onDelete={(id) => setPosts((prev) => prev.filter((item) => item.id !== id))}
            />
          ))}
        </div>
      )}

      {/* Followers / Following Modal */}
      {modalList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h3 className="font-display text-base font-bold capitalize">{modalList}</h3>
              <button
                type="button"
                onClick={() => setModalList(null)}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 max-h-72 overflow-y-auto space-y-2.5">
              {(modalList === 'followers' ? followers : following).length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">No users to show.</p>
              ) : (
                (modalList === 'followers' ? followers : following).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setModalList(null);
                      openProfile(u.username);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 text-xs font-semibold truncate">
                        {u.displayName}
                        {u.isVerified && <VerifiedBadge />}
                      </p>
                      <p className="text-[11px] text-zinc-500">@{u.username}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
