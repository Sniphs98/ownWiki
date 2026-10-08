import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { isSignupAllowed } from '$lib/server/signup';
import { safeRedirectPath } from '$lib/safe-redirect';
import { createRateLimiter } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

function redirectTarget(url: URL) {
	return safeRedirectPath(url.searchParams.get('redirectTo'), url.origin);
}

// Better Auth limits its own HTTP endpoints, but these actions call
// auth.api directly, which bypasses that. Per address and account, so
// guessing one account's password is slow; per address overall, so trying
// many accounts is too. Behind a reverse proxy, set ADDRESS_HEADER
// (adapter-node) or all visitors share the proxy's address.
const perAccount = createRateLimiter(5, 60_000);
const perAddress = createRateLimiter(30, 60_000);

function allowAttempt(event: RequestEvent, email: string) {
	const address = event.getClientAddress();
	// Both are counted, so a blocked account doesn't spare the address limit.
	const accountOk = perAccount.hit(`${address}|${email.toLowerCase()}`);
	const addressOk = perAddress.hit(address);
	return accountOk && addressOk;
}

const TOO_MANY = 'Zu viele Versuche. Bitte warte eine Minute.';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		redirect(303, redirectTarget(event.url));
	}
	return { signupAllowed: await isSignupAllowed() };
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!allowAttempt(event, email)) {
			return fail(429, { mode: 'signIn' as const, email, message: TOO_MANY });
		}

		try {
			await auth.api.signInEmail({
				headers: event.request.headers,
				body: { email, password }
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					mode: 'signIn' as const,
					email,
					message: err.message || 'Anmeldung fehlgeschlagen'
				});
			}
			return fail(500, { mode: 'signIn' as const, email, message: 'Unerwarteter Fehler' });
		}

		redirect(303, redirectTarget(event.url));
	},

	signUp: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		if (!allowAttempt(event, email)) {
			return fail(429, { mode: 'signUp' as const, email, name, message: TOO_MANY });
		}

		try {
			await auth.api.signUpEmail({
				headers: event.request.headers,
				body: { email, password, name }
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					mode: 'signUp' as const,
					email,
					name,
					message: err.message || 'Registrierung fehlgeschlagen'
				});
			}
			return fail(500, { mode: 'signUp' as const, email, name, message: 'Unerwarteter Fehler' });
		}

		redirect(303, redirectTarget(event.url));
	}
};
