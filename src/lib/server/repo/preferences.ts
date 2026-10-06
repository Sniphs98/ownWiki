import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql'
		? await import('./preferences.pg')
		: await import('./preferences.sqlite');

export const getUserPreferences = impl.getUserPreferences;
export const setToolbar = impl.setToolbar;

export type { UserPreferences } from './preferences.types';
