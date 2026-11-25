import React, { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { NotificationItem } from '../types';
import { Avatar, VerifiedBadge, formatRelativeTime } from './OrbisUI';

export function NotificationsView() {
  const { currentUser, setAuthModalOpen, openProfile, setUnreadNotifications, subscribeWs } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const loadNotifications = async () => {
    if (!currentUser) return;
    const res = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications');
    setItems(res.notifications || []);
    setUnreadNotifications(res.unreadCount || 0);
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    return subscribeWs((event, payload) => {
      if (event === 'notification:new') {
        setItems((prev) => [payload as NotificationItem, ...prev]);
      }
    });
  }, [subscribeWs]);

  if (!currentUser) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <Bell className="mx-auto mb-2 h-6 w-6 text-zinc-400" />
        <p className="text-sm text-zinc-500 mb-4">Sign in to view live notifications.</p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="min-h-[42px] rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white"
        >
          Sign in
        </button>
      </div>
    );
  }

  const labelForType = (type: string) => {
    switch (type) {
      case 'LIKE':
        return 'liked your post';
      case 'COMMENT':
        return 'commented on your post';
      case 'FOLLOW':
        return 'started following you';
      case 'FOLLOW_REQUEST':
        return 'requested to follow you';
      case 'FOLLOW_ACCEPTED':
        return 'accepted your follow request';
      case 'FRIEND_REQUEST':
        return 'sent you a friend request';
      case 'FRIEND_ACCEPTED':
        return 'accepted your friend request';
      case 'MENTION':
        return 'mentioned you in a post';
      case 'REPOST':
        return 'reposted your post';
      case 'MESSAGE':
        return 'sent you a message';
      default:
        return 'interacted with you';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Notifications</h1>
        {items.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={async () => {
              await apiFetch('/api/notifications/read', { method: 'POST' });
              setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
              setUnreadNotifications(0);
            }}
            className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Mark all as read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-800">
          You are all caught up.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/70">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-center justify-between gap-3 p-4 ${
                !n.isRead ? 'bg-indigo-600/5' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => openProfile(n.actor.username)}
                className="flex items-center gap-3 text-left min-w-0"
              >
                <Avatar src={n.actor.avatarUrl} name={n.actor.displayName} size="sm" />
                <div className="min-w-0 text-sm">
                  <p className="truncate">
                    <span className="font-semibold">{n.actor.displayName}</span>{' '}
                    {n.actor.isVerified && <VerifiedBadge />}{' '}
                    <span className="text-zinc-600 dark:text-zinc-300">{labelForType(n.type)}</span>
                  </p>
                  <p className="text-xs text-zinc-400">{formatRelativeTime(n.createdAt)}</p>
                </div>
              </button>

              {n.type === 'FOLLOW_REQUEST' && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/follow-requests/${n.actor.id}`, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'ACCEPT' }),
                      });
                      loadNotifications();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"
                    title="Accept follow request"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/follow-requests/${n.actor.id}`, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'DECLINE' }),
                      });
                      loadNotifications();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700"
                    title="Decline follow request"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {n.type === 'FRIEND_REQUEST' && (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/friends/respond', {
                        method: 'POST',
                        body: JSON.stringify({ senderId: n.actor.id, accept: true }),
                      });
                      loadNotifications();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"
                    title="Accept friend request"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/friends/respond', {
                        method: 'POST',
                        body: JSON.stringify({ senderId: n.actor.id, accept: false }),
                      });
                      loadNotifications();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700"
                    title="Decline friend request"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
