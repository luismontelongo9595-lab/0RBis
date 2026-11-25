import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';

// Read JWT_SECRET from env or generate an ephemeral secure key in-memory
const RAW_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
  ? process.env.JWT_SECRET.trim()
  : randomBytes(32).toString('hex');

const SECRET_KEY = new TextEncoder().encode(RAW_SECRET);
export const SESSION_COOKIE = 'orbis_session';

export interface AuthUser {
  id: string;
  email: string;
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
  creatorTierPriceCents: number;
  createdAt: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function extractTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return parseCookieHeader(req.headers.cookie, SESSION_COOKIE);
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  });
}

export function mapUserRow(row: any): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio || '',
    avatarUrl: row.avatar_url || null,
    coverUrl: row.cover_url || null,
    website: row.website || '',
    isVerified: Boolean(row.is_verified),
    isPrivate: Boolean(row.is_private),
    role: row.role,
    status: row.status,
    creatorTierPriceCents: row.creator_tier_price_cents ?? 499,
    createdAt: row.created_at,
  };
}

export async function resolveUserFromRequest(req: Request): Promise<AuthUser | null> {
  const token = extractTokenFromReq(req);
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;

  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as any;
  if (!row || row.status !== 'ACTIVE') return null;
  return mapUserRow(row);
}

export interface AuthedRequest extends Request {
  user?: AuthUser | null;
}

export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.user = await resolveUserFromRequest(req);
  next();
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Enforce CSRF guard on cookie-authenticated mutations when Bearer header is absent
  const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
  if (!hasBearer && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const xRequested = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const originMatches = origin && host && origin.includes(String(host));
    if (!xRequested && !originMatches) {
      return res.status(403).json({ error: 'Missing request verification header.' });
    }
  }

  const user = await resolveUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}
