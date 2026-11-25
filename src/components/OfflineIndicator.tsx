import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-[52px] md:top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-950/95 px-4 py-2 text-xs font-medium text-amber-100 backdrop-blur-md"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-amber-400" />
      <span>You are offline. Cached content remains available until connection returns.</span>
    </div>
  );
}
