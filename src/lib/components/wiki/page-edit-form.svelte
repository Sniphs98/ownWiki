<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Alert from '$lib/components/ui/alert';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import MarkdownEditor from './markdown-editor.svelte';
	import PageBreakMarkers from './page-break-markers.svelte';
	import PageBreakToggle from './page-break-toggle.svelte';
	import { toolbarSetting } from '$lib/toolbar-setting.svelte';
	import UnlinkedFiles from './unlinked-files.svelte';
	import { titleFromMarkdown } from '$lib/page-title';
	import { parseTags } from '$lib/tags';
	import type { AttachmentMeta } from '$lib/server/repo/attachments';

	let {
		path,
		pageId,
		pageExists,
		hasChildren,
		existingTitle,
		existingContent,
		existingTags,
		linkPages,
		nextVersionNumber,
		attachments,
		errorMessage,
		conflictVersion
	}: {
		path: string;
		pageId?: string;
		pageExists: boolean;
		hasChildren: boolean;
		existingTitle: string;
		existingContent: string;
		existingTags: string[];
		/** The pages to suggest while typing a `[[wiki link]]`. */
		linkPages: { path: string; title: string }[];
		/** Version number this save will create — shown in the PDF page header. */
		nextVersionNumber: number;
		attachments: AttachmentMeta[];
		errorMessage?: string;
		/** Set when someone else saved meanwhile: the version that would be overwritten. */
		conflictVersion?: number;
	} = $props();

	/** The title is the heading on the first line: a new page starts with it. */
	function initialContent() {
		if (pageExists || existingContent || !existingTitle) return existingContent;
		return `# ${existingTitle}\n`;
	}

	let content = $state(initialContent());
	let tags = $state(initialTags());

	function initialTags() {
		return existingTags.join(', ');
	}
	/** Without a heading on top, the page keeps the title it has. */
	const title = $derived(titleFromMarkdown(content) || existingTitle);
	let saving = $state(false);
	let deleting = $state(false);
	let editor: MarkdownEditor | undefined = $state();

	/**
	 * The text as the editor first showed it. Compared with what it shows
	 * now rather than with the stored markdown, which the editor writes a
	 * little differently even when nothing was changed.
	 */
	let initialMarkdown: string | undefined;

	function hasChanges() {
		const tagsChanged = parseTags(tags).join() !== existingTags.join();
		return (
			tagsChanged || (initialMarkdown !== undefined && editor?.getMarkdown() !== initialMarkdown)
		);
	}

	/** Where to go once the changes may be discarded. */
	let leaveTo = $state<{ url: URL; delta?: number } | null>(null);
	let discarded = false;

	beforeNavigate(({ cancel, to, type, delta }) => {
		if (saving || deleting || discarded || !hasChanges()) return;
		cancel();
		// Closing or reloading the tab: cancelling makes the browser ask.
		if (type === 'leave' || !to) return;
		leaveTo = { url: to.url, delta: type === 'popstate' ? delta : undefined };
	});

	function discardAndLeave() {
		if (!leaveTo) return;
		const { url, delta } = leaveTo;
		leaveTo = null;
		discarded = true;
		if (delta) history.go(delta);
		else if (url.origin !== location.origin) location.href = url.href;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- where SvelteKit was about to go
		else goto(url);
	}
</script>

<svelte:head>
	<title>{title || 'Neue Seite'} bearbeiten · ownWiki</title>
</svelte:head>

<form
	method="post"
	action="?/save"
	use:enhance={({ formData }) => {
		// `content` follows the editor with a delay: take what's typed right now.
		if (editor) formData.set('content', editor.getMarkdown());
		saving = true;
		return async ({ update }) => {
			await update();
			saving = false;
		};
	}}
>
	{#if errorMessage}
		<Alert.Root variant="destructive" class="mb-4">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}

	<input type="hidden" name="content" value={content} />
	<!-- The version this edit is based on; the save is refused if the page has moved on. -->
	<input type="hidden" name="baseVersion" value={nextVersionNumber - 1} />

	<div class="flex justify-end">
		<PageBreakToggle />
	</div>

	<div class="mt-2">
		<PageBreakMarkers {title} versionNumber={nextVersionNumber} updatedAt={new Date()} {content}>
			<MarkdownEditor
				bind:this={editor}
				bind:value={content}
				{pageId}
				toolbar={toolbarSetting.layout}
				tocPath={path}
				{linkPages}
				onready={() => (initialMarkdown = editor?.getMarkdown())}
				onupload={() => invalidateAll()}
			/>
		</PageBreakMarkers>
	</div>

	<div class="mt-4 flex flex-col gap-1 text-sm">
		<label for="page-tags" class="font-medium">Tags</label>
		<Input
			id="page-tags"
			name="tags"
			bind:value={tags}
			placeholder="z. B. hr, urlaub, prozess"
			autocomplete="off"
			aria-describedby="page-tags-hint"
		/>
		<span id="page-tags-hint" class="text-xs text-muted-foreground">Durch Kommas getrennt.</span>
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
						<AlertDialog.Title>Seite "{existingTitle}" löschen?</AlertDialog.Title>
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
			{#if conflictVersion !== undefined}
				<!-- Overrides the hidden baseVersion: a submit button's value wins as it comes last. -->
				<Button
					type="submit"
					name="baseVersion"
					value={String(conflictVersion)}
					variant="destructive"
					disabled={saving}
				>
					Trotzdem speichern
				</Button>
			{/if}
		</div>
	</div>
</form>

{#if pageId}
	<div class="mt-6">
		<UnlinkedFiles
			{attachments}
			{content}
			oninsert={(file) => editor?.insertFileLink(`/api/files/${file.id}`, file.filename)}
		/>
	</div>
{:else}
	<p class="mt-6 text-sm text-muted-foreground">
		Speichere die Seite einmal, um Bilder oder Dateien einzufügen.
	</p>
{/if}

<AlertDialog.Root
	open={leaveTo !== null}
	onOpenChange={(open) => {
		if (!open) leaveTo = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Änderungen verwerfen?</AlertDialog.Title>
			<AlertDialog.Description>
				Deine Änderungen an dieser Seite sind noch nicht gespeichert. Wenn du sie jetzt verlässt,
				gehen sie verloren.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Weiter bearbeiten</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={discardAndLeave}>
				Verwerfen
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
