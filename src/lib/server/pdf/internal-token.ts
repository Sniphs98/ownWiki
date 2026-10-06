import crypto from 'node:crypto';

/**
 * Generated once per process start and never sent to any client response.
 * Lets generate-pdf.ts's loopback request into /print/... pass hooks.server.ts's
 * AUTH_MODE=full gate without a real user session — nothing else can know
 * this value, so it can't be forged from outside the process.
 */
export const PDF_INTERNAL_TOKEN = crypto.randomBytes(32).toString('hex');

export const PDF_INTERNAL_TOKEN_HEADER = 'x-internal-pdf-token';
