/**
 * Fixed-window counter in memory: at most `max` hits per key within
 * `windowMs`. Enough for a single server process; counts reset on restart.
 */
export function createRateLimiter(max: number, windowMs: number, now = () => Date.now()) {
	const windows = new Map<string, { start: number; count: number }>();

	return {
		/** Counts a hit; false if the key is over its limit. */
		hit(key: string): boolean {
			const time = now();
			// Keeps the map from growing without bound under many distinct keys.
			if (windows.size > 10_000) {
				for (const [k, w] of windows) if (time - w.start >= windowMs) windows.delete(k);
			}
			const current = windows.get(key);
			if (!current || time - current.start >= windowMs) {
				windows.set(key, { start: time, count: 1 });
				return true;
			}
			current.count++;
			return current.count <= max;
		}
	};
}
