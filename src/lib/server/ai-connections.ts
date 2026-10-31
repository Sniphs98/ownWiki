import { auth, mcpResource } from '$lib/server/auth';

/** An AI assistant someone allowed on /consent, until they disconnect it. */
export interface AiConnection {
	clientId: string;
	name: string;
	connectedAt: Date;
}

type Where = { field: string; value: string }[];

const adapter = async () => (await auth.$context).adapter;
const byPerson = (userId: string, clientId?: string): Where => [
	{ field: 'userId', value: userId },
	...(clientId ? [{ field: 'clientId', value: clientId }] : [])
];

/** The assistants a person has connected, newest first. None without the AI connection (ORIGIN). */
export async function listConnections(userId: string): Promise<AiConnection[]> {
	if (!mcpResource) return [];
	const db = await adapter();
	const consents = await db.findMany<{ clientId: string; createdAt: Date | string }>({
		model: 'oauthConsent',
		where: byPerson(userId)
	});
	const connections = await Promise.all(
		consents.map(async (consent) => {
			const client = await db.findOne<{ name?: string | null }>({
				model: 'oauthClient',
				where: [{ field: 'clientId', value: consent.clientId }]
			});
			return {
				clientId: consent.clientId,
				name: client?.name || 'KI-Assistent',
				connectedAt: new Date(consent.createdAt)
			};
		})
	);
	return connections.sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());
}

/**
 * Whether the person still allows this assistant. Its access tokens are
 * signed and stay valid until they expire, so /mcp asks this on every
 * request — disconnecting takes effect at once.
 */
export async function isConnected(userId: string, clientId: string): Promise<boolean> {
	const db = await adapter();
	return Boolean(await db.findOne({ model: 'oauthConsent', where: byPerson(userId, clientId) }));
}

/** Ends a connection: the assistant has to be allowed again to get back in. */
export async function disconnect(userId: string, clientId: string): Promise<void> {
	if (!mcpResource) return;
	const db = await adapter();
	const where = byPerson(userId, clientId);
	await db.deleteMany({ model: 'oauthAccessToken', where });
	await db.deleteMany({ model: 'oauthRefreshToken', where });
	await db.deleteMany({ model: 'oauthConsent', where });
}
