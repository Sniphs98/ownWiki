import { createAuthClient } from 'better-auth/svelte';
import { withBase } from '$lib/base-path';

// Under BASE_PATH, like the server's (auth.ts).
export const authClient = createAuthClient({ basePath: withBase('/api/auth') });
