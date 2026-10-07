import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { isSignupAllowed } from '$lib/server/signup';
import { safeRedirectPath } from '$lib/safe-redirect';
import type { Actions, PageServerLoad } from './$types';

function redirectTarget(url: URL) {
	return safeRedirectPath(url.searchParams.get('redirectTo'), url.origin);
}

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
