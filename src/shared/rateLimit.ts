export type RateLimiter = {
  allow: (key: string) => boolean;
};

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    allow(key: string): boolean {
      const time = now();
      const recent = (hits.get(key) ?? []).filter((stamp) => time - stamp < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        if (hits.size > 5000) prune(hits, time, windowMs);
        return false;
      }
      recent.push(time);
      hits.set(key, recent);
      return true;
    },
  };
}

function prune(hits: Map<string, number[]>, time: number, windowMs: number): void {
  for (const [key, stamps] of hits) {
    const recent = stamps.filter((stamp) => time - stamp < windowMs);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}
