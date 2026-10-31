import type { AccessRule } from '$lib/access';

export interface StoredRule extends AccessRule {
	id: string;
}

export interface Person {
	id: string;
	name: string;
	email: string;
}

export interface GroupWithMembers {
	id: string;
	name: string;
	members: Person[];
}

export interface UserRow extends Person {
	role: string;
}
