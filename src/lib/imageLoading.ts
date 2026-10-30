/** Only the leading cards at the initial viewport width receive priority. */
export function priorityImageCount(width: number): number {
  return width < 700 ? 2 : 6;
}

export type FailureSnapshot<T> = { conditions: T; failedImages: ReadonlySet<number> };

/** Errors affect sorting only when a new set of deferred conditions is shown. */
export function snapshotImageFailures<T>(
  previous: FailureSnapshot<T>, conditions: T, failedImages: ReadonlySet<number>,
): FailureSnapshot<T> {
  return previous.conditions === conditions ? previous : { conditions, failedImages };
}

export const IMAGE_GATE_TIMEOUT = 2500;
export function imageRetryDelay(retries: number): number | null {
  return [1200, 3000][retries] ?? null;
}
export function imageGateIsOpen(pending: ReadonlySet<number>, elapsed: number, scrolled: boolean): boolean {
  return pending.size === 0 || elapsed >= IMAGE_GATE_TIMEOUT || scrolled;
}

/** One store per initial result screen; opening is permanent. */
export function createImageGate(ids: readonly number[]) {
  const pending = new Set(ids);
  let open = imageGateIsOpen(pending, 0, false);
  const listeners = new Set<() => void>();
  const release = () => {
    if (open) return;
    open = true;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => open,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    settle: (id: number) => {
      pending.delete(id);
      if (imageGateIsOpen(pending, 0, false)) release();
    },
    release,
    start: () => {
      if (open) return () => {};
      const timer = window.setTimeout(release, IMAGE_GATE_TIMEOUT);
      window.addEventListener("scroll", release, { passive: true, once: true });
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("scroll", release);
      };
    },
  };
}
export type ImageGate = ReturnType<typeof createImageGate>;
