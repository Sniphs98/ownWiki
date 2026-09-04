<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { slugifyPath } from '$lib/slug';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let title = $state('');
	const path = $derived(slugifyPath(title));

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!path) return;
		open = false;
		// Capture both before resetting `title` below — `path` is derived from
		// it, so clearing `title` first would resolve against an empty path.
		const targetPath = path;
		const targetTitle = title.trim();
		title = '';
		const destination = new URL(
			resolve('/(app)/w/[...path]/edit', { path: targetPath }),
			window.location.origin
		);
		destination.searchParams.set('title', targetTitle);
		// The pathname is already resolved above; the rule can't see that
		// through the URL object.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(destination);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Neue Seite</Dialog.Title>
			<Dialog.Description>
				Nutze "/" um die Seite in einem Ordner abzulegen, z. B. "Personal/Kündigung".
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={submit}>
			<Field.FieldGroup>
				<Field.Field>
					<Field.FieldLabel for="new-page-title">Titel</Field.FieldLabel>
					<Input id="new-page-title" bind:value={title} required />
					{#if path}
						<Field.FieldDescription>Pfad: /w/{path}</Field.FieldDescription>
					{/if}
				</Field.Field>
			</Field.FieldGroup>
			<Dialog.Footer class="mt-4">
				<Button type="submit" disabled={!path}>Erstellen</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
