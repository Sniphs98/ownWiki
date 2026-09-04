import { env } from '$env/dynamic/private';

/**
 * - `disabled` — no login required; everyone can read and write.
 * - `read-only` — no login required to read; editing/creating requires login.
 * - `full` — no access at all without login (private wiki).
 */
export type AuthMode = 'disabled' | 'read-only' | 'full';

const AUTH_MODES: AuthMode[] = ['disabled', 'read-only', 'full'];

function isAuthMode(value: string | undefined): value is AuthMode {
	return AUTH_MODES.includes(value as AuthMode);
}

// Defaults to read-only: content is publicly readable, editing needs an
// account. Set AUTH_MODE explicitly for the "disabled" or "full" modes.
export const authMode: AuthMode = isAuthMode(env.AUTH_MODE) ? env.AUTH_MODE : 'read-only';
