import { dbDialect } from '$lib/server/db';

const impl = dbDialect === 'postgresql' ? await import('./pins.pg') : await import('./pins.sqlite');

export const pinnedPaths = impl.pinnedPaths;
export const pin = impl.pin;
export const unpin = impl.unpin;
export const movePins = impl.movePins;
