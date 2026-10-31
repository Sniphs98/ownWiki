import { relations } from 'drizzle-orm';
import {
	pgTable,
	text,
	integer,
	timestamp,
	customType,
	uniqueIndex,
	index,
	primaryKey
} from 'drizzle-orm/pg-core';
import { user } from './auth.pg';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	}
});

export const page = pgTable(
	'page',
	{
		id: text('id').primaryKey(),
		path: text('path').notNull(),
		// Denormalized from the latest page_version, so the sidebar and page
		// listing don't need a join/window-function per page.
		title: text('title').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [uniqueIndex('page_path_uidx').on(table.path)]
);

export const pageVersion = pgTable(
	'page_version',
	{
		id: text('id').primaryKey(),
		pageId: text('page_id')
			.notNull()
			.references(() => page.id, { onDelete: 'cascade' }),
		versionNumber: integer('version_number').notNull(),
		title: text('title').notNull(),
		content: text('content').notNull(),
		changeSummary: text('change_summary'),
		authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
		// The AI assistant that wrote this version on its author's behalf
		// (its OAuth client name, e.g. "ChatGPT"); null when written by hand.
		via: text('via'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('page_version_page_id_version_number_uidx').on(table.pageId, table.versionNumber),
		index('page_version_page_id_idx').on(table.pageId)
	]
);

export const attachment = pgTable(
	'attachment',
	{
		id: text('id').primaryKey(),
		pageId: text('page_id').references(() => page.id, { onDelete: 'cascade' }),
		filename: text('filename').notNull(),
		mimeType: text('mime_type').notNull(),
		size: integer('size').notNull(),
		data: bytea('data').notNull(),
		uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('attachment_page_id_idx').on(table.pageId)]
);

export const pageRelations = relations(page, ({ many, one }) => ({
	versions: many(pageVersion),
	attachments: many(attachment),
	createdByUser: one(user, { fields: [page.createdBy], references: [user.id] })
}));

export const pageVersionRelations = relations(pageVersion, ({ one }) => ({
	page: one(page, { fields: [pageVersion.pageId], references: [page.id] }),
	author: one(user, { fields: [pageVersion.authorId], references: [user.id] })
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
	page: one(page, { fields: [attachment.pageId], references: [page.id] }),
	uploadedByUser: one(user, { fields: [attachment.uploadedBy], references: [user.id] })
}));

/** Per-user UI settings. One row per user, created on first save. */
export const userPreference = pgTable('user_preference', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	/** JSON array of editor toolbar item keys, see $lib/toolbar.ts. */
	toolbar: text('toolbar'),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

/** A page's own PDF title page (markdown), used instead of the generated cover. */
export const pdfCover = pgTable('pdf_cover', {
	pageId: text('page_id')
		.primaryKey()
		.references(() => page.id, { onDelete: 'cascade' }),
	content: text('content').notNull(),
	/** Alignment on the page, see $lib/cover.ts. */
	alignX: text('align_x').notNull().default('center'),
	alignY: text('align_y').notNull().default('center'),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

/** A named group of people, e.g. "HR" — access rules can name it (see $lib/access.ts). */
export const userGroup = pgTable('user_group', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const userGroupMember = pgTable(
	'user_group_member',
	{
		groupId: text('group_id')
			.notNull()
			.references(() => userGroup.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.groupId, table.userId] }),
		index('user_group_member_user_id_idx').on(table.userId)
	]
);

/**
 * Who may do what in an area of the wiki, see $lib/access.ts. Deleting a
 * group or person doesn't remove their rules here; rules for subjects that
 * no longer exist simply never match.
 */
export const accessRule = pgTable(
	'access_rule',
	{
		id: text('id').primaryKey(),
		/** A page path and everything below it; '' for the whole wiki. */
		path: text('path').notNull(),
		/** 'everyone', 'group' or 'user'. */
		subjectType: text('subject_type').notNull(),
		/** The group's or person's id; '' for everyone. */
		subjectId: text('subject_id').notNull().default(''),
		/** 'none', 'read' or 'edit'. */
		level: text('level').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		uniqueIndex('access_rule_subject_uidx').on(table.path, table.subjectType, table.subjectId)
	]
);

/**
 * What each page's latest version links to, as written (see linkTargets in
 * $lib/wiki-links.ts), and the page each link is bound to — so links
 * survive moves and renames. Kept in step on every save.
 */
export const pageLink = pgTable(
	'page_link',
	{
		pageId: text('page_id')
			.notNull()
			.references(() => page.id, { onDelete: 'cascade' }),
		target: text('target').notNull(),
		/** The page the link meant when saved (see bindTargets); null until it exists. */
		targetPageId: text('target_page_id').references(() => page.id, { onDelete: 'set null' })
	},
	(table) => [
		primaryKey({ columns: [table.pageId, table.target] }),
		index('page_link_target_idx').on(table.target),
		index('page_link_target_page_id_idx').on(table.targetPageId)
	]
);

/** A page's tags (see $lib/tags.ts) — not part of its versions. */
export const pageTag = pgTable(
	'page_tag',
	{
		pageId: text('page_id')
			.notNull()
			.references(() => page.id, { onDelete: 'cascade' }),
		tag: text('tag').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.pageId, table.tag] }),
		index('page_tag_tag_idx').on(table.tag)
	]
);

/**
 * A person's inbox: quick notes, from the /inbox page or an AI assistant,
 * not yet sorted into a page. Only the person sees them.
 */
export const inboxNote = pgTable(
	'inbox_note',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		/** The AI assistant that wrote it (its OAuth client name); null when written by hand. */
		via: text('via'),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('inbox_note_user_id_idx').on(table.userId)]
);

/**
 * What a person pinned in the page tree: a page or a folder, by path —
 * shown first in its level, for them only (see $lib/page-tree.ts).
 */
export const pagePin = pgTable(
	'page_pin',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		path: text('path').notNull()
	},
	(table) => [primaryKey({ columns: [table.userId, table.path] })]
);

/**
 * Where moved pages used to be: an old path leads to the page now. A page
 * created at such a path later takes it over (the redirect goes).
 */
export const pageRedirect = pgTable('page_redirect', {
	path: text('path').primaryKey(),
	pageId: text('page_id')
		.notNull()
		.references(() => page.id, { onDelete: 'cascade' }),
	createdAt: timestamp('created_at').defaultNow().notNull()
});
