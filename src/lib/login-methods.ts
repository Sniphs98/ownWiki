import type { AuthMode } from './server/auth-mode';

export interface LoginMethods {
	password: boolean;
	microsoft: boolean;
	/** Whether there's any way to log in; without one, there are no accounts to speak of. */
	any: boolean;
	/** Why a setting was overruled, for the log. */
	warning?: string;
}

/**
 * Which ways to log in a wiki offers: email and password unless
 * PASSWORD_LOGIN=false, Microsoft if it's set up. None at all only where
 * nobody needs one — AUTH_MODE=disabled. Anywhere else nobody could get in
 * any more, admins included, so the password login stays.
 */
export function loginMethods(
	passwordLoginSetting: string | undefined,
	microsoft: boolean,
	authMode: AuthMode
): LoginMethods {
	const passwordWanted = passwordLoginSetting !== 'false';
	if (passwordWanted || microsoft || authMode === 'disabled') {
		const password = passwordWanted;
		return { password, microsoft, any: password || microsoft };
	}
	return {
		password: true,
		microsoft: false,
		any: true,
		warning:
			`PASSWORD_LOGIN=false wird ignoriert: Ohne Microsoft-Login und mit AUTH_MODE=${authMode} ` +
			'käme niemand mehr herein. Ganz ohne Anmeldung geht es nur mit AUTH_MODE=disabled.'
	};
}
