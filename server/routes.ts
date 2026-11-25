import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { db } from './db';
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  mapUserRow,
  optionalAuth,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from './auth';
import {
  createNotification,
  extractHashtags,
  extractMentions,
  hydratePost,
} from './queries';
import { sendToUser } from './ws';

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.mp4', '.webm', '.mov',
  '.mp3', '.ogg', '.wav', '.m4a',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXTS.has(ext) ? ext : '.bin';
    cb(null, `${randomUUID()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || '';
    if (
      mime.startsWith('image/') ||
      mime.startsWith('video/') ||
      mime.startsWith('audio/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported media format.'));
    }
  },
});

export function registerApiRoutes(app: express.Express) {
  const api = express.Router();
  api.use(optionalAuth);

  // ==================== HEALTH ====================
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ==================== AUTH & ADMIN CLAIM ====================
  api.post('/auth/register', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const username = String(req.body.username || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
      const displayName = String(req.body.displayName || '').trim();
      const password = String(req.body.password || '');

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required.' });
      }
      if (username.length < 3 || username.length > 24) {
        return res.status(400).json({ error: 'Username must be 3–24 letters, numbers, or underscores.' });
      }
      if (displayName.length < 2) {
        return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existing = db
        .prepare(`SELECT id FROM users WHERE email = ? OR username = ?`)
        .get(email, username);
      if (existing) {
        return res.status(409).json({ error: 'Email or username is already registered.' });
      }

      const id = randomUUID();
      const passwordHash = await hashPassword(password);
      // First real registered user (with password_hash IS NOT NULL) receives ADMIN & verified badge
      const realUsersCount = (
        db.prepare(`SELECT COUNT(*) as c FROM users WHERE password_hash IS NOT NULL`).get() as { c: number }
      ).c;
      const role = realUsersCount === 0 ? 'ADMIN' : 'USER';
      const isVerified = realUsersCount === 0 ? 1 : 0;

      db.prepare(
        `INSERT INTO users (id, email, username, display_name, password_hash, role, is_verified, is_online)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(id, email, username, displayName, passwordHash, role, isVerified);

      const userRow = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
      const token = await createSessionToken(id);
      setSessionCookie(res, token);

      res.status(201).json({ user: mapUserRow(userRow), token });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Registration failed.' });
    }
  });

  api.post('/auth/login', async (req, res) => {
    try {
      const identifier = String(req.body.identifier || '').trim().toLowerCase();
      const password = String(req.body.password || '');

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/username and password are required.' });
      }

      const row = db
        .prepare(`SELECT * FROM users WHERE email = ? OR username = ?`)
        .get(identifier, identifier) as any;

      if (!row || !row.password_hash || !(await verifyPassword(password, row.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      if (row.status !== 'ACTIVE') {
        return res.status(403).json({ error: `Account is currently ${row.status.toLowerCase()}.` });
      }

      db.prepare(`UPDATE users SET is_online = 1, last_seen_at = datetime('now') WHERE id = ?`).run(row.id);
      const token = await createSessionToken(row.id);
      setSessionCookie(res, token);

      res.json({ user: mapUserRow(row), token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  api.post('/auth/logout', (req: AuthedRequest, res) => {
    if (req.user) {
      db.prepare(`UPDATE users SET is_online = 0, last_seen_at = datetime('now') WHERE id = ?`).run(req.user.id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  api.get('/auth/me', async (req: AuthedRequest, res) => {
    if (!req.user) {
      return res.json({ user: null, token: null });
    }
    const token = await createSessionToken(req.user.id);
    res.json({ user: req.user, token });
  });

  api.patch('/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const u = req.user!;
    const displayName =
      req.body.displayName !== undefined ? String(req.body.displayName).trim() : u.displayName;
    const bio = req.body.bio !== undefined ? String(req.body.bio).slice(0, 300) : u.bio;
    const website = req.body.website !== undefined ? String(req.body.website).trim().slice(0, 200) : u.website;
    const avatarUrl = req.body.avatarUrl !== undefined ? req.body.avatarUrl : u.avatarUrl;
    const coverUrl = req.body.coverUrl !== undefined ? req.body.coverUrl : u.coverUrl;
    const isPrivate = req.body.isPrivate !== undefined ? (req.body.isPrivate ? 1 : 0) : u.isPrivate ? 1 : 0;
    const creatorTierPriceCents =
      req.body.creatorTierPriceCents !== undefined
        ? Math.max(99, Math.min(99900, Number(req.body.creatorTierPriceCents) || 499))
        : u.creatorTierPriceCents;

    if (displayName.length < 2) {
      return res.status(400).json({ error: 'Display name must be at least 2 characters.' });
    }

    db.prepare(
      `UPDATE users
       SET display_name = ?, bio = ?, website = ?, avatar_url = ?, cover_url = ?, is_private = ?, creator_tier_price_cents = ?
       WHERE id = ?`
    ).run(displayName, bio, website, avatarUrl, coverUrl, isPrivate, creatorTierPriceCents, u.id);

    const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(u.id);
    res.json({ user: mapUserRow(updated) });
  });

  api.get('/auth/admin-status', requireAuth, (_req, res) => {
    const envSet = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    const saved = db.prepare(`SELECT value FROM app_settings WHERE key = 'admin_passcode_hash'`).get();
    res.json({
      configured: envSet || Boolean(saved),
      needsClaim: !envSet && !saved,
    });
  });

  api.post('/auth/admin-claim', requireAuth, async (req: AuthedRequest, res) => {
    const passcode = String(req.body.passcode || '').trim();
    if (passcode.length < 4) {
      return res.status(400).json({ error: 'Passcode must be at least 4 characters.' });
    }

    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass) {
      if (passcode !== envPass) {
        return res.status(403).json({ error: 'Invalid admin passcode.' });
      }
    } else {
      const saved = db
        .prepare(`SELECT value FROM app_settings WHERE key = 'admin_passcode_hash'`)
        .get() as { value: string } | undefined;

      if (!saved) {
        const hash = await hashPassword(passcode);
        db.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('admin_passcode_hash', ?)`).run(hash);
      } else {
        const valid = await verifyPassword(passcode, saved.value);
        if (!valid) {
          return res.status(403).json({ error: 'Invalid admin passcode.' });
        }
      }
    }

    db.prepare(`UPDATE users SET role = 'ADMIN', is_verified = 1 WHERE id = ?`).run(req.user!.id);
    const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id);
    res.json({ user: mapUserRow(updated) });
  });

  // ==================== MEDIA UPLOAD ====================
  api.post('/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided.' });
    }
    const mime = req.file.mimetype || '';
    const mediaType = mime.startsWith('video/')
      ? 'VIDEO'
      : mime.startsWith('audio/')
      ? 'AUDIO'
      : 'IMAGE';

    res.json({
      url: `/uploads/${req.file.filename}`,
      mediaType,
    });
  });

  // ==================== POSTS, REELS & FEED ====================
  api.get('/posts', (req: AuthedRequest, res) => {
    const viewer = req.user;
    const tab = String(req.query.tab || 'foryou');
    const hashtag = String(req.query.hashtag || '').trim().toLowerCase();
    const authorId = String(req.query.authorId || '').trim();
    const groupId = String(req.query.groupId || '').trim();
    const pageId = String(req.query.pageId || '').trim();
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));

    let followingIds: string[] = [];
    if (viewer) {
      const rows = db
        .prepare(`SELECT following_id FROM follows WHERE follower_id = ? AND status = 'ACCEPTED'`)
        .all(viewer.id) as { following_id: string }[];
      followingIds = rows.map((r) => r.following_id);
    }

    const conditions: string[] = [`u.status = 'ACTIVE'`];
    const params: any[] = [];

    if (tab === 'reels') {
      conditions.push(`p.is_reel = 1`);
    }

    if (tab === 'saved') {
      if (!viewer) return res.json({ posts: [], hasMore: false });
      conditions.push(`EXISTS (SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = ?)`);
      params.push(viewer.id);
    } else if (tab === 'following') {
      if (!viewer) return res.json({ posts: [], hasMore: false });
      const ids = [...followingIds, viewer.id];
      const placeholders = ids.map(() => '?').join(',');
      conditions.push(`p.author_id IN (${placeholders})`);
      params.push(...ids);
    } else if (authorId) {
      conditions.push(`p.author_id = ?`);
      params.push(authorId);
      if (!viewer || (viewer.id !== authorId && !followingIds.includes(authorId))) {
        conditions.push(`u.is_private = 0`);
      }
    } else if (groupId) {
      conditions.push(`p.group_id = ?`);
      params.push(groupId);
    } else if (pageId) {
      conditions.push(`p.page_id = ?`);
      params.push(pageId);
    } else {
      if (viewer) {
        const ids = [...followingIds, viewer.id];
        const placeholders = ids.map(() => '?').join(',');
        conditions.push(`(u.is_private = 0 OR p.author_id IN (${placeholders}))`);
        params.push(...ids);
      } else {
        conditions.push(`u.is_private = 0`);
      }
    }

    if (hashtag) {
      conditions.push(
        `EXISTS (SELECT 1 FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id = p.id AND h.tag = ?)`
      );
      params.push(hashtag);
    }

    const sql = `
      SELECT p.*
      FROM posts p
      JOIN users u ON u.id = p.author_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(sql).all(...params, limit + 1, offset) as any[];
    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    const posts = rows.map((r) => hydratePost(r, viewer?.id));
    res.json({ posts, hasMore, nextOffset: offset + posts.length });
  });

  api.post('/posts', requireAuth, (req: AuthedRequest, res) => {
    const user = req.user!;
    const content = String(req.body.content || '').trim();
    const mediaUrl = req.body.mediaUrl ? String(req.body.mediaUrl) : null;
    const mediaType = ['IMAGE', 'VIDEO'].includes(req.body.mediaType) ? req.body.mediaType : 'NONE';
    const isReel = req.body.isReel ? 1 : 0;
    const soundTitle = req.body.soundTitle ? String(req.body.soundTitle).trim().slice(0, 120) : null;
    const visibility = req.body.visibility === 'FOLLOWERS' ? 'FOLLOWERS' : 'PUBLIC';
    const groupId = req.body.groupId ? String(req.body.groupId) : null;
    const pageId = req.body.pageId ? String(req.body.pageId) : null;

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'Post cannot be empty.' });
    }

    if (groupId) {
      const mem = db
        .prepare(`SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`)
        .get(groupId, user.id);
      if (!mem) return res.status(403).json({ error: 'Join the group before posting.' });
    }

    if (pageId) {
      const page = db.prepare(`SELECT owner_id FROM pages WHERE id = ?`).get(pageId) as any;
      if (!page || page.owner_id !== user.id) {
        return res.status(403).json({ error: 'Only page owner can post to this page.' });
      }
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO posts (id, author_id, content, media_url, media_type, is_reel, sound_title, visibility, group_id, page_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, user.id, content, mediaUrl, mediaType, isReel, soundTitle, visibility, groupId, pageId);

    const tags = extractHashtags(content);
    for (const tag of tags) {
      db.prepare(`INSERT OR IGNORE INTO hashtags (id, tag) VALUES (?, ?)`).run(randomUUID(), tag);
      const tagRow = db.prepare(`SELECT id FROM hashtags WHERE tag = ?`).get(tag) as { id: string };
      db.prepare(`INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)`).run(id, tagRow.id);
    }

    const mentions = extractMentions(content);
    for (const username of mentions) {
      const mentioned = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username) as { id: string } | undefined;
      if (mentioned) {
        createNotification({
          recipientId: mentioned.id,
          actorId: user.id,
          type: 'MENTION',
          entityId: id,
        });
      }
    }

    const createdRow = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    res.status(201).json({ post: hydratePost(createdRow, user.id) });
  });

  api.delete('/posts/:id', requireAuth, (req: AuthedRequest, res) => {
    const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(req.params.id) as any;
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    let isGroupMod = false;
    if (post.group_id) {
      const gm = db
        .prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`)
        .get(post.group_id, req.user!.id) as any;
      if (gm && ['ADMIN', 'MODERATOR'].includes(gm.role)) isGroupMod = true;
    }

    if (post.author_id !== req.user!.id && req.user!.role !== 'ADMIN' && !isGroupMod) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare(`DELETE FROM posts WHERE id = ?`).run(post.id);
    res.json({ ok: true });
  });

  api.post('/posts/:id/view', (req, res) => {
    db.prepare(`UPDATE posts SET views_count = views_count + 1 WHERE id = ?`).run(req.params.id);
    const row = db.prepare(`SELECT views_count FROM posts WHERE id = ?`).get(req.params.id) as any;
    res.json({ viewsCount: row?.views_count ?? 0 });
  });

  api.post('/posts/:id/like', requireAuth, (req: AuthedRequest, res) => {
    const post = db.prepare(`SELECT id, author_id FROM posts WHERE id = ?`).get(req.params.id) as any;
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const existing = db
      .prepare(`SELECT id FROM likes WHERE user_id = ? AND post_id = ?`)
      .get(req.user!.id, post.id) as any;

    if (existing) {
      db.prepare(`DELETE FROM likes WHERE id = ?`).run(existing.id);
      const count = (db.prepare(`SELECT COUNT(*) as c FROM likes WHERE post_id = ?`).get(post.id) as any).c;
      return res.json({ liked: false, count });
    }

    db.prepare(`INSERT INTO likes (id, user_id, post_id) VALUES (?, ?, ?)`).run(randomUUID(), req.user!.id, post.id);
    createNotification({ recipientId: post.author_id, actorId: req.user!.id, type: 'LIKE', entityId: post.id });
    const count = (db.prepare(`SELECT COUNT(*) as c FROM likes WHERE post_id = ?`).get(post.id) as any).c;
    res.json({ liked: true, count });
  });

  api.post('/posts/:id/bookmark', requireAuth, (req: AuthedRequest, res) => {
    const existing = db
      .prepare(`SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?`)
      .get(req.user!.id, req.params.id) as any;

    if (existing) {
      db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(existing.id);
      return res.json({ bookmarked: false });
    }
    db.prepare(`INSERT INTO bookmarks (id, user_id, post_id) VALUES (?, ?, ?)`).run(
      randomUUID(),
      req.user!.id,
      req.params.id
    );
    res.json({ bookmarked: true });
  });

  api.post('/posts/:id/repost', requireAuth, (req: AuthedRequest, res) => {
    const original = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(req.params.id) as any;
    if (!original) return res.status(404).json({ error: 'Post not found.' });

    const quote = String(req.body.content || '').trim();
    const id = randomUUID();
    const targetId = original.repost_of_id || original.id;

    db.prepare(`INSERT INTO posts (id, author_id, content, repost_of_id) VALUES (?, ?, ?, ?)`).run(
      id,
      req.user!.id,
      quote,
      targetId
    );
    createNotification({ recipientId: original.author_id, actorId: req.user!.id, type: 'REPOST', entityId: id });
    const created = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
    res.status(201).json({ post: hydratePost(created, req.user!.id) });
  });

  api.get('/posts/:id/comments', (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`
      )
      .all(req.params.id) as any[];

    const byId = new Map<string, any>();
    const roots: any[] = [];

    for (const r of rows) {
      const node = {
        id: r.id,
        postId: r.post_id,
        parentId: r.parent_id,
        content: r.content,
        createdAt: r.created_at,
        author: {
          id: r.author_id,
          username: r.username,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          isVerified: Boolean(r.is_verified),
        },
        replies: [],
      };
      byId.set(node.id, node);
    }

    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId).replies.push(node);
      } else {
        roots.push(node);
      }
    }

    res.json({ comments: roots });
  });

  api.post('/posts/:id/comments', requireAuth, (req: AuthedRequest, res) => {
    const post = db.prepare(`SELECT id, author_id FROM posts WHERE id = ?`).get(req.params.id) as any;
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const content = String(req.body.content || '').trim();
    const parentId = req.body.parentId ? String(req.body.parentId) : null;
    if (!content) return res.status(400).json({ error: 'Comment cannot be empty.' });

    const id = randomUUID();
    db.prepare(`INSERT INTO comments (id, post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      post.id,
      req.user!.id,
      parentId,
      content
    );
    createNotification({ recipientId: post.author_id, actorId: req.user!.id, type: 'COMMENT', entityId: post.id });

    res.status(201).json({
      comment: {
        id,
        postId: post.id,
        parentId,
        content,
        createdAt: new Date().toISOString(),
        author: {
          id: req.user!.id,
          username: req.user!.username,
          displayName: req.user!.displayName,
          avatarUrl: req.user!.avatarUrl,
          isVerified: req.user!.isVerified,
        },
        replies: [],
      },
    });
  });

  api.post('/posts/:id/report', requireAuth, (req: AuthedRequest, res) => {
    const reason = String(req.body.reason || 'Inappropriate content').trim().slice(0, 300);
    db.prepare(`INSERT INTO reports (id, reporter_id, post_id, reason) VALUES (?, ?, ?, ?)`).run(
      randomUUID(),
      req.user!.id,
      req.params.id,
      reason
    );
    res.json({ ok: true });
  });

  // ==================== STORIES (24H) ====================
  api.get('/stories', (req: AuthedRequest, res) => {
    const now = new Date().toISOString();
    const rows = db
      .prepare(
        `SELECT s.*, u.username, u.display_name, u.avatar_url, u.is_verified,
          (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count
         FROM stories s
         JOIN users u ON u.id = s.author_id
         WHERE s.expires_at > ? AND u.status = 'ACTIVE'
         ORDER BY s.created_at ASC`
      )
      .all(now) as any[];

    const groupsMap = new Map<string, any>();
    for (const r of rows) {
      const seenByMe = req.user
        ? Boolean(db.prepare(`SELECT 1 FROM story_views WHERE story_id = ? AND viewer_id = ?`).get(r.id, req.user.id))
        : false;

      if (!groupsMap.has(r.author_id)) {
        groupsMap.set(r.author_id, {
          author: {
            id: r.author_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            isVerified: Boolean(r.is_verified),
          },
          items: [],
          hasUnseen: false,
        });
      }
      const g = groupsMap.get(r.author_id);
      if (!seenByMe) g.hasUnseen = true;
      g.items.push({
        id: r.id,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        caption: r.caption,
        viewsCount: r.views_count,
        seenByMe,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      });
    }

    res.json({ storyGroups: Array.from(groupsMap.values()) });
  });

  api.post('/stories', requireAuth, (req: AuthedRequest, res) => {
    const mediaUrl = String(req.body.mediaUrl || '').trim();
    const mediaType = req.body.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE';
    const caption = String(req.body.caption || '').trim().slice(0, 180);
    if (!mediaUrl) return res.status(400).json({ error: 'Story media is required.' });

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`INSERT INTO stories (id, author_id, media_url, media_type, caption, expires_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id,
      req.user!.id,
      mediaUrl,
      mediaType,
      caption,
      expiresAt
    );

    res.status(201).json({ id, expiresAt });
  });

  api.post('/stories/:id/view', requireAuth, (req: AuthedRequest, res) => {
    db.prepare(`INSERT OR IGNORE INTO story_views (story_id, viewer_id) VALUES (?, ?)`).run(
      req.params.id,
      req.user!.id
    );
    res.json({ ok: true });
  });

  api.delete('/stories/:id', requireAuth, (req: AuthedRequest, res) => {
    const story = db.prepare(`SELECT author_id FROM stories WHERE id = ?`).get(req.params.id) as any;
    if (!story) return res.status(404).json({ error: 'Story not found.' });
    if (story.author_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    db.prepare(`DELETE FROM stories WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  });

  // ==================== USERS, FOLLOWS & FRIENDS ====================
  api.get('/users/:username', (req: AuthedRequest, res) => {
    const username = req.params.username.toLowerCase();
    const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
    if (!row) return res.status(404).json({ error: 'User not found.' });

    const stats = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM posts WHERE author_id = ?) as postsCount,
          (SELECT COUNT(*) FROM follows WHERE following_id = ? AND status = 'ACCEPTED') as followersCount,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND status = 'ACCEPTED') as followingCount`
      )
      .get(row.id, row.id, row.id) as any;

    let followStatus: 'NONE' | 'PENDING' | 'ACCEPTED' = 'NONE';
    let friendStatus: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' = 'NONE';
    let subscribedToCreator = false;

    if (req.user && req.user.id !== row.id) {
      const f = db
        .prepare(`SELECT status FROM follows WHERE follower_id = ? AND following_id = ?`)
        .get(req.user.id, row.id) as any;
      if (f) followStatus = f.status;

      const fr = db
        .prepare(
          `SELECT sender_id, receiver_id, status FROM friend_requests
           WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`
        )
        .get(req.user.id, row.id, row.id, req.user.id) as any;
      if (fr) {
        if (fr.status === 'ACCEPTED') friendStatus = 'FRIENDS';
        else if (fr.status === 'PENDING') {
          friendStatus = fr.sender_id === req.user.id ? 'PENDING_SENT' : 'PENDING_RECEIVED';
        }
      }

      subscribedToCreator = Boolean(
        db
          .prepare(`SELECT 1 FROM subscriptions WHERE subscriber_id = ? AND creator_id = ? AND status = 'ACTIVE'`)
          .get(req.user.id, row.id)
      );
    }

    const followers = db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM follows f JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = ? AND f.status = 'ACCEPTED'`
      )
      .all(row.id)
      .map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        isVerified: Boolean(u.is_verified),
      }));

    const following = db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM follows f JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = ? AND f.status = 'ACCEPTED'`
      )
      .all(row.id)
      .map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        isVerified: Boolean(u.is_verified),
      }));

    res.json({
      profile: {
        ...mapUserRow(row),
        isOnline: Boolean(row.is_online),
        counts: stats,
      },
      followStatus,
      friendStatus,
      subscribedToCreator,
      followers,
      following,
    });
  });

  api.post('/users/:username/follow', requireAuth, (req: AuthedRequest, res) => {
    const target = db.prepare(`SELECT * FROM users WHERE username = ?`).get(req.params.username.toLowerCase()) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.id === req.user!.id) return res.status(400).json({ error: 'Cannot follow yourself.' });

    const existing = db
      .prepare(`SELECT id FROM follows WHERE follower_id = ? AND following_id = ?`)
      .get(req.user!.id, target.id) as any;

    if (existing) {
      db.prepare(`DELETE FROM follows WHERE id = ?`).run(existing.id);
      return res.json({ status: 'NONE' });
    }

    const status = target.is_private ? 'PENDING' : 'ACCEPTED';
    db.prepare(`INSERT INTO follows (id, follower_id, following_id, status) VALUES (?, ?, ?, ?)`).run(
      randomUUID(),
      req.user!.id,
      target.id,
      status
    );
    createNotification({
      recipientId: target.id,
      actorId: req.user!.id,
      type: status === 'PENDING' ? 'FOLLOW_REQUEST' : 'FOLLOW',
    });

    res.json({ status });
  });

  api.post('/follow-requests/:followerId', requireAuth, (req: AuthedRequest, res) => {
    const action = req.body.action === 'ACCEPT' ? 'ACCEPT' : 'DECLINE';
    if (action === 'ACCEPT') {
      db.prepare(`UPDATE follows SET status = 'ACCEPTED' WHERE follower_id = ? AND following_id = ?`).run(
        req.params.followerId,
        req.user!.id
      );
      createNotification({
        recipientId: req.params.followerId,
        actorId: req.user!.id,
        type: 'FOLLOW_ACCEPTED',
      });
    } else {
      db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`).run(
        req.params.followerId,
        req.user!.id
      );
    }
    res.json({ ok: true });
  });

  api.get('/friends', requireAuth, (req: AuthedRequest, res) => {
    const uid = req.user!.id;
    const incoming = db
      .prepare(
        `SELECT fr.id, u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified, fr.created_at
         FROM friend_requests fr JOIN users u ON u.id = fr.sender_id
         WHERE fr.receiver_id = ? AND fr.status = 'PENDING'`
      )
      .all(uid);

    const friends = db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_online
         FROM friend_requests fr
         JOIN users u ON u.id = CASE WHEN fr.sender_id = ? THEN fr.receiver_id ELSE fr.sender_id END
         WHERE (fr.sender_id = ? OR fr.receiver_id = ?) AND fr.status = 'ACCEPTED'`
      )
      .all(uid, uid, uid);

    const people = db
      .prepare(
        `SELECT id, username, display_name, avatar_url, bio, is_verified, is_online
         FROM users WHERE id != ? AND status = 'ACTIVE' LIMIT 20`
      )
      .all(uid);

    res.json({ incoming, friends, people });
  });

  api.post('/friends/request', requireAuth, (req: AuthedRequest, res) => {
    const targetId = String(req.body.userId || '');
    if (!targetId || targetId === req.user!.id) return res.status(400).json({ error: 'Invalid user.' });

    const existing = db
      .prepare(
        `SELECT * FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`
      )
      .get(req.user!.id, targetId, targetId, req.user!.id) as any;

    if (existing) {
      db.prepare(`DELETE FROM friend_requests WHERE id = ?`).run(existing.id);
      return res.json({ status: 'NONE' });
    }

    const id = randomUUID();
    db.prepare(`INSERT INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'PENDING')`).run(
      id,
      req.user!.id,
      targetId
    );
    createNotification({ recipientId: targetId, actorId: req.user!.id, type: 'FRIEND_REQUEST', entityId: id });
    res.json({ status: 'PENDING_SENT' });
  });

  api.post('/friends/respond', requireAuth, (req: AuthedRequest, res) => {
    const senderId = String(req.body.senderId || '');
    const accept = Boolean(req.body.accept);

    if (accept) {
      db.prepare(
        `UPDATE friend_requests SET status = 'ACCEPTED' WHERE sender_id = ? AND receiver_id = ?`
      ).run(senderId, req.user!.id);
      createNotification({ recipientId: senderId, actorId: req.user!.id, type: 'FRIEND_ACCEPTED' });
    } else {
      db.prepare(`DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?`).run(senderId, req.user!.id);
    }
    res.json({ ok: true });
  });

  // ==================== GROUPS ====================
  api.get('/groups', (req: AuthedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT g.*,
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as members_count,
          (SELECT COUNT(*) FROM posts p WHERE p.group_id = g.id) as posts_count
         FROM groups g ORDER BY g.created_at DESC`
      )
      .all() as any[];

    const groups = rows.map((g) => {
      let myRole: string | null = null;
      if (req.user) {
        const mem = db
          .prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`)
          .get(g.id, req.user.id) as any;
        myRole = mem?.role ?? null;
      }
      return {
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        coverUrl: g.cover_url,
        isPrivate: Boolean(g.is_private),
        membersCount: g.members_count,
        postsCount: g.posts_count,
        myRole,
      };
    });
    res.json({ groups });
  });

  api.post('/groups', requireAuth, (req: AuthedRequest, res) => {
    const name = String(req.body.name || '').trim();
    const description = String(req.body.description || '').trim();
    const isPrivate = req.body.isPrivate ? 1 : 0;
    const coverUrl = req.body.coverUrl ? String(req.body.coverUrl) : null;
    if (name.length < 3) return res.status(400).json({ error: 'Group name must be at least 3 characters.' });

    const id = randomUUID();
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(0, 6)}`;
    db.prepare(`INSERT INTO groups (id, name, slug, description, cover_url, is_private) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id,
      name,
      slug,
      description,
      coverUrl,
      isPrivate
    );
    db.prepare(`INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'ADMIN')`).run(
      randomUUID(),
      id,
      req.user!.id
    );
    res.status(201).json({ id, slug });
  });

  api.get('/groups/:id', (req: AuthedRequest, res) => {
    const g = db.prepare(`SELECT * FROM groups WHERE id = ?`).get(req.params.id) as any;
    if (!g) return res.status(404).json({ error: 'Group not found.' });

    const members = db
      .prepare(
        `SELECT gm.role, u.id, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ?`
      )
      .all(g.id);

    const myMember = req.user
      ? (db
          .prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`)
          .get(g.id, req.user.id) as any)
      : null;

    res.json({
      group: {
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        coverUrl: g.cover_url,
        isPrivate: Boolean(g.is_private),
        myRole: myMember?.role ?? null,
      },
      members,
    });
  });

  api.post('/groups/:id/join', requireAuth, (req: AuthedRequest, res) => {
    const existing = db
      .prepare(`SELECT id FROM group_members WHERE group_id = ? AND user_id = ?`)
      .get(req.params.id, req.user!.id) as any;
    if (existing) {
      db.prepare(`DELETE FROM group_members WHERE id = ?`).run(existing.id);
      return res.json({ joined: false });
    }
    db.prepare(`INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'MEMBER')`).run(
      randomUUID(),
      req.params.id,
      req.user!.id
    );
    res.json({ joined: true });
  });

  api.patch('/groups/:id/members/:userId', requireAuth, (req: AuthedRequest, res) => {
    const actor = db
      .prepare(`SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`)
      .get(req.params.id, req.user!.id) as any;
    if (!actor || actor.role !== 'ADMIN') return res.status(403).json({ error: 'Group admin required.' });

    const role = ['ADMIN', 'MODERATOR', 'MEMBER'].includes(req.body.role) ? req.body.role : 'MEMBER';
    db.prepare(`UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`).run(
      role,
      req.params.id,
      req.params.userId
    );
    res.json({ ok: true });
  });

  // ==================== PAGES ====================
  api.get('/pages', (req: AuthedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM page_follows pf WHERE pf.page_id = p.id) as followers_count
         FROM pages p ORDER BY p.created_at DESC`
      )
      .all() as any[];

    const pages = rows.map((p) => ({
      id: p.id,
      ownerId: p.owner_id,
      name: p.name,
      handle: p.handle,
      category: p.category,
      description: p.description,
      avatarUrl: p.avatar_url,
      coverUrl: p.cover_url,
      isVerified: Boolean(p.is_verified),
      followersCount: p.followers_count,
      followedByMe: req.user
        ? Boolean(db.prepare(`SELECT 1 FROM page_follows WHERE page_id = ? AND user_id = ?`).get(p.id, req.user.id))
        : false,
    }));
    res.json({ pages });
  });

  api.post('/pages', requireAuth, (req: AuthedRequest, res) => {
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || 'Creator').trim();
    const description = String(req.body.description || '').trim();
    const avatarUrl = req.body.avatarUrl ? String(req.body.avatarUrl) : null;
    if (name.length < 2) return res.status(400).json({ error: 'Page name required.' });

    const id = randomUUID();
    const handle = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${id.slice(0, 4)}`;
    db.prepare(
      `INSERT INTO pages (id, owner_id, name, handle, category, description, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, name, handle, category, description, avatarUrl);

    res.status(201).json({ id, handle });
  });

  api.post('/pages/:id/follow', requireAuth, (req: AuthedRequest, res) => {
    const existing = db
      .prepare(`SELECT 1 FROM page_follows WHERE page_id = ? AND user_id = ?`)
      .get(req.params.id, req.user!.id);
    if (existing) {
      db.prepare(`DELETE FROM page_follows WHERE page_id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
      return res.json({ followed: false });
    }
    db.prepare(`INSERT INTO page_follows (page_id, user_id) VALUES (?, ?)`).run(req.params.id, req.user!.id);
    res.json({ followed: true });
  });

  // ==================== EVENTS ====================
  api.get('/events', (req: AuthedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT e.*, u.username as creator_username, u.display_name as creator_name,
          (SELECT COUNT(*) FROM event_rsvps er WHERE er.event_id = e.id AND er.status = 'GOING') as going_count,
          (SELECT COUNT(*) FROM event_rsvps er WHERE er.event_id = e.id AND er.status = 'INTERESTED') as interested_count
         FROM events e JOIN users u ON u.id = e.creator_id
         ORDER BY e.starts_at ASC`
      )
      .all() as any[];

    const events = rows.map((e) => {
      const rsvp = req.user
        ? (db
            .prepare(`SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?`)
            .get(e.id, req.user.id) as any)
        : null;
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startsAt: e.starts_at,
        coverUrl: e.cover_url,
        creatorName: e.creator_name,
        creatorUsername: e.creator_username,
        goingCount: e.going_count,
        interestedCount: e.interested_count,
        myRsvp: rsvp?.status ?? null,
      };
    });
    res.json({ events });
  });

  api.post('/events', requireAuth, (req: AuthedRequest, res) => {
    const title = String(req.body.title || '').trim();
    const location = String(req.body.location || '').trim();
    const startsAt = String(req.body.startsAt || '').trim();
    const description = String(req.body.description || '').trim();
    const coverUrl = req.body.coverUrl ? String(req.body.coverUrl) : null;
    if (!title || !location || !startsAt) {
      return res.status(400).json({ error: 'Title, location, and date/time are required.' });
    }
    const id = randomUUID();
    db.prepare(
      `INSERT INTO events (id, creator_id, title, description, location, starts_at, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, title, description, location, startsAt, coverUrl);
    db.prepare(`INSERT INTO event_rsvps (event_id, user_id, status) VALUES (?, ?, 'GOING')`).run(id, req.user!.id);
    res.status(201).json({ id });
  });

  api.post('/events/:id/rsvp', requireAuth, (req: AuthedRequest, res) => {
    const status = req.body.status;
    if (!['GOING', 'INTERESTED', 'NONE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status.' });
    }
    if (status === 'NONE') {
      db.prepare(`DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?`).run(req.params.id, req.user!.id);
    } else {
      db.prepare(
        `INSERT INTO event_rsvps (event_id, user_id, status) VALUES (?, ?, ?)
         ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`
      ).run(req.params.id, req.user!.id, status);
    }
    res.json({ status });
  });

  // ==================== MARKETPLACE ====================
  api.get('/marketplace', (req, res) => {
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();

    const conditions = ['1=1'];
    const params: any[] = [];
    if (q) {
      conditions.push(`(m.title LIKE ? OR m.description LIKE ? OR m.location LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category && category !== 'All') {
      conditions.push(`m.category = ?`);
      params.push(category);
    }

    const listings = db
      .prepare(
        `SELECT m.*, u.username as seller_username, u.display_name as seller_name, u.avatar_url as seller_avatar, u.is_verified as seller_verified
         FROM marketplace_listings m JOIN users u ON u.id = m.seller_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY m.created_at DESC`
      )
      .all(...params);

    res.json({ listings });
  });

  api.post('/marketplace', requireAuth, (req: AuthedRequest, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const priceCents = Math.max(0, Math.round(Number(req.body.priceDollars || 0) * 100));
    const category = String(req.body.category || 'General').trim();
    const location = String(req.body.location || 'Local Pickup').trim();
    const imageUrl = req.body.imageUrl ? String(req.body.imageUrl) : null;

    if (!title) return res.status(400).json({ error: 'Listing title is required.' });
    const id = randomUUID();
    db.prepare(
      `INSERT INTO marketplace_listings (id, seller_id, title, description, price_cents, category, location, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, title, description, priceCents, category, location, imageUrl);

    res.status(201).json({ id });
  });

  api.patch('/marketplace/:id', requireAuth, (req: AuthedRequest, res) => {
    const item = db.prepare(`SELECT seller_id FROM marketplace_listings WHERE id = ?`).get(req.params.id) as any;
    if (!item) return res.status(404).json({ error: 'Listing not found.' });
    if (item.seller_id !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const status = req.body.status === 'SOLD' ? 'SOLD' : 'AVAILABLE';
    db.prepare(`UPDATE marketplace_listings SET status = ? WHERE id = ?`).run(status, req.params.id);
    res.json({ status });
  });

  // ==================== MESSAGING ====================
  api.get('/conversations', requireAuth, (req: AuthedRequest, res) => {
    const uid = req.user!.id;
    const convs = db
      .prepare(
        `SELECT c.* FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
         WHERE cp.user_id = ?
         ORDER BY c.updated_at DESC`
      )
      .all(uid) as any[];

    const hydrated = convs.map((c) => {
      const participants = db
        .prepare(
          `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified, u.is_online, cp.last_read_at
           FROM conversation_participants cp JOIN users u ON u.id = cp.user_id
           WHERE cp.conversation_id = ?`
        )
        .all(c.id) as any[];

      const lastMessage = db
        .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`)
        .get(c.id) as any;

      const myPart = participants.find((p) => p.id === uid);
      const unreadCount = myPart
        ? (
            db
              .prepare(
                `SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ?`
              )
              .get(c.id, uid, myPart.last_read_at) as any
          ).cnt
        : 0;

      return {
        id: c.id,
        title: c.title,
        isGroup: Boolean(c.is_group),
        updatedAt: c.updated_at,
        unreadCount,
        participants: participants.map((p) => ({
          id: p.id,
          username: p.username,
          displayName: p.display_name,
          avatarUrl: p.avatar_url,
          isVerified: Boolean(p.is_verified),
          isOnline: Boolean(p.is_online),
          lastReadAt: p.last_read_at,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              senderId: lastMessage.sender_id,
              content: lastMessage.content,
              mediaType: lastMessage.media_type,
              createdAt: lastMessage.created_at,
            }
          : null,
      };
    });

    res.json({ conversations: hydrated });
  });

  api.post('/conversations', requireAuth, (req: AuthedRequest, res) => {
    const uid = req.user!.id;
    const participantIds: string[] = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
    const title = req.body.title ? String(req.body.title).trim() : null;
    const uniqueOthers = [...new Set(participantIds.filter((id) => id && id !== uid))];
    if (uniqueOthers.length === 0) {
      return res.status(400).json({ error: 'Select at least one recipient.' });
    }

    const isGroup = uniqueOthers.length > 1 || Boolean(title);

    // For 1-on-1 DMs, reuse existing conversation if present
    if (!isGroup) {
      const otherId = uniqueOthers[0];
      const existing = db
        .prepare(
          `SELECT c.id FROM conversations c
           JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
           JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
           WHERE c.is_group = 0 LIMIT 1`
        )
        .get(uid, otherId) as any;
      if (existing) {
        return res.json({ conversationId: existing.id });
      }
    }

    const convId = randomUUID();
    db.prepare(`INSERT INTO conversations (id, title, is_group) VALUES (?, ?, ?)`).run(convId, title, isGroup ? 1 : 0);
    const addPart = db.prepare(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)`);
    addPart.run(convId, uid);
    for (const pId of uniqueOthers) {
      addPart.run(convId, pId);
    }

    res.status(201).json({ conversationId: convId });
  });

  api.get('/conversations/:id/messages', requireAuth, (req: AuthedRequest, res) => {
    const member = db
      .prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
      .get(req.params.id, req.user!.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const messages = db
      .prepare(
        `SELECT m.*, u.username, u.display_name, u.avatar_url
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ?
         ORDER BY m.created_at ASC`
      )
      .all(req.params.id)
      .map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        content: m.content,
        mediaUrl: m.media_url,
        mediaType: m.media_type,
        createdAt: m.created_at,
        sender: {
          id: m.sender_id,
          username: m.username,
          displayName: m.display_name,
          avatarUrl: m.avatar_url,
        },
      }));

    const participants = db
      .prepare(`SELECT user_id, last_read_at FROM conversation_participants WHERE conversation_id = ?`)
      .all(req.params.id);

    res.json({ messages, participants });
  });

  api.post('/conversations/:id/messages', requireAuth, (req: AuthedRequest, res) => {
    const member = db
      .prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
      .get(req.params.id, req.user!.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const content = String(req.body.content || '').trim();
    const mediaUrl = req.body.mediaUrl ? String(req.body.mediaUrl) : null;
    const mediaType = ['IMAGE', 'VIDEO', 'AUDIO'].includes(req.body.mediaType) ? req.body.mediaType : null;
    if (!content && !mediaUrl) return res.status(400).json({ error: 'Message cannot be empty.' });

    const msgId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO messages (id, conversation_id, sender_id, content, media_url, media_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(msgId, req.params.id, req.user!.id, content, mediaUrl, mediaType, now);

    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, req.params.id);
    db.prepare(`UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).run(
      now,
      req.params.id,
      req.user!.id
    );

    const payload = {
      id: msgId,
      conversationId: req.params.id,
      senderId: req.user!.id,
      content,
      mediaUrl,
      mediaType,
      createdAt: now,
      sender: {
        id: req.user!.id,
        username: req.user!.username,
        displayName: req.user!.displayName,
        avatarUrl: req.user!.avatarUrl,
      },
    };

    const recipients = db
      .prepare(`SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?`)
      .all(req.params.id, req.user!.id) as { user_id: string }[];

    for (const r of recipients) {
      sendToUser(r.user_id, 'message:new', payload);
      createNotification({
        recipientId: r.user_id,
        actorId: req.user!.id,
        type: 'MESSAGE',
        entityId: req.params.id,
      });
    }

    res.status(201).json({ message: payload });
  });

  api.post('/conversations/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const now = new Date().toISOString();
    db.prepare(`UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).run(
      now,
      req.params.id,
      req.user!.id
    );

    const others = db
      .prepare(`SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?`)
      .all(req.params.id, req.user!.id) as { user_id: string }[];
    for (const o of others) {
      sendToUser(o.user_id, 'message:read_ack', {
        conversationId: req.params.id,
        userId: req.user!.id,
        lastReadAt: now,
      });
    }
    res.json({ ok: true });
  });

  // ==================== NOTIFICATIONS ====================
  api.get('/notifications', requireAuth, (req: AuthedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT n.*, u.username, u.display_name, u.avatar_url, u.is_verified
         FROM notifications n JOIN users u ON u.id = n.actor_id
         WHERE n.recipient_id = ?
         ORDER BY n.created_at DESC LIMIT 50`
      )
      .all(req.user!.id) as any[];

    const notifications = rows.map((n) => ({
      id: n.id,
      type: n.type,
      entityId: n.entity_id,
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
      actor: {
        id: n.actor_id,
        username: n.username,
        displayName: n.display_name,
        avatarUrl: n.avatar_url,
        isVerified: Boolean(n.is_verified),
      },
    }));

    const unreadCount = notifications.filter((n) => !n.isRead).length;
    res.json({ notifications, unreadCount });
  });

  api.post('/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_id = ?`).run(req.user!.id);
    res.json({ ok: true });
  });

  // ==================== EXPLORE & SEARCH ====================
  api.get('/explore', (req: AuthedRequest, res) => {
    const q = String(req.query.q || '').trim();
    const viewer = req.user;

    const users = db
      .prepare(
        `SELECT id, username, display_name, avatar_url, bio, is_verified, is_online
         FROM users
         WHERE status = 'ACTIVE'
         ${q ? `AND (username LIKE ? OR display_name LIKE ?)` : ''}
         ${viewer ? `AND id != ?` : ''}
         ORDER BY is_verified DESC, created_at DESC LIMIT 12`
      )
      .all(
        ...(q ? [`%${q.toLowerCase()}%`, `%${q}%`] : []),
        ...(viewer ? [viewer.id] : [])
      )
      .map((u: any) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        bio: u.bio,
        isVerified: Boolean(u.is_verified),
        isOnline: Boolean(u.is_online),
      }));

    const hashtags = db
      .prepare(
        `SELECT h.id, h.tag, COUNT(ph.post_id) as posts_count
         FROM hashtags h
         LEFT JOIN post_hashtags ph ON ph.hashtag_id = h.id
         ${q ? `WHERE h.tag LIKE ?` : ''}
         GROUP BY h.id
         ORDER BY posts_count DESC LIMIT 10`
      )
      .all(...(q ? [`%${q.replace('#', '').toLowerCase()}%`] : []));

    const postRows = db
      .prepare(
        `SELECT p.* FROM posts p JOIN users u ON u.id = p.author_id
         WHERE u.status = 'ACTIVE' AND u.is_private = 0
         ${q ? `AND p.content LIKE ?` : ''}
         ORDER BY p.views_count DESC, p.created_at DESC LIMIT 15`
      )
      .all(...(q ? [`%${q}%`] : [])) as any[];

    const posts = postRows.map((r) => hydratePost(r, viewer?.id));

    res.json({ users, hashtags, posts });
  });

  // ==================== MONETIZATION, ADS & CREATOR STUDIO ====================
  api.get('/creator/analytics', requireAuth, (req: AuthedRequest, res) => {
    const uid = req.user!.id;
    const totals = db
      .prepare(
        `SELECT
          COUNT(*) as totalPosts,
          COALESCE(SUM(views_count), 0) as totalViews
         FROM posts WHERE author_id = ?`
      )
      .get(uid) as any;

    const likesReceived = (
      db.prepare(`SELECT COUNT(*) as c FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = ?`).get(uid) as any
    ).c;
    const commentsReceived = (
      db.prepare(`SELECT COUNT(*) as c FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.author_id = ?`).get(uid) as any
    ).c;
    const followersCount = (
      db.prepare(`SELECT COUNT(*) as c FROM follows WHERE following_id = ? AND status = 'ACCEPTED'`).get(uid) as any
    ).c;
    const activeSubscribers = (
      db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(price_cents), 0) as rev FROM subscriptions WHERE creator_id = ? AND status = 'ACTIVE'`).get(uid) as any
    );

    const topPosts = (
      db.prepare(`SELECT * FROM posts WHERE author_id = ? ORDER BY views_count DESC LIMIT 5`).all(uid) as any[]
    ).map((r) => hydratePost(r, uid));

    res.json({
      totals: {
        totalPosts: totals.totalPosts,
        totalViews: totals.totalViews,
        likesReceived,
        commentsReceived,
        followersCount,
        paidSubscribers: activeSubscribers.c,
        monthlyRevenueCents: activeSubscribers.rev,
      },
      topPosts,
    });
  });

  api.get('/subscriptions', requireAuth, (req: AuthedRequest, res) => {
    const mine = db
      .prepare(
        `SELECT s.*, u.username as creator_username, u.display_name as creator_name
         FROM subscriptions s LEFT JOIN users u ON u.id = s.creator_id
         WHERE s.subscriber_id = ? AND s.status = 'ACTIVE'`
      )
      .all(req.user!.id);

    const creators = db
      .prepare(
        `SELECT id, username, display_name, avatar_url, bio, is_verified, creator_tier_price_cents
         FROM users WHERE status = 'ACTIVE' AND id != ? LIMIT 12`
      )
      .all(req.user!.id);

    res.json({ subscriptions: mine, creators });
  });

  api.post('/subscriptions', requireAuth, (req: AuthedRequest, res) => {
    const creatorId = req.body.creatorId ? String(req.body.creatorId) : null;
    const tierName = creatorId ? 'Creator Membership' : 'Orbis+ Pro';
    let priceCents = 999;

    if (creatorId) {
      const creator = db.prepare(`SELECT creator_tier_price_cents FROM users WHERE id = ?`).get(creatorId) as any;
      if (!creator) return res.status(404).json({ error: 'Creator not found.' });
      priceCents = creator.creator_tier_price_cents;
    }

    const existing = db
      .prepare(
        `SELECT id FROM subscriptions WHERE subscriber_id = ? AND ${
          creatorId ? 'creator_id = ?' : 'creator_id IS NULL'
        } AND status = 'ACTIVE'`
      )
      .get(...(creatorId ? [req.user!.id, creatorId] : [req.user!.id])) as any;

    if (existing) {
      db.prepare(`UPDATE subscriptions SET status = 'CANCELED' WHERE id = ?`).run(existing.id);
      return res.json({ subscribed: false });
    }

    db.prepare(
      `INSERT INTO subscriptions (id, subscriber_id, creator_id, tier_name, price_cents, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`
    ).run(randomUUID(), req.user!.id, creatorId, tierName, priceCents);

    if (!creatorId) {
      db.prepare(`UPDATE users SET is_verified = 1 WHERE id = ?`).run(req.user!.id);
    }

    res.status(201).json({ subscribed: true });
  });

  api.get('/ads', (req: AuthedRequest, res) => {
    const scope = String(req.query.scope || 'feed');
    if (scope === 'mine' && req.user) {
      const mine = db.prepare(`SELECT * FROM ad_campaigns WHERE advertiser_id = ? ORDER BY created_at DESC`).all(req.user.id);
      return res.json({ ads: mine });
    }
    const active = db.prepare(`SELECT * FROM ad_campaigns WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 3`).all() as any[];
    for (const ad of active) {
      db.prepare(`UPDATE ad_campaigns SET impressions = impressions + 1 WHERE id = ?`).run(ad.id);
    }
    res.json({ ads: active });
  });

  api.post('/ads', requireAuth, (req: AuthedRequest, res) => {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    const targetUrl = String(req.body.targetUrl || 'https://orbis.social').trim();
    const imageUrl = req.body.imageUrl ? String(req.body.imageUrl) : null;
    const budgetCents = Math.max(500, Math.round(Number(req.body.budgetDollars || 25) * 100));

    if (!title || !body) return res.status(400).json({ error: 'Ad title and copy are required.' });
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ error: 'Target URL must start with http:// or https://' });
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO ad_campaigns (id, advertiser_id, title, body, image_url, target_url, budget_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, title, body, imageUrl, targetUrl, budgetCents);

    res.status(201).json({ id });
  });

  api.post('/ads/:id/click', (req, res) => {
    db.prepare(`UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  });

  // ==================== ADMIN DASHBOARD ====================
  api.get('/admin/overview', requireAuth, requireAdmin, (_req, res) => {
    const stats = {
      totalUsers: (db.prepare(`SELECT COUNT(*) as c FROM users`).get() as any).c,
      totalPosts: (db.prepare(`SELECT COUNT(*) as c FROM posts`).get() as any).c,
      openReports: (db.prepare(`SELECT COUNT(*) as c FROM reports WHERE status = 'OPEN'`).get() as any).c,
      activeAds: (db.prepare(`SELECT COUNT(*) as c FROM ad_campaigns WHERE status = 'ACTIVE'`).get() as any).c,
      activeSubscriptions: (db.prepare(`SELECT COUNT(*) as c FROM subscriptions WHERE status = 'ACTIVE'`).get() as any).c,
      mrrCents: (
        db.prepare(`SELECT COALESCE(SUM(price_cents), 0) as s FROM subscriptions WHERE status = 'ACTIVE'`).get() as any
      ).s,
    };

    const users = db
      .prepare(`SELECT id, email, username, display_name, role, status, is_verified, created_at FROM users ORDER BY created_at DESC`)
      .all();

    const reports = db
      .prepare(
        `SELECT r.*, u.username as reporter_username, p.content as post_content, p.author_id as post_author_id
         FROM reports r
         JOIN users u ON u.id = r.reporter_id
         LEFT JOIN posts p ON p.id = r.post_id
         ORDER BY r.created_at DESC`
      )
      .all();

    const ads = db
      .prepare(
        `SELECT a.*, u.username as advertiser_username FROM ad_campaigns a JOIN users u ON u.id = a.advertiser_id ORDER BY a.created_at DESC`
      )
      .all();

    const subscriptions = db
      .prepare(
        `SELECT s.*, su.username as subscriber_username, cu.username as creator_username
         FROM subscriptions s
         JOIN users su ON su.id = s.subscriber_id
         LEFT JOIN users cu ON cu.id = s.creator_id
         ORDER BY s.created_at DESC`
      )
      .all();

    res.json({ stats, users, reports, ads, subscriptions });
  });

  api.patch('/admin/users/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const targetId = req.params.id;
    const status = ['ACTIVE', 'SUSPENDED', 'BANNED'].includes(req.body.status) ? req.body.status : undefined;
    const role = ['USER', 'CREATOR', 'ADMIN'].includes(req.body.role) ? req.body.role : undefined;
    const isVerified = req.body.isVerified !== undefined ? (req.body.isVerified ? 1 : 0) : undefined;

    if (status) db.prepare(`UPDATE users SET status = ? WHERE id = ?`).run(status, targetId);
    if (role) db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, targetId);
    if (isVerified !== undefined) db.prepare(`UPDATE users SET is_verified = ? WHERE id = ?`).run(isVerified, targetId);

    res.json({ ok: true });
  });

  api.patch('/admin/reports/:id', requireAuth, requireAdmin, (req, res) => {
    const action = req.body.action; // REMOVE_POST | DISMISS
    const report = db.prepare(`SELECT * FROM reports WHERE id = ?`).get(req.params.id) as any;
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    if (action === 'REMOVE_POST' && report.post_id) {
      db.prepare(`DELETE FROM posts WHERE id = ?`).run(report.post_id);
      db.prepare(`UPDATE reports SET status = 'RESOLVED' WHERE id = ?`).run(report.id);
    } else {
      db.prepare(`UPDATE reports SET status = 'DISMISSED' WHERE id = ?`).run(report.id);
    }
    res.json({ ok: true });
  });

  api.patch('/admin/ads/:id', requireAuth, requireAdmin, (req, res) => {
    const status = ['ACTIVE', 'PAUSED'].includes(req.body.status) ? req.body.status : 'PAUSED';
    db.prepare(`UPDATE ad_campaigns SET status = ? WHERE id = ?`).run(status, req.params.id);
    res.json({ ok: true });
  });

  app.use('/api', api);
}
