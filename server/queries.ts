import { randomUUID } from 'crypto';
import { db } from './db';
import { sendToUser } from './ws';

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]{2,30}/g) ?? [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z0-9_]{2,30}/g) ?? [];
  return [...new Set(matches.map((u) => u.slice(1).toLowerCase()))];
}

export function createNotification(params: {
  recipientId: string;
  actorId: string;
  type: string;
  entityId?: string | null;
}) {
  if (params.recipientId === params.actorId) return;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO notifications (id, recipient_id, actor_id, type, entity_id) VALUES (?, ?, ?, ?, ?)`
  ).run(id, params.recipientId, params.actorId, params.type, params.entityId ?? null);

  const actor = db
    .prepare(`SELECT id, username, display_name, avatar_url, is_verified FROM users WHERE id = ?`)
    .get(params.actorId) as any;

  if (actor) {
    sendToUser(params.recipientId, 'notification:new', {
      id,
      type: params.type,
      entityId: params.entityId ?? null,
      isRead: false,
      createdAt: new Date().toISOString(),
      actor: {
        id: actor.id,
        username: actor.username,
        displayName: actor.display_name,
        avatarUrl: actor.avatar_url,
        isVerified: Boolean(actor.is_verified),
      },
    });
  }
}

export function hydratePost(row: any, viewerId?: string | null): any {
  const author = db
    .prepare(
      `SELECT id, username, display_name, avatar_url, is_verified, is_private, is_online, creator_tier_price_cents
       FROM users WHERE id = ?`
    )
    .get(row.author_id) as any;

  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM likes WHERE post_id = ?) as likesCount,
        (SELECT COUNT(*) FROM comments WHERE post_id = ?) as commentsCount,
        (SELECT COUNT(*) FROM posts WHERE repost_of_id = ?) as repostsCount,
        (SELECT COUNT(*) FROM bookmarks WHERE post_id = ?) as bookmarksCount`
    )
    .get(row.id, row.id, row.id, row.id) as any;

  const likedByMe = viewerId
    ? Boolean(db.prepare(`SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?`).get(row.id, viewerId))
    : false;
  const bookmarkedByMe = viewerId
    ? Boolean(db.prepare(`SELECT 1 FROM bookmarks WHERE post_id = ? AND user_id = ?`).get(row.id, viewerId))
    : false;

  let followingAuthor = false;
  if (viewerId && author && viewerId !== author.id) {
    followingAuthor = Boolean(
      db
        .prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'ACCEPTED'`)
        .get(viewerId, author.id)
    );
  }

  let groupInfo: any = null;
  if (row.group_id) {
    const g = db.prepare(`SELECT id, name, slug FROM groups WHERE id = ?`).get(row.group_id) as any;
    if (g) groupInfo = g;
  }

  let pageInfo: any = null;
  if (row.page_id) {
    const p = db.prepare(`SELECT id, name, handle FROM pages WHERE id = ?`).get(row.page_id) as any;
    if (p) pageInfo = p;
  }

  let repostOf: any = null;
  if (row.repost_of_id) {
    const origRow = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(row.repost_of_id) as any;
    if (origRow) {
      repostOf = hydratePost(origRow, viewerId);
    }
  }

  return {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    isReel: Boolean(row.is_reel),
    soundTitle: row.sound_title,
    visibility: row.visibility,
    viewsCount: row.views_count,
    repostOfId: row.repost_of_id,
    groupId: row.group_id,
    pageId: row.page_id,
    createdAt: row.created_at,
    author: author
      ? {
          id: author.id,
          username: author.username,
          displayName: author.display_name,
          avatarUrl: author.avatar_url,
          isVerified: Boolean(author.is_verified),
          isPrivate: Boolean(author.is_private),
          isOnline: Boolean(author.is_online),
          creatorTierPriceCents: author.creator_tier_price_cents,
          followingByMe: followingAuthor,
        }
      : null,
    group: groupInfo,
    page: pageInfo,
    repostOf,
    likedByMe,
    bookmarkedByMe,
    counts: {
      likes: counts.likesCount,
      comments: counts.commentsCount,
      reposts: counts.repostsCount,
      bookmarks: counts.bookmarksCount,
    },
  };
}
