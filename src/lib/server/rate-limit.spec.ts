import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
	it('allows up to max hits per window, per key', () => {
		let time = 0;
		const limiter = createRateLimiter(2, 1000, () => time);

		expect(limiter.hit('a')).toBe(true);
		expect(limiter.hit('a')).toBe(true);
		expect(limiter.hit('a')).toBe(false);
		expect(limiter.hit('b')).toBe(true);

		time = 1000;
		expect(limiter.hit('a')).toBe(true);
	});
});
