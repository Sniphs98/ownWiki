import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql' ? await import('./access.pg') : await import('./access.sqlite');

export const listRules = impl.listRules;
export const setRule = impl.setRule;
export const deleteRule = impl.deleteRule;
export const groupIdsOf = impl.groupIdsOf;
export const listGroups = impl.listGroups;
export const createGroup = impl.createGroup;
export const deleteGroup = impl.deleteGroup;
export const addMember = impl.addMember;
export const removeMember = impl.removeMember;
export const listUsers = impl.listUsers;
export const getUserRole = impl.getUserRole;
export const setUserRole = impl.setUserRole;

export type { GroupWithMembers, Person, StoredRule, UserRow } from './access.types';
