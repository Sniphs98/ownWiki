import { env } from '$env/dynamic/private';

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

/** Email and password, unless PASSWORD_LOGIN=false (with Microsoft, to log in only through it). */
export const passwordLogin = env.PASSWORD_LOGIN !== 'false' || !microsoftLogin;
