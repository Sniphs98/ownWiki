import { env } from '$env/dynamic/private';
import { authMode } from '$lib/server/auth-mode';
import { loginMethods } from '$lib/login-methods';

/**
 * Login with Microsoft (Entra ID), for a company's own tenant. On with all
 * three of MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and
 * MICROSOFT_TENANT_ID — the tenant is required, so only the company's
 * accounts get in, not any Microsoft account.
 */
function microsoftConfig() {
	const clientId = env.MICROSOFT_CLIENT_ID;
	const clientSecret = env.MICROSOFT_CLIENT_SECRET;
	const tenantId = env.MICROSOFT_TENANT_ID;
	if (!clientId && !clientSecret && !tenantId) return null;
	if (!clientId || !clientSecret || !tenantId) {
		console.error(
			'[auth] Microsoft-Login ist aus: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET und MICROSOFT_TENANT_ID müssen alle gesetzt sein.'
		);
		return null;
	}
	if (['common', 'organizations', 'consumers'].includes(tenantId.toLowerCase())) {
		console.error(
			`[auth] Microsoft-Login ist aus: MICROSOFT_TENANT_ID muss die ID eures Tenants sein, nicht „${tenantId}“.`
		);
		return null;
	}
	return {
		clientId,
		clientSecret,
		tenantId,
		// Only for Entra External ID (CIAM) — and the e2e tests' stand-in.
		authority: env.MICROSOFT_AUTHORITY || undefined
	};
}

export const microsoftLogin = microsoftConfig();

const methods = loginMethods(env.PASSWORD_LOGIN, !!microsoftLogin, authMode);
if (methods.warning) console.error(`[auth] ${methods.warning}`);

/** Email and password, unless PASSWORD_LOGIN=false (see loginMethods). */
export const passwordLogin = methods.password;

/**
 * Whether anyone can log in at all. Not with PASSWORD_LOGIN=false and no
 * Microsoft, in a wiki everyone may edit anyway (AUTH_MODE=disabled).
 */
export const loginEnabled = methods.any;
