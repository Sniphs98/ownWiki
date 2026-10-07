export class QueueFullError extends Error {}

/**
 * Runs at most `concurrency` tasks at a time; up to `maxQueued` more wait
 * their turn, anything beyond that is rejected with QueueFullError right
 * away instead of piling up.
 */
export function createLimiter(concurrency: number, maxQueued: number) {
	let running = 0;
	const waiting: (() => void)[] = [];

	return async function run<T>(task: () => Promise<T>): Promise<T> {
		if (running >= concurrency) {
			if (waiting.length >= maxQueued) throw new QueueFullError();
			// The finishing task hands its slot over, `running` stays as is.
			await new Promise<void>((resolve) => waiting.push(resolve));
		} else {
			running++;
		}
		try {
			return await task();
		} finally {
			const next = waiting.shift();
			if (next) next();
			else running--;
		}
	};
}
