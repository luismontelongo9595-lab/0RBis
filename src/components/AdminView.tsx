import React, { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, CheckCircle2, Trash2, Ban, UserCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';

export function AdminView() {
  const { currentUser, setAuthModalOpen, refreshUser } = useApp();
  const [adminStatus, setAdminStatus] = useState<{ configured: boolean; needsClaim: boolean } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [claimError, setClaimError] = useState('');

  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<'users' | 'reports' | 'ads' | 'subscriptions'>('users');
  const [loading, setLoading] = useState(true);

  const loadAdmin = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (currentUser.role !== 'ADMIN') {
        const st = await apiFetch<{ configured: boolean; needsClaim: boolean }>('/api/auth/admin-status');
        setAdminStatus(st);
        setOverview(null);
      } else {
        const data = await apiFetch('/api/admin/overview');
        setOverview(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  if (!currentUser) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
        <p className="text-sm text-zinc-500 mb-4">Sign in to access the Administrator Dashboard.</p>
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

  if (currentUser.role !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <ShieldAlert className="h-5 w-5 text-indigo-500" />
          <span>{adminStatus?.needsClaim ? 'Claim Platform Admin Access' : 'Verify Admin Passcode'}</span>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {adminStatus?.needsClaim
            ? 'No admin passcode has been claimed yet. Choose an administrator passcode below to lock and activate admin controls.'
            : 'Enter the administrator passcode to unlock platform moderation and analytics.'}
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setClaimError('');
            try {
              await apiFetch('/api/auth/admin-claim', {
                method: 'POST',
                body: JSON.stringify({ passcode }),
              });
              setPasscode('');
              await refreshUser();
              loadAdmin();
            } catch (err: any) {
              setClaimError(err.message || 'Verification failed.');
            }
          }}
          className="mt-4 space-y-3"
        >
          <input
            type="password"
            required
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={adminStatus?.needsClaim ? 'Set admin passcode (min 4 chars)' : 'Enter admin passcode'}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
          {claimError && <p className="text-xs text-rose-500">{claimError}</p>}
          <button
            type="submit"
            className="min-h-[42px] w-full rounded-xl bg-indigo-600 text-xs font-semibold text-white"
          >
            {adminStatus?.needsClaim ? 'Set Passcode & Activate Admin' : 'Unlock Admin Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Administrator Dashboard</h1>
        <p className="text-xs text-zinc-500">
          User moderation, reported content review, advertising &amp; platform telemetry
        </p>
      </div>

      {overview && (
        <>
          {/* Platform Statistics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: 'Total Users', value: overview.stats.totalUsers },
              { label: 'Total Posts', value: overview.stats.totalPosts },
              { label: 'Open Reports', value: overview.stats.openReports },
              { label: 'Active Ads', value: overview.stats.activeAds },
              { label: 'Active Subscriptions', value: overview.stats.activeSubscriptions },
              { label: 'Platform MRR', value: `$${(overview.stats.mrrCents / 100).toFixed(2)}` },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900/70">
            {(['users', 'reports', 'ads', 'subscriptions'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 min-h-[38px] rounded-lg text-xs font-semibold capitalize ${
                  tab === t
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Users Table */}
          {tab === 'users' && (
            <div className="space-y-2.5">
              {overview.users.map((u: any) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {u.display_name} <span className="font-normal text-zinc-500">@{u.username}</span>
                    </p>
                    <p className="text-xs text-zinc-500">
                      {u.email} · Role: {u.role} · Status: {u.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ isVerified: !u.is_verified }),
                        });
                        loadAdmin();
                      }}
                      className="flex min-h-[36px] items-center gap-1 rounded-xl border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
                      {u.is_verified ? 'Unverify' : 'Verify'}
                    </button>
                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={async () => {
                          const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                          await apiFetch(`/api/admin/users/${u.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: nextStatus }),
                          });
                          loadAdmin();
                        }}
                        className={`flex min-h-[36px] items-center gap-1 rounded-xl px-3 text-xs font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-rose-600/10 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? (
                          <>
                            <Ban className="h-3.5 w-3.5" /> Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" /> Reactivate
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reported Content Moderation */}
          {tab === 'reports' && (
            <div className="space-y-3">
              {overview.reports.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No reported posts.</p>
              ) : (
                overview.reports.map((r: any) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
                  >
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        Reported by @{r.reporter_username} · Status: {r.status}
                      </span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Reason: {r.reason}
                    </p>
                    {r.post_content && (
                      <p className="mt-2 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800">
                        {r.post_content}
                      </p>
                    )}
                    {r.status === 'OPEN' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/reports/${r.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ action: 'REMOVE_POST' }),
                            });
                            loadAdmin();
                          }}
                          className="flex min-h-[36px] items-center gap-1 rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove Post
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/reports/${r.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ action: 'DISMISS' }),
                            });
                            loadAdmin();
                          }}
                          className="min-h-[36px] rounded-xl border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Ads Management */}
          {tab === 'ads' && (
            <div className="space-y-3">
              {overview.ads.map((ad: any) => (
                <div
                  key={ad.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <div>
                    <p className="text-sm font-bold">{ad.title}</p>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      @{ad.advertiser_username} · {ad.status} · {ad.impressions} impressions ·{' '}
                      {ad.clicks} clicks
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/admin/ads/${ad.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }),
                      });
                      loadAdmin();
                    }}
                    className="min-h-[36px] rounded-xl border border-zinc-200 px-3.5 text-xs font-semibold dark:border-zinc-700"
                  >
                    {ad.status === 'ACTIVE' ? 'Pause Ad' : 'Resume Ad'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Subscriptions */}
          {tab === 'subscriptions' && (
            <div className="space-y-2.5">
              {overview.subscriptions.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No subscriptions yet.</p>
              ) : (
                overview.subscriptions.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/70"
                  >
                    <span>
                      <strong>@{s.subscriber_username}</strong> → {s.tier_name}
                      {s.creator_username ? ` (@${s.creator_username})` : ''}
                    </span>
                    <span className="font-mono font-bold tabular-nums">
                      ${(s.price_cents / 100).toFixed(2)}/mo · {s.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
