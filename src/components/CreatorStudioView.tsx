import React, { useEffect, useState } from 'react';
import { BarChart3, Megaphone, Sparkles, Plus, Upload, Loader2 } from 'lucide-react';
import { apiFetch, uploadMedia } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { AdCampaign, Post } from '../types';
import { Avatar, VerifiedBadge } from './OrbisUI';

export function CreatorStudioView() {
  const { currentUser, setAuthModalOpen, refreshUser } = useApp();
  const [analytics, setAnalytics] = useState<{ totals: any; topPosts: Post[] } | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [myAds, setMyAds] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewAd, setShowNewAd] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adBody, setAdBody] = useState('');
  const [adUrl, setAdUrl] = useState('https://orbis.social');
  const [adBudget, setAdBudget] = useState('25');
  const [adImage, setAdImage] = useState<string | null>(null);

  const loadAll = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [aRes, sRes, adRes] = await Promise.all([
        apiFetch<{ totals: any; topPosts: Post[] }>('/api/creator/analytics'),
        apiFetch<{ subscriptions: any[]; creators: any[] }>('/api/subscriptions'),
        apiFetch<{ ads: AdCampaign[] }>('/api/ads?scope=mine'),
      ]);
      setAnalytics(aRes);
      setSubscriptions(sRes.subscriptions || []);
      setCreators(sRes.creators || []);
      setMyAds(adRes.ads || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
        <h2 className="font-display text-lg font-bold mb-1">Creator Studio &amp; Monetization</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Sign in to view analytics, launch ad campaigns, and manage creator memberships.
        </p>
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

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
      </div>
    );
  }

  const hasOrbisPro = subscriptions.some((s) => !s.creator_id && s.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Creator Studio &amp; Monetization</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Real-time engagement analytics, creator memberships &amp; sponsored campaigns
        </p>
      </div>

      {/* Analytics KPIs */}
      {analytics && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <span>Creator Analytics</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Total Views', value: analytics.totals.totalViews },
              { label: 'Likes Received', value: analytics.totals.likesReceived },
              { label: 'Comments', value: analytics.totals.commentsReceived },
              { label: 'Followers', value: analytics.totals.followersCount },
              { label: 'Paid Members', value: analytics.totals.paidSubscribers },
              {
                label: 'Monthly Revenue',
                value: `$${(analytics.totals.monthlyRevenueCents / 100).toFixed(2)}`,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <p className="text-xs text-zinc-500">{kpi.label}</p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Orbis+ Pro Subscription */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div>
          <div className="flex items-center gap-2 font-display text-base font-bold">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span>Orbis+ Pro Membership</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Includes Verified badge, boosted Reel reach, and creator monetization tools ($9.99/mo).
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await apiFetch('/api/subscriptions', {
              method: 'POST',
              body: JSON.stringify({ creatorId: null }),
            });
            await refreshUser();
            loadAll();
          }}
          className={`min-h-[42px] rounded-xl px-5 py-2 text-xs font-semibold ${
            hasOrbisPro
              ? 'border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {hasOrbisPro ? 'Cancel Orbis+ Pro' : 'Upgrade to Orbis+ ($9.99/mo)'}
        </button>
      </section>

      {/* Paid Creator Memberships */}
      <section className="space-y-3">
        <h2 className="font-display text-sm font-bold text-zinc-500">Creator Memberships</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {creators.map((c) => {
            const active = subscriptions.some((s) => s.creator_id === c.id && s.status === 'ACTIVE');
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={c.avatar_url} name={c.display_name} size="sm" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-xs font-semibold truncate">
                      {c.display_name}
                      {Boolean(c.is_verified) && <VerifiedBadge />}
                    </p>
                    <p className="text-[11px] text-zinc-500 tabular-nums">
                      ${(c.creator_tier_price_cents / 100).toFixed(2)}/month
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/subscriptions', {
                      method: 'POST',
                      body: JSON.stringify({ creatorId: c.id }),
                    });
                    loadAll();
                  }}
                  className={`min-h-[36px] rounded-xl px-3.5 text-xs font-semibold shrink-0 ${
                    active
                      ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  }`}
                >
                  {active ? 'Subscribed' : 'Join'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Business Advertising Campaigns */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Megaphone className="h-4 w-4 text-indigo-500" />
            <span>Business Ad Campaigns</span>
          </div>
          <button
            type="button"
            onClick={() => setShowNewAd((v) => !v)}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> New Campaign
          </button>
        </div>

        {showNewAd && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/ads', {
                method: 'POST',
                body: JSON.stringify({
                  title: adTitle,
                  body: adBody,
                  targetUrl: adUrl,
                  budgetDollars: Number(adBudget),
                  imageUrl: adImage,
                }),
              });
              setAdTitle('');
              setAdBody('');
              setAdImage(null);
              setShowNewAd(false);
              loadAll();
            }}
            className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <input
              required
              value={adTitle}
              onChange={(e) => setAdTitle(e.target.value)}
              placeholder="Campaign headline"
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
            <textarea
              required
              rows={2}
              value={adBody}
              onChange={(e) => setAdBody(e.target.value)}
              placeholder="Sponsored message copy..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={adUrl}
                onChange={(e) => setAdUrl(e.target.value)}
                placeholder="https://yourbrand.com"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
              <input
                required
                type="number"
                min="5"
                value={adBudget}
                onChange={(e) => setAdBudget(e.target.value)}
                placeholder="Budget (USD)"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <Upload className="h-4 w-4" />
                {adImage ? 'Creative Uploaded' : 'Upload Ad Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const res = await uploadMedia(f);
                      setAdImage(res.url);
                    }
                  }}
                />
              </label>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white"
              >
                Launch Ad
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2.5">
          {myAds.length === 0 ? (
            <p className="text-xs text-zinc-500">No ad campaigns created yet.</p>
          ) : (
            myAds.map((ad) => (
              <div
                key={ad.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div>
                  <p className="text-sm font-bold">{ad.title}</p>
                  <p className="text-xs text-zinc-500 tabular-nums">
                    Status: {ad.status} · Budget: ${(ad.budget_cents / 100).toFixed(0)} ·{' '}
                    {ad.impressions} impressions · {ad.clicks} clicks
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
