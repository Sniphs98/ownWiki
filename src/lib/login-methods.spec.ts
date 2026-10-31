import { describe, expect, it } from 'vitest';
import { loginMethods } from './login-methods';

describe('loginMethods', () => {
	it('offers the password login by default, and Microsoft once set up', () => {
		expect(loginMethods(undefined, false, 'read-only')).toEqual({
			password: true,
			microsoft: false,
			any: true
		});
		expect(loginMethods(undefined, true, 'full')).toMatchObject({
			password: true,
			microsoft: true
		});
	});

	it('leaves only Microsoft with PASSWORD_LOGIN=false', () => {
		expect(loginMethods('false', true, 'full')).toEqual({
			password: false,
			microsoft: true,
			any: true
		});
	});

	it('has no login at all with neither, where nobody needs one', () => {
		expect(loginMethods('false', false, 'disabled')).toEqual({
			password: false,
			microsoft: false,
			any: false
		});
	});

	it('keeps the password login where nobody could get in otherwise', () => {
		for (const mode of ['read-only', 'full'] as const) {
			const methods = loginMethods('false', false, mode);
			expect(methods).toMatchObject({ password: true, any: true });
			expect(methods.warning).toContain(`AUTH_MODE=${mode}`);
		}
	});
});
