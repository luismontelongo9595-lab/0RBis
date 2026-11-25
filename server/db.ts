import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

const dbPath = path.resolve(process.cwd(), process.env.ORBIS_DB_PATH || 'orbis.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      cover_url TEXT,
      website TEXT DEFAULT '',
      is_verified INTEGER NOT NULL DEFAULT 0,
      is_private INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'USER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_online INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      creator_tier_price_cents INTEGER NOT NULL DEFAULT 499,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACCEPTED',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(follower_id, following_id),
      FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sender_id, receiver_id),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT,
      is_private INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      handle TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      cover_url TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS page_follows (
      page_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (page_id, user_id),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      media_url TEXT,
      media_type TEXT NOT NULL DEFAULT 'NONE',
      is_reel INTEGER NOT NULL DEFAULT 0,
      sound_title TEXT,
      visibility TEXT NOT NULL DEFAULT 'PUBLIC',
      views_count INTEGER NOT NULL DEFAULT 0,
      repost_of_id TEXT,
      group_id TEXT,
      page_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (repost_of_id) REFERENCES posts(id) ON DELETE SET NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hashtags (
      id TEXT PRIMARY KEY,
      tag TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_hashtags (
      post_id TEXT NOT NULL,
      hashtag_id TEXT NOT NULL,
      PRIMARY KEY (post_id, hashtag_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      parent_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      media_url TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'IMAGE',
      caption TEXT DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (story_id, viewer_id),
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      group_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      cover_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS event_rsvps (
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS marketplace_listings (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      is_group INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      media_url TEXT,
      media_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      type TEXT NOT NULL,
      entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL,
      creator_id TEXT,
      tier_name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id TEXT PRIMARY KEY,
      advertiser_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image_url TEXT,
      target_url TEXT NOT NULL,
      budget_cents INTEGER NOT NULL,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (advertiser_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      post_id TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifs_recip ON notifications(recipient_id, created_at DESC);
  `);

  seedInitialCommunity();
}

function seedInitialCommunity() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, username, display_name, password_hash, bio, avatar_url, cover_url, website, is_verified, is_private, role, creator_tier_price_cents)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0, ?, ?)
  `);

  const elenaId = 'creator-elena';
  const marcusId = 'creator-marcus';
  const kenjiId = 'creator-kenji';

  insertUser.run(
    elenaId,
    'elena@orbis.community',
    'elena_vance',
    'Elena Vance',
    'Coastal architecture, timber joinery, and quiet Pacific light. Sharing field notes & pavilion studies.',
    '/src/assets/images/orbis_feed_architecture_1795599985667.jpg',
    '/src/assets/images/orbis_feed_architecture_1795599985667.jpg',
    'https://orbis.social',
    1,
    'CREATOR',
    699
  );

  insertUser.run(
    marcusId,
    'marcus@orbis.community',
    'marcus_stoneware',
    'Marcus Thorne',
    'Wood-fired stoneware & studio craft. Building calm everyday objects from local clay.',
    '/src/assets/images/orbis_feed_studio_1795599985633.jpg',
    '/src/assets/images/orbis_feed_studio_1795599985633.jpg',
    '',
    1,
    'CREATOR',
    499
  );

  insertUser.run(
    kenjiId,
    'kenji@orbis.community',
    'kenji_frames',
    'Kenji Sato',
    '35mm night walks, street cinema & ambient soundscapes across East Asia.',
    '/src/assets/images/orbis_story_nightmarket_1795599986811.jpg',
    '/src/assets/images/orbis_event_summit_1795599986821.jpg',
    '',
    1,
    'CREATOR',
    599
  );

  // Seed Groups
  const groupArchId = 'group-coastal-arch';
  const groupFilmId = 'group-analog-club';
  db.prepare(`INSERT INTO groups (id, name, slug, description, cover_url, is_private) VALUES (?, ?, ?, ?, ?, ?)`).run(
    groupArchId,
    'Timber & Coastal Architecture',
    'timber-coastal-architecture',
    'Architects, builders, and admirers sharing passive solar timber homes, structural sketches, and site studies.',
    '/src/assets/images/orbis_feed_architecture_1795599985667.jpg',
    0
  );
  db.prepare(`INSERT INTO groups (id, name, slug, description, cover_url, is_private) VALUES (?, ?, ?, ?, ?, ?)`).run(
    groupFilmId,
    'Analog 35mm Film Collective',
    'analog-35mm-collective',
    'Rangefinders, night street photography, darkroom recipes, and critique.',
    '/src/assets/images/orbis_market_camera_1795599986591.jpg',
    0
  );

  db.prepare(`INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)`).run(randomUUID(), groupArchId, elenaId, 'ADMIN');
  db.prepare(`INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)`).run(randomUUID(), groupFilmId, kenjiId, 'ADMIN');

  // Seed Business/Creator Page
  db.prepare(`INSERT INTO pages (id, owner_id, name, handle, category, description, avatar_url, cover_url, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`).run(
    'page-vance-atelier',
    elenaId,
    'Vance Architectural Studio',
    'vance_atelier',
    'Architecture & Design',
    'Boutique residential studio specializing in low-impact coastal timber structures.',
    '/src/assets/images/orbis_feed_architecture_1795599985667.jpg',
    '/src/assets/images/orbis_event_summit_1795599986821.jpg'
  );

  // Seed Posts & Reels
  const post1 = 'post-seed-arch';
  const post2 = 'post-seed-studio';
  const reel1 = 'post-seed-reel';

  const insertPost = db.prepare(`
    INSERT INTO posts (id, author_id, content, media_url, media_type, is_reel, sound_title, visibility, views_count, group_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLIC', ?, ?, ?)
  `);

  insertPost.run(
    post1,
    elenaId,
    'Morning mist clearing over the Pacific Ridge pavilion. Deep cedar overhangs keep the interior cool all afternoon without mechanical shading. #architecture #coastaldesign #timber',
    '/src/assets/images/orbis_feed_architecture_1795599985667.jpg',
    'IMAGE',
    0,
    null,
    420,
    groupArchId,
    new Date(Date.now() - 1000 * 60 * 90).toISOString()
  );

  insertPost.run(
    post2,
    marcusId,
    'Just unloaded the reduction kiln — 24 speckled iron-glaze mugs ready for the weekend studio open house. #ceramics #stoneware #craft',
    '/src/assets/images/orbis_feed_studio_1795599985633.jpg',
    'IMAGE',
    0,
    null,
    315,
    null,
    new Date(Date.now() - 1000 * 60 * 45).toISOString()
  );

  insertPost.run(
    reel1,
    kenjiId,
    'Rainy midnight lantern walk through the street food alley. Shot handheld on 35mm f/1.4. #streetphotography #nightmarket #cinema',
    '/src/assets/images/orbis_story_nightmarket_1795599986811.jpg',
    'IMAGE',
    1,
    'Kenji Sato · Midnight Lantern Echoes (Original Audio)',
    1840,
    groupFilmId,
    new Date(Date.now() - 1000 * 60 * 15).toISOString()
  );

  // Seed hashtags
  const tags = ['architecture', 'coastaldesign', 'timber', 'ceramics', 'stoneware', 'craft', 'streetphotography', 'nightmarket', 'cinema'];
  const insertTag = db.prepare(`INSERT OR IGNORE INTO hashtags (id, tag) VALUES (?, ?)`);
  const getTag = db.prepare(`SELECT id FROM hashtags WHERE tag = ?`);
  const linkTag = db.prepare(`INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)`);

  for (const tag of tags) {
    insertTag.run(randomUUID(), tag);
  }
  const tagMap: Record<string, string[]> = {
    [post1]: ['architecture', 'coastaldesign', 'timber'],
    [post2]: ['ceramics', 'stoneware', 'craft'],
    [reel1]: ['streetphotography', 'nightmarket', 'cinema'],
  };
  for (const [pId, list] of Object.entries(tagMap)) {
    for (const t of list) {
      const row = getTag.get(t) as { id: string } | undefined;
      if (row) linkTag.run(pId, row.id);
    }
  }

  // Seed 24h Stories
  const expires24h = new Date(Date.now() + 1000 * 60 * 60 * 23).toISOString();
  db.prepare(`INSERT INTO stories (id, author_id, media_url, media_type, caption, expires_at) VALUES (?, ?, ?, 'IMAGE', ?, ?)`).run(
    'story-seed-1',
    kenjiId,
    '/src/assets/images/orbis_story_nightmarket_1795599986811.jpg',
    'Midnight noodle stalls glowing after the rain',
    expires24h
  );
  db.prepare(`INSERT INTO stories (id, author_id, media_url, media_type, caption, expires_at) VALUES (?, ?, ?, 'IMAGE', ?, ?)`).run(
    'story-seed-2',
    elenaId,
    '/src/assets/images/orbis_feed_architecture_1795599985667.jpg',
    'Golden hour site walkthrough',
    expires24h
  );

  // Seed Event
  db.prepare(`INSERT INTO events (id, creator_id, group_id, title, description, location, starts_at, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'event-seed-summit',
    elenaId,
    groupArchId,
    'Pacific Makers & Architects Atrium Gathering',
    'Evening showcase of coastal timber models, ceramic tableware installations, and 35mm short films.',
    'Pier 27 Timber Atrium, San Francisco',
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    '/src/assets/images/orbis_event_summit_1795599986821.jpg'
  );

  // Seed Marketplace Listing
  db.prepare(`INSERT INTO marketplace_listings (id, seller_id, title, description, price_cents, category, location, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'market-seed-camera',
    kenjiId,
    'Classic 35mm Silver Rangefinder + 50mm f/2 Lens',
    'Clean mechanical shutter, accurate rangefinder patch, freshly CLA-serviced with leather strap.',
    145000,
    'Cameras & Gear',
    'Seattle, WA',
    '/src/assets/images/orbis_market_camera_1795599986591.jpg'
  );

  // Seed Ad Campaign
  db.prepare(`INSERT INTO ad_campaigns (id, advertiser_id, title, body, image_url, target_url, budget_cents, impressions, clicks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`).run(
    'ad-seed-summit',
    elenaId,
    'Vance Atelier Open Studio & Exhibition',
    'Reserve complimentary tickets for our seasonal architectural model gallery and material library tour.',
    '/src/assets/images/orbis_event_summit_1795599986821.jpg',
    'https://orbis.social',
    25000,
    128,
    14
  );
}
