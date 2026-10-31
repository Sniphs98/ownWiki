import type { auth } from '$lib/server/auth';
import type { AuthMode } from '$lib/server/auth-mode';
import type { PageAccess } from '$lib/server/access';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: typeof auth.$Infer.Session.user;
			session?: typeof auth.$Infer.Session.session;
			authMode: AuthMode;
			/** What the visitor may do with which page, see $lib/access.ts. */
			access: PageAccess;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
