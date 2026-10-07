import { describe, expect, it } from 'vitest';
import { createLimiter, QueueFullError } from './concurrency';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

describe('createLimiter', () => {
	it('runs no more than the given number of tasks at once', async () => {
		const run = createLimiter(2, 10);
		let active = 0;
		let maxActive = 0;
		const gates = [deferred(), deferred(), deferred(), deferred()];

		const results = gates.map((gate, i) =>
			run(async () => {
				active++;
				maxActive = Math.max(maxActive, active);
				await gate.promise;
				active--;
				return i;
			})
		);
		for (const gate of gates) {
			await Promise.resolve();
			gate.resolve();
		}

		expect(await Promise.all(results)).toEqual([0, 1, 2, 3]);
		expect(maxActive).toBe(2);
	});

	it('rejects tasks once the queue is full', async () => {
		const run = createLimiter(1, 1);
		const gate = deferred();
		const first = run(() => gate.promise);
		const second = run(async () => 'queued');

		await expect(run(async () => 'too many')).rejects.toBeInstanceOf(QueueFullError);

		gate.resolve();
		await first;
		expect(await second).toBe('queued');
	});

	it('frees the slot when a task fails', async () => {
		const run = createLimiter(1, 0);
		await expect(run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
		expect(await run(async () => 'next')).toBe('next');
	});
});
