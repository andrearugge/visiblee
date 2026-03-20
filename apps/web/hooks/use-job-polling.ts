'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_INTERVAL = 5000;

interface UseJobPollingOptions {
  /** Whether polling is active */
  active: boolean;
  /** Endpoint to GET on each tick */
  url: string;
  /** Return true when the result indicates the job is done */
  isDone: (data: unknown) => boolean;
  /**
   * Called when isDone returns true.
   * Defaults to router.refresh() — override for custom behaviour (e.g. show a banner).
   */
  onDone?: (data: unknown) => void;
  /** Polling interval in ms (default 5000) */
  interval?: number;
}

/**
 * Polls `url` every `interval` ms while `active` is true.
 * When `isDone(data)` returns true, calls `onDone(data)` (default: router.refresh()).
 * Busts the Next.js Router Cache so navigating away and back reflects updated server state.
 */
export function useJobPolling({
  active,
  url,
  isDone,
  onDone,
  interval = DEFAULT_INTERVAL,
}: UseJobPollingOptions) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const poll = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isDone(data)) {
          if (onDone) {
            onDone(data);
          } else {
            router.refresh();
          }
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    const id = setInterval(poll, interval);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, url, interval]);
}
