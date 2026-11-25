import React, { useState } from 'react';
import { Loader2, Upload, Check, Download, Shield } from 'lucide-react';
import { apiFetch, uploadMedia } from '../lib/api';
import { useApp } from '../context/AppContext';
import { Avatar, SafeImage } from './OrbisUI';
import { PWAInstallButton } from './PWAInstallButton';

export function SettingsView() {
  const { currentUser, refreshUser, openProfile, setAuthModalOpen, setActiveTab } = useApp();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [website, setWebsite] = useState(currentUser?.website || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(currentUser?.coverUrl || '');
  const [isPrivate, setIsPrivate] = useState(Boolean(currentUser?.isPrivate));
  const [tierPriceDollars, setTierPriceDollars] = useState(
    ((currentUser?.creatorTierPriceCents || 499) / 100).toFixed(2)
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  if (!currentUser) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-sm text-zinc-500 mb-4">Sign in to edit your profile and privacy settings.</p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="min-h-[42px] rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white"
          >
            Sign in
          </button>
        </div>

        <PWAInstallButton variant="card" />

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
          <SafeImage
            src="/src/assets/images/orbis_brand_logo_1795641054902.jpg"
            alt="Orbis Brand Emblem"
            className="h-44 w-44 rounded-2xl object-cover ring-1 ring-zinc-200 shadow-lg dark:ring-zinc-700"
          />
          <div>
            <h2 className="font-display text-base font-bold">Orbis Brand Emblem</h2>
            <p className="mt-1 text-xs text-zinc-500">Full-resolution avatar logo</p>
          </div>
          <a
            href="/src/assets/images/orbis_brand_logo_1795641054902.jpg"
            download="orbis-avatar-logo.jpg"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Download className="h-4 w-4" />
            Download Logo
          </a>
        </div>
      </div>
    );
  }

  async function handleImageUpload(file: File, target: 'avatar' | 'cover') {
    const res = await uploadMedia(file);
    if (target === 'avatar') setAvatarUrl(res.url);
    else setCoverUrl(res.url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName,
          bio,
          website,
          avatarUrl: avatarUrl || null,
          coverUrl: coverUrl || null,
          isPrivate,
          creatorTierPriceCents: Math.round(Number(tierPriceDollars || 4.99) * 100),
        }),
      });
      await refreshUser();
      setSavedMsg('Profile saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/70"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Profile &amp; Privacy Settings</h1>
          <p className="text-xs text-zinc-500">@{currentUser.username}</p>
        </div>
        <button
          type="button"
          onClick={() => openProfile(currentUser.username)}
          className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View Profile →
        </button>
      </div>

      {/* Preview Cover + Avatar */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="h-32 w-full bg-gradient-to-r from-indigo-600 via-rose-500 to-amber-500">
          {coverUrl && <SafeImage src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" />}
        </div>
        <div className="-mt-8 flex items-center gap-3 px-4 pb-3">
          <Avatar src={avatarUrl} name={displayName || currentUser.displayName} size="lg" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold hover:border-indigo-500 dark:border-zinc-700">
          <Upload className="h-4 w-4" />
          Upload Profile Picture
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'avatar')}
          />
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs font-semibold hover:border-indigo-500 dark:border-zinc-700">
          <Upload className="h-4 w-4" />
          Upload Cover Photo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'cover')}
          />
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-500">Display Name</label>
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-500">Biography</label>
        <textarea
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">Website URL</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yoursite.com"
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-500">
            Creator Membership Price (USD/mo)
          </label>
          <input
            type="number"
            min="1"
            step="0.5"
            value={tierPriceDollars}
            onChange={(e) => setTierPriceDollars(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold">Private Account</p>
          <p className="text-xs text-zinc-500">Only approved followers can see your posts and Reels</p>
        </div>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="h-5 w-5 accent-indigo-600"
        />
      </label>

      {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
      {savedMsg && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" /> {savedMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Profile
      </button>

      <div className="space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <PWAInstallButton variant="card" />

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <SafeImage
              src="/src/assets/images/orbis_brand_logo_1795641054902.jpg"
              alt="Orbis Brand Emblem"
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
            />
            <div>
              <p className="text-sm font-semibold">Orbis Brand Emblem</p>
              <p className="text-xs text-zinc-500">Download the official high-resolution logo image</p>
            </div>
          </div>
          <a
            href="/src/assets/images/orbis_brand_logo_1795641054902.jpg"
            download="orbis-avatar-logo.jpg"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" />
            Download Logo
          </a>
        </div>

        {currentUser.role === 'ADMIN' && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" />
              Open Admin Dashboard
            </span>
            <span className="text-zinc-400">→</span>
          </button>
        )}
      </div>
    </form>
  );
}
