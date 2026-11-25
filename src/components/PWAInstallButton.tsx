import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'header' | 'banner' | 'card';
}

export function PWAInstallButton({ variant = 'sidebar' }: PWAInstallButtonProps) {
  const { isInstallable, isStandalone, isIos, isAndroid, canShowInstall, promptInstall } =
    usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('orbis-pwa-banner-dismissed') === '1';
  });

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome === 'unavailable') {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const dismissBanner = () => {
    setBannerDismissed(true);
    window.sessionStorage.setItem('orbis-pwa-banner-dismissed', '1');
  };

  const modal = guideOpen && (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Orbis app icon"
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
            />
            <div>
              <h2 id="pwa-install-title" className="font-display text-base font-bold">
                Install Orbis App
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Full-screen experience with fast offline launch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(false)}
            aria-label="Close install instructions"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          {isIos ? (
            <ol className="space-y-3">
              <li className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <Share className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    1. Tap the Share button
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Open Safari&apos;s Share sheet from the bottom or top toolbar.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <PlusSquare className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    2. Choose &ldquo;Add to Home Screen&rdquo;
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Scroll down in the Share menu and tap Add to Home Screen, then Add.
                  </p>
                </div>
              </li>
            </ol>
          ) : isAndroid ? (
            <ol className="space-y-3">
              <li className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    1. Open the browser menu
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Tap the three-dot menu in the top corner of Chrome or Edge.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    2. Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Orbis installs directly to your Android app drawer with its standalone icon.
                  </p>
                </div>
              </li>
            </ol>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <Download className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Install from your browser address bar
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Click the Install icon in Chrome, Edge, or Brave&apos;s address bar, or open
                    this page directly in its own browser tab (outside an embedded preview frame).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setGuideOpen(false)}
          className="mt-5 min-h-[44px] w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Done
        </button>
      </div>
    </div>
  );

  if (variant === 'card') {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Orbis app icon"
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
            />
            <div>
              <p className="text-sm font-semibold">Install Orbis App</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isStandalone
                  ? 'Running in standalone app mode on this device'
                  : 'Add Orbis to your Android, iOS, or desktop home screen'}
              </p>
            </div>
          </div>

          {isStandalone ? (
            <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Installed
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              {isInstallable ? 'Install App' : isIos ? 'iOS Install Guide' : 'Install App'}
            </button>
          )}
        </div>
        {modal}
      </>
    );
  }

  if (variant === 'header') {
    if (!canShowInstall) return null;
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          aria-label="Install Orbis App"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
        >
          <Download className="h-5 w-5" />
        </button>
        {modal}
      </>
    );
  }

  if (variant === 'banner') {
    if (!canShowInstall || bannerDismissed) return null;
    return (
      <>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-600/10 p-3 md:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/pwa-192x192.png"
              alt="Orbis"
              className="h-10 w-10 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Get the Orbis App
              </p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                {isIos ? 'Add to Home Screen on iOS' : 'Instant launch & full-screen Reels'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="min-h-[38px] rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss install banner"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {modal}
      </>
    );
  }

  // Default: sidebar variant
  if (!canShowInstall) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="flex min-h-[42px] w-full items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-600/10 px-3.5 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600/15 dark:text-indigo-400"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Install Orbis App</span>
      </button>
      {modal}
    </>
  );
}
