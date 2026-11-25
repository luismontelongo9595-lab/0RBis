import React, { useState } from 'react';
import { BadgeCheck, Loader2, X, ImageOff } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { User } from '../types';

const ORBIS_LOGO_SRC = '/src/assets/images/orbis_brand_logo_1795641054902.jpg';

export function OrbisLogo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      {!imgFailed ? (
        <img
          src={ORBIS_LOGO_SRC}
          alt="Orbis"
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={{ width: size, height: size }}
          className="rounded-xl object-cover ring-1 ring-zinc-900/15 shadow-sm dark:ring-white/15 shrink-0"
        />
      ) : (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="orbisBrandGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4F46E5" />
              <stop offset="0.6" stopColor="#E11D48" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="11" fill="url(#orbisBrandGrad)" />
          <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="2.4" />
          <ellipse
            cx="20"
            cy="20"
            rx="14.5"
            ry="5.2"
            transform="rotate(-26 20 20)"
            stroke="white"
            strokeWidth="2"
            strokeOpacity="0.92"
          />
          <circle cx="28.5" cy="11.5" r="2.2" fill="white" />
        </svg>
      )}
      {showText && (
        <span className="font-display text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Orbis
        </span>
      )}
    </div>
  );
}

export function VerifiedBadge() {
  return (
    <BadgeCheck
      className="inline-block h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0"
      aria-label="Verified account"
    />
  );
}

export function SafeImage({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 ${className}`}
      >
        <ImageOff className="h-6 w-6 mb-1 opacity-60" />
        <span className="text-xs px-3 text-center truncate max-w-full">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function Avatar({
  src,
  name,
  size = 'md',
  isOnline = false,
}: {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const dims = {
    xs: 'h-7 w-7 text-[11px]',
    sm: 'h-9 w-9 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
    xl: 'h-24 w-24 text-2xl',
  }[size];

  const dotDims = size === 'sm' || size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <div className="relative inline-flex shrink-0">
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`${dims} rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-800`}
        />
      ) : (
        <div
          className={`${dims} rounded-full bg-gradient-to-br from-zinc-900 via-indigo-900 to-rose-700 text-amber-200 font-display font-bold flex items-center justify-center ring-1 ring-amber-400/30`}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      {isOnline && (
        <span
          title="Online"
          className={`absolute bottom-0 right-0 ${dotDims} rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950`}
        />
      )}
    </div>
  );
}

export function formatRelativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen, loginSuccess } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { identifier: email, password }
          : { email, username, displayName, password };
      const data = await apiFetch<{ user: User; token: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      loginSuccess(data.user, data.token);
      setEmail('');
      setUsername('');
      setDisplayName('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setAuthModalOpen(false)}
          aria-label="Close sign in dialog"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <OrbisLogo size={38} />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'login'
              ? 'Sign in to post, follow creators, and message in real time.'
              : 'Create your Orbis account — first registered account becomes platform Admin.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <input
            type={mode === 'login' ? 'text' : 'email'}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === 'login' ? 'Email or username' : 'Email address'}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />

          {mode === 'register' && (
            <>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (e.g. alex_nova)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </>
          )}

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
