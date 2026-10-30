import { error, fail, redirect } from '@sveltejs/kit';
import { ACCESS_LEVELS, type AccessLevel, type SubjectType } from '$lib/access';
import { slugifyPath } from '$lib/slug';
import { listPages } from '$lib/server/repo/pages';
import {
	addMember,
	createGroup,
	deleteGroup,
	deleteRule,
	listGroups,
	listRules,
	listUsers,
	removeMember,
	setRule,
	setUserRole
} from '$lib/server/repo/access';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** Groups, people and access rules are for admins only. */
function requireAdmin(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	if (!event.locals.user) {
		redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	}
	if (!event.locals.access.isAdmin) error(403, 'Nur für Admins.');
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	const [users, groups, rules, pages] = await Promise.all([
		listUsers(),
		listGroups(),
		listRules(),
		listPages()
	]);
	// Every page and every area above one ("personal" for "personal/kuendigung").
	const areas = new Set(
		pages.flatMap((p) => p.path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/')))
	);
	return { users, groups, rules, paths: [...areas].sort() };
};

const field = (form: FormData, name: string) => form.get(name)?.toString().trim() ?? '';

export const actions: Actions = {
	setRole: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const userId = field(form, 'userId');
		const role = field(form, 'role') === 'admin' ? 'admin' : 'member';
		if (role === 'member') {
			const admins = (await listUsers()).filter((u) => u.role === 'admin');
			if (admins.length === 1 && admins[0].id === userId) {
				return fail(400, { message: 'Es muss mindestens einen Admin geben.' });
			}
		}
		await setUserRole(userId, role);
	},

	createGroup: async (event) => {
		requireAdmin(event);
		const name = field(await event.request.formData(), 'name');
		if (!name) return fail(400, { message: 'Gib der Gruppe einen Namen.' });
		if (!(await createGroup(name.slice(0, 100)))) {
			return fail(400, { message: `Die Gruppe „${name}“ gibt es schon.` });
		}
	},

	deleteGroup: async (event) => {
		requireAdmin(event);
		await deleteGroup(field(await event.request.formData(), 'groupId'));
	},

	addMember: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const groupId = field(form, 'groupId');
		const userId = field(form, 'userId');
		if (!groupId || !userId) return fail(400, { message: 'Wähle eine Person aus.' });
		await addMember(groupId, userId);
	},

	removeMember: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		await removeMember(field(form, 'groupId'), field(form, 'userId'));
	},

	setRule: async (event) => {
		requireAdmin(event);
		const form = await event.request.formData();
		const rawPath = field(form, 'path');
		// Empty: the whole wiki. Otherwise the canonical path pages get.
		const path = rawPath ? slugifyPath(rawPath) : '';
		if (rawPath && !path) return fail(400, { message: `„${rawPath}“ ist kein gültiger Bereich.` });

		// "everyone", "group:<id>" or "user:<id>"
		const [type, subjectId = ''] = field(form, 'subject').split(':');
		const level = field(form, 'level') as AccessLevel;
		const subjectType = type as SubjectType;
		if (
			!['everyone', 'group', 'user'].includes(subjectType) ||
			(subjectType !== 'everyone' && !subjectId) ||
			!ACCESS_LEVELS.includes(level)
		) {
			return fail(400, { message: 'Wähle aus, für wen die Regel gilt und welches Recht.' });
		}
		await setRule({ path, subjectType, subjectId, level });
	},

	deleteRule: async (event) => {
		requireAdmin(event);
		await deleteRule(field(await event.request.formData(), 'ruleId'));
	}
};
