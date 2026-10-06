<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Field from '$lib/components/ui/field';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import MarkdownEditor from './markdown-editor.svelte';
	import PageBreakMarkers from './page-break-markers.svelte';
	import PageBreakToggle from './page-break-toggle.svelte';
	import AttachmentsPanel from './attachments-panel.svelte';
	import type { AttachmentMeta } from '$lib/server/repo/attachments';

	let {
		path,
		pageId,
		pageExists,
		hasChildren,
		existingTitle,
		existingContent,
		nextVersionNumber,
		attachments,
		errorMessage
	}: {
		path: string;
		pageId?: string;
		pageExists: boolean;
		hasChildren: boolean;
		existingTitle: string;
		existingContent: string;
		/** Version number this save will create — shown in the PDF page header. */
		nextVersionNumber: number;
		attachments: AttachmentMeta[];
		errorMessage?: string;
	} = $props();

	let title = $state(existingTitle);
	let content = $state(existingContent);
	let saving = $state(false);
	let deleting = $state(false);
</script>

<svelte:head>
	<title>{title || 'Neue Seite'} bearbeiten · ownWiki</title>
</svelte:head>

<form
	method="post"
	action="?/save"
	use:enhance={() => {
		saving = true;
		return async ({ update }) => {
			await update();
			saving = false;
		};
	}}
>
	<Field.FieldGroup>
		<Field.Field data-invalid={!!errorMessage}>
			<Field.FieldLabel for="edit-title">Titel</Field.FieldLabel>
			<Input id="edit-title" name="title" bind:value={title} required />
			{#if errorMessage}
				<Field.FieldError>{errorMessage}</Field.FieldError>
			{/if}
		</Field.Field>
		<Field.Field>
			<Field.FieldLabel for="edit-change-summary">Änderungshinweis (optional)</Field.FieldLabel>
			<Input
				id="edit-change-summary"
				name="changeSummary"
				placeholder="z. B. Tippfehler korrigiert"
			/>
		</Field.Field>
	</Field.FieldGroup>

	<input type="hidden" name="content" value={content} />

	<div class="mt-4 flex justify-end">
		<PageBreakToggle />
	</div>

	<div class="mt-2">
		<PageBreakMarkers {title} versionNumber={nextVersionNumber} updatedAt={new Date()} {content}>
			<MarkdownEditor bind:value={content} {pageId} />
		</PageBreakMarkers>
	</div>

	<div class="mt-4 flex items-center justify-between gap-2">
		{#if pageExists}
			<AlertDialog.Root>
				<AlertDialog.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" class="text-destructive hover:text-destructive">
							<Trash2Icon data-icon="inline-start" />
							Löschen
						</Button>
					{/snippet}
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Seite "{title}" löschen?</AlertDialog.Title>
						<AlertDialog.Description>
							Das kann nicht rückgängig gemacht werden. Alle Versionen und Anhänge dieser Seite
							werden ebenfalls gelöscht.
							{#if hasChildren}
								Unterseiten bleiben erhalten, verlieren dabei aber ihre übergeordnete Seite.
							{/if}
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
						<form
							method="post"
							action="?/delete"
							use:enhance={() => {
								deleting = true;
								return async ({ update }) => {
									await update();
									deleting = false;
								};
							}}
						>
							<AlertDialog.Action type="submit" disabled={deleting}>
								{deleting ? 'Löscht …' : 'Endgültig löschen'}
							</AlertDialog.Action>
						</form>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{:else}
			<span></span>
		{/if}
		<div class="flex items-center gap-2">
			<Button
				href={pageExists ? resolve('/(app)/w/[...path]', { path }) : resolve('/')}
				variant="ghost"
			>
				Abbrechen
			</Button>
			<Button type="submit" disabled={saving}>{saving ? 'Speichert …' : 'Speichern'}</Button>
		</div>
	</div>
</form>

{#if pageId}
	<div class="mt-6">
		<AttachmentsPanel {pageId} {attachments} canEdit={true} />
	</div>
{:else}
	<p class="mt-6 text-sm text-muted-foreground">
		Speichere die Seite einmal, um Bilder einzufügen oder Dateien anzuhängen.
	</p>
{/if}
