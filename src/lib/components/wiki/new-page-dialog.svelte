<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { resolve } from '$app/paths';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { slugifyPath } from '$lib/slug';
	import type { ActionResult } from '@sveltejs/kit';

	let {
		open = $bindable(false),
		parentPath,
		parentTitle
	}: { open?: boolean; parentPath?: string; parentTitle?: string } = $props();

	let name = $state('');
	let creating = $state(false);
	let errorMessage = $state('');

	const path = $derived.by(() => {
		const slug = slugifyPath(name);
		if (!slug) return '';
		return parentPath ? `${parentPath}/${slug}` : slug;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!path || creating) return;

		creating = true;
		errorMessage = '';

		const targetTitle = name.trim();
		const targetPath = path;

		const body = new FormData();
		body.set('title', targetTitle);
		body.set('content', `# ${targetTitle}\n\nSchreibe hier deinen Inhalt ...`);

		const actionUrl = `${resolve('/(app)/w/[...path]/edit', { path: targetPath })}?/save`;
		const response = await fetch(actionUrl, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result: ActionResult = deserialize(await response.text());

		creating = false;

		if (result.type === 'failure') {
			errorMessage =
				(result.data as { message?: string } | undefined)?.message ?? 'Anlegen fehlgeschlagen.';
			return;
		}
		if (result.type === 'error') {
			errorMessage = 'Unerwarteter Fehler beim Anlegen.';
			return;
		}

		name = '';
		open = false;
		await invalidateAll();
		goto(resolve('/(app)/w/[...path]/edit', { path: targetPath }));
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{parentPath ? 'Neue Unterseite' : 'Neue Seite'}</Dialog.Title>
			<Dialog.Description>
				{#if parentPath}
					Wird als Unterseite von „{parentTitle}" angelegt.
				{:else}
					Sie wird sofort mit einem Platzhaltertext angelegt — du kannst den Inhalt danach jederzeit
					anpassen.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={submit}>
			<Field.FieldGroup>
				<Field.Field data-invalid={!!errorMessage}>
					<Field.FieldLabel for="new-page-title">Name</Field.FieldLabel>
					<Input id="new-page-title" bind:value={name} required />
					{#if path}
						<Field.FieldDescription>Adresse: /w/{path}</Field.FieldDescription>
					{/if}
					{#if errorMessage}
						<Field.FieldError>{errorMessage}</Field.FieldError>
					{/if}
				</Field.Field>
			</Field.FieldGroup>
			<Dialog.Footer class="mt-4">
				<Button type="submit" disabled={!path || creating}>
					{creating ? 'Wird angelegt …' : 'Erstellen'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
