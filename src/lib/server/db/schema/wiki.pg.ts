import { relations } from 'drizzle-orm';
import {
	pgTable,
	text,
	integer,
	timestamp,
	customType,
	uniqueIndex,
	index
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
