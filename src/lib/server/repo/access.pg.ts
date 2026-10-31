import { asc, eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { accessRule, user, userGroup, userGroupMember } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';
import type { AccessLevel, AccessRule, SubjectType } from '$lib/access';
import type { GroupWithMembers, StoredRule, UserRow } from './access.types';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function listRules(): Promise<StoredRule[]> {
	const rows = await pg.select().from(accessRule).orderBy(asc(accessRule.path));
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
	await pg
		.insert(accessRule)
		.values({ id: crypto.randomUUID(), ...rule })
		.onConflictDoUpdate({
			target: [accessRule.path, accessRule.subjectType, accessRule.subjectId],
			set: { level: rule.level }
		});
}

export async function deleteRule(id: string): Promise<void> {
	await pg.delete(accessRule).where(eq(accessRule.id, id));
}

export async function groupIdsOf(userId: string): Promise<string[]> {
	const rows = await pg
		.select({ groupId: userGroupMember.groupId })
		.from(userGroupMember)
		.where(eq(userGroupMember.userId, userId));
	return rows.map((row) => row.groupId);
}

export async function listGroups(): Promise<GroupWithMembers[]> {
	const [groups, members] = await Promise.all([
		pg.select().from(userGroup).orderBy(asc(userGroup.name)),
		pg
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
	const existing = await pg
		.select({ id: userGroup.id })
		.from(userGroup)
		.where(eq(userGroup.name, name));
	if (existing.length) return null;
	const id = crypto.randomUUID();
	await pg.insert(userGroup).values({ id, name });
	return id;
}

/** Deletes a group with its memberships and the rules that name it. */
export async function deleteGroup(id: string): Promise<void> {
	await pg
		.delete(accessRule)
		.where(and(eq(accessRule.subjectType, 'group'), eq(accessRule.subjectId, id)));
	await pg.delete(userGroup).where(eq(userGroup.id, id));
}

export async function addMember(groupId: string, userId: string): Promise<void> {
	await pg.insert(userGroupMember).values({ groupId, userId }).onConflictDoNothing();
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
	await pg
		.delete(userGroupMember)
		.where(and(eq(userGroupMember.groupId, groupId), eq(userGroupMember.userId, userId)));
}

export async function listUsers(): Promise<UserRow[]> {
	return pg
		.select({ id: user.id, name: user.name, email: user.email, role: user.role })
		.from(user)
		.orderBy(asc(user.name));
}

export async function getUserRole(userId: string): Promise<string | null> {
	const rows = await pg.select({ role: user.role }).from(user).where(eq(user.id, userId));
	return rows[0]?.role ?? null;
}

export async function setUserRole(userId: string, role: 'admin' | 'member'): Promise<void> {
	await pg.update(user).set({ role }).where(eq(user.id, userId));
}
