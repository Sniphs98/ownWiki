import { fail } from '@sveltejs/kit';
import { disconnect, listConnections } from '$lib/server/ai-connections';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	connections: locals.user ? await listConnections(locals.user.id) : []
});

export const actions: Actions = {
	disconnect: async ({ locals, request }) => {
		if (!locals.user) return fail(401, { message: 'Melde dich an.' });
		const clientId = (await request.formData()).get('clientId')?.toString();
		if (!clientId) return fail(400, { message: 'Welche Verbindung?' });
		await disconnect(locals.user.id, clientId);
	}
};
