import { describe, expect, it } from 'vitest';
import { accessLevel, areasOf, type AccessRule, type Viewer } from './access';

const viewer = (overrides: Partial<Viewer> = {}): Viewer => ({
	userId: 'erika',
	isAdmin: false,
	groupIds: [],
	ceiling: 'edit',
	...overrides
});

const rule = (
	path: string,
	subject: 'everyone' | `group:${string}` | `user:${string}`,
	level: AccessRule['level']
): AccessRule => {
	const [subjectType, subjectId = ''] = subject.split(':') as [AccessRule['subjectType'], string?];
	return { path, subjectType, subjectId, level };
};

describe('areasOf', () => {
	it('lists the page, its parents and the whole wiki, nearest first', () => {
		expect(areasOf('personal/gehaelter/2026')).toEqual([
			'personal/gehaelter/2026',
			'personal/gehaelter',
			'personal',
			''
		]);
		expect(areasOf('')).toEqual(['']);
	});
});

describe('accessLevel', () => {
	it('lets everyone edit while there are no rules', () => {
		expect(accessLevel('irgendwas', viewer(), [])).toBe('edit');
		expect(accessLevel('irgendwas', viewer({ userId: undefined }), [])).toBe('edit');
	});

	it('applies a rule to everything below its area', () => {
		const rules = [rule('personal', 'everyone', 'none')];
		expect(accessLevel('personal', viewer(), rules)).toBe('none');
		expect(accessLevel('personal/kuendigung', viewer(), rules)).toBe('none');
		expect(accessLevel('personalabteilung', viewer(), rules)).toBe('edit');
	});

	it('takes the nearest rule for each subject', () => {
		const rules = [rule('', 'everyone', 'read'), rule('handbuch', 'everyone', 'edit')];
		expect(accessLevel('handbuch/kapitel', viewer(), rules)).toBe('edit');
		expect(accessLevel('news', viewer(), rules)).toBe('read');
	});

	it('lets a group open an area that is closed to everyone', () => {
		const rules = [rule('personal', 'everyone', 'none'), rule('personal', 'group:hr', 'edit')];
		expect(accessLevel('personal/x', viewer({ groupIds: ['hr'] }), rules)).toBe('edit');
		expect(accessLevel('personal/x', viewer({ groupIds: ['it'] }), rules)).toBe('none');
	});

	it('keeps a group’s rule from a parent area over everyone’s nearer one', () => {
		const rules = [
			rule('personal', 'everyone', 'none'),
			rule('personal', 'group:hr', 'edit'),
			rule('personal/aushang', 'everyone', 'read')
		];
		expect(accessLevel('personal/aushang', viewer({ groupIds: ['hr'] }), rules)).toBe('edit');
		expect(accessLevel('personal/aushang', viewer(), rules)).toBe('read');
	});

	it('closes a sub-area to a group with a nearer rule for that group', () => {
		const rules = [
			rule('personal', 'group:hr', 'edit'),
			rule('personal/gehaelter', 'group:hr', 'none'),
			rule('personal/gehaelter', 'group:hr-leitung', 'edit')
		];
		expect(accessLevel('personal/gehaelter', viewer({ groupIds: ['hr'] }), rules)).toBe('none');
		expect(
			accessLevel('personal/gehaelter', viewer({ groupIds: ['hr', 'hr-leitung'] }), rules)
		).toBe('edit');
	});

	it('gives the most generous of several groups', () => {
		const rules = [
			rule('kunden', 'group:vertrieb', 'read'),
			rule('kunden', 'group:support', 'edit')
		];
		expect(accessLevel('kunden', viewer({ groupIds: ['vertrieb', 'support'] }), rules)).toBe(
			'edit'
		);
	});

	it('puts a person’s own rule above their groups', () => {
		const rules = [rule('personal', 'group:hr', 'edit'), rule('personal', 'user:erika', 'read')];
		expect(accessLevel('personal', viewer({ groupIds: ['hr'] }), rules)).toBe('read');
		const opened = [rule('personal', 'everyone', 'none'), rule('personal', 'user:erika', 'edit')];
		expect(accessLevel('personal', viewer(), opened)).toBe('edit');
	});

	it('never goes above the ceiling', () => {
		expect(accessLevel('x', viewer({ userId: undefined, ceiling: 'read' }), [])).toBe('read');
		const rules = [rule('', 'everyone', 'none')];
		expect(accessLevel('x', viewer({ ceiling: 'read' }), rules)).toBe('none');
	});

	it('lets admins edit everything', () => {
		const rules = [rule('', 'everyone', 'none'), rule('', 'user:erika', 'none')];
		expect(accessLevel('geheim', viewer({ isAdmin: true }), rules)).toBe('edit');
	});
});
