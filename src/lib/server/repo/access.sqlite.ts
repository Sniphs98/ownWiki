import { asc, eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { accessRule, user, userGroup, userGroupMember } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import type { AccessLevel, AccessRule, SubjectType } from '$lib/access';
import type { GroupWithMembers, StoredRule, UserRow } from './access.types';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function listRules(): Promise<StoredRule[]> {
	const rows = await sqlite.select().from(accessRule).orderBy(asc(accessRule.path));
	return rows.map((row) => ({
		id: row.id,
		path: row.path,
		subjectType: row.subjectType as SubjectType,
		subjectId: row.subjectId,
		level: row.level as AccessLevel
	}));
}

/** Sets the rule for this subject in this area, replacing one it had. */
export async function setRule(rule: AccessRule): Promise<void> {
	await sqlite
		.insert(accessRule)
		.values({ id: crypto.randomUUID(), ...rule })
		.onConflictDoUpdate({
			target: [accessRule.path, accessRule.subjectType, accessRule.subjectId],
			set: { level: rule.level }
		});
}

export async function deleteRule(id: string): Promise<void> {
	await sqlite.delete(accessRule).where(eq(accessRule.id, id));
}

export async function groupIdsOf(userId: string): Promise<string[]> {
	const rows = await sqlite
		.select({ groupId: userGroupMember.groupId })
		.from(userGroupMember)
		.where(eq(userGroupMember.userId, userId));
	return rows.map((row) => row.groupId);
}

export async function listGroups(): Promise<GroupWithMembers[]> {
	const [groups, members] = await Promise.all([
		sqlite.select().from(userGroup).orderBy(asc(userGroup.name)),
		sqlite
			.select({ groupId: userGroupMember.groupId, id: user.id, name: user.name, email: user.email })
			.from(userGroupMember)
			.innerJoin(user, eq(user.id, userGroupMember.userId))
			.orderBy(asc(user.name))
	]);
	return groups.map((group) => ({
		id: group.id,
		name: group.name,
		members: members
			.filter((m) => m.groupId === group.id)
			.map(({ id, name, email }) => ({ id, name, email }))
	}));
}

/** Creates a group; null if one with that name exists. */
export async function createGroup(name: string): Promise<string | null> {
	const existing = await sqlite
		.select({ id: userGroup.id })
		.from(userGroup)
		.where(eq(userGroup.name, name));
	if (existing.length) return null;
	const id = crypto.randomUUID();
	await sqlite.insert(userGroup).values({ id, name });
	return id;
}

/** Deletes a group with its memberships and the rules that name it. */
export async function deleteGroup(id: string): Promise<void> {
	await sqlite
		.delete(accessRule)
		.where(and(eq(accessRule.subjectType, 'group'), eq(accessRule.subjectId, id)));
	await sqlite.delete(userGroup).where(eq(userGroup.id, id));
}

export async function addMember(groupId: string, userId: string): Promise<void> {
	await sqlite.insert(userGroupMember).values({ groupId, userId }).onConflictDoNothing();
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
	await sqlite
		.delete(userGroupMember)
		.where(and(eq(userGroupMember.groupId, groupId), eq(userGroupMember.userId, userId)));
}

export async function listUsers(): Promise<UserRow[]> {
	return sqlite
		.select({ id: user.id, name: user.name, email: user.email, role: user.role })
		.from(user)
		.orderBy(asc(user.name));
}

export async function getUserRole(userId: string): Promise<string | null> {
	const rows = await sqlite.select({ role: user.role }).from(user).where(eq(user.id, userId));
	return rows[0]?.role ?? null;
}

export async function setUserRole(userId: string, role: 'admin' | 'member'): Promise<void> {
	await sqlite.update(user).set({ role }).where(eq(user.id, userId));
}
