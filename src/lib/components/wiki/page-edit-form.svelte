<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Field from '$lib/components/ui/field';
	import MarkdownEditor from './markdown-editor.svelte';

	let {
		path,
		pageExists,
		existingTitle,
		existingContent,
		errorMessage
	}: {
		path: string;
		pageExists: boolean;
		existingTitle: string;
		existingContent: string;
		errorMessage?: string;
	} = $props();

	let title = $state(existingTitle);
	let content = $state(existingContent);
	let saving = $state(false);
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

	<div class="mt-4">
		<MarkdownEditor bind:value={content} />
	</div>

	<div class="mt-4 flex items-center justify-end gap-2">
		<Button
			href={pageExists ? resolve('/(app)/w/[...path]', { path }) : resolve('/')}
			variant="ghost"
		>
			Abbrechen
		</Button>
		<Button type="submit" disabled={saving}>{saving ? 'Speichert …' : 'Speichern'}</Button>
	</div>
</form>
