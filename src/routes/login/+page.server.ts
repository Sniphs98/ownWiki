import { error, fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { isSignupAllowed } from '$lib/server/signup';
import { loginEnabled, microsoftLogin, passwordLogin } from '$lib/server/login';
import { safeRedirectPath } from '$lib/safe-redirect';
import { oauthContinuation } from '$lib/server/oauth-flow';
import { createRateLimiter } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { withBase } from '$lib/base-path';

/** Where to go after logging in: back into an AI assistant's authorization, or redirectTo. */
async function redirectTarget(url: URL) {
	return (
		(await oauthContinuation(url)) ??
		safeRedirectPath(url.searchParams.get('redirectTo'), url.origin, withBase('/'))
	);
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
	// No way to log in at all: everyone may edit anyway (AUTH_MODE=disabled).
	if (!loginEnabled) redirect(303, withBase('/'));
	if (event.locals.user) {
		redirect(303, await redirectTarget(event.url));
	}
	return {
		passwordLogin,
		signupAllowed: passwordLogin && (await isSignupAllowed()),
		microsoftLogin: !!microsoftLogin,
		// Back from Microsoft without a login (see the microsoft action).
		error: event.url.searchParams.get('error')
	};
};

const PASSWORD_LOGIN_OFF = 'Hier meldest du dich mit Microsoft an.';

export const actions: Actions = {
	/** Off to Microsoft's login; it comes back to /api/auth/callback/microsoft. */
	microsoft: async (event) => {
		if (!microsoftLogin) error(404, 'Nicht gefunden');
		const { url } = await auth.api.signInSocial({
			headers: event.request.headers,
			body: {
				provider: 'microsoft',
				// Also back into an AI assistant's authorization, if that brought us here.
				callbackURL: await redirectTarget(event.url),
				errorCallbackURL: withBase('/login')
			}
		});
		if (!url) error(500, 'Microsoft-Anmeldung konnte nicht gestartet werden.');
		redirect(303, url);
	},

	signIn: async (event) => {
		if (!passwordLogin)
			return fail(403, { mode: 'signIn' as const, email: '', message: PASSWORD_LOGIN_OFF });
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

		redirect(303, await redirectTarget(event.url));
	},

	signUp: async (event) => {
		if (!passwordLogin) {
			return fail(403, {
				mode: 'signUp' as const,
				email: '',
				name: '',
				message: PASSWORD_LOGIN_OFF
			});
		}
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

		redirect(303, await redirectTarget(event.url));
	}
};
