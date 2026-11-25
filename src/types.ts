export interface User {
  id: string;
  email?: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  website: string;
  isVerified: boolean;
  isPrivate: boolean;
  role: string;
  status: string;
  isOnline?: boolean;
  creatorTierPriceCents: number;
  createdAt?: string;
}

export interface PostAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  isOnline?: boolean;
  creatorTierPriceCents?: number;
  followingByMe?: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'NONE';
  isReel: boolean;
  soundTitle: string | null;
  visibility: 'PUBLIC' | 'FOLLOWERS';
  viewsCount: number;
  repostOfId: string | null;
  groupId: string | null;
  pageId: string | null;
  createdAt: string;
  author: PostAuthor | null;
  group?: { id: string; name: string; slug: string } | null;
  page?: { id: string; name: string; handle: string } | null;
  repostOf?: Post | null;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  counts: {
    likes: number;
    comments: number;
    reposts: number;
    bookmarks: number;
  };
}

export interface CommentNode {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  replies: CommentNode[];
}

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string;
  viewsCount: number;
  seenByMe: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface StoryGroup {
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  items: StoryItem[];
  hasUnseen: boolean;
}

export interface AdCampaign {
  id: string;
  advertiser_id: string;
  title: string;
  body: string;
  image_url: string | null;
  target_url: string;
  budget_cents: number;
  impressions: number;
  clicks: number;
  status: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
}

export interface Conversation {
  id: string;
  title: string | null;
  isGroup: boolean;
  updatedAt: string;
  unreadCount: number;
  participants: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
    isOnline: boolean;
    lastReadAt: string;
  }[];
  lastMessage: {
    id: string;
    senderId: string;
    content: string;
    mediaType: string | null;
    createdAt: string;
  } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | null;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
