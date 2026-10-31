<!--
	@component
	Moves a page or folder, with everything below it, to another folder or
	name. Shows beforehand where it ends up, what goes along, that links stay
	valid, and who would gain or lose reading it under the new area's rules.
-->
<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import { resolve } from '$app/paths';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import PagePathPicker from './page-path-picker.svelte';
	import { withAreas } from '$lib/page-paths';
	import { slugifyPath } from '$lib/slug';
	import type { ReadersChange } from '$lib/access';
	import type { ActionResult } from '@sveltejs/kit';
	import { withBase } from '$lib/base-path';

	let {
		open = $bindable(false),
		path,
		title,
		pagePaths
	}: {
		open?: boolean;
		/** What is moved: a page or a folder. */
		path: string;
		title: string;
		/** All pages the person sees, to pick the new folder from. */
		pagePaths: string[];
	} = $props();

	type Preview =
		| { ok: true; to: string; pages: number; backlinks: number; readers: ReadersChange }
		| { ok: false; message: string };

	// Mounted when opened (see the callers), so it starts from where it is now.
	let folder = $state(initialFolder());
	let name = $state(initialName());
	let preview = $state<Preview | null>(null);
	let moving = $state(false);
	let errorMessage = $state('');

	function initialFolder() {
		return path.split('/').slice(0, -1).join('/');
	}

	function initialName() {
		return path.split('/').at(-1) ?? '';
	}

	/** Folders to move into: anywhere but into itself. */
	const folders = $derived(
		withAreas(pagePaths).filter((p) => p !== path && !p.startsWith(`${path}/`))
	);
	const target = $derived.by(() => {
		const slug = slugifyPath(name);
		return slug && folder ? `${folder}/${slug}` : slug;
	});

	// Asks the server what the move would do, a moment after the last keystroke.
	$effect(() => {
		// Unchanged yet: nothing to show, nothing to move.
		if (!open || !target || target === path) {
			preview = null;
			return;
		}
		const query = new URLSearchParams({ from: path, to: target });
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(withBase(`/api/move?${query}`), {
					signal: controller.signal
				});
				preview = (await response.json()) as Preview;
			} catch {
				// Superseded by the next keystroke, or offline: no preview.
			}
		}, 200);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	const readersChanged = $derived(
		preview?.ok === true &&
			(preview.readers.gained.length > 0 ||
				preview.readers.lost.length > 0 ||
				preview.readers.withoutLogin !== null)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!preview?.ok || moving) return;
		moving = true;
		errorMessage = '';

		const body = new FormData();
		body.set('to', preview.to);
		const response = await fetch(`${resolve('/(app)/w/[...path]', { path })}?/move`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result: ActionResult = deserialize(await response.text());
		moving = false;

		if (result.type === 'redirect') {
			open = false;
			await invalidateAll();
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- the moved page's address, from the server
			await goto(result.location);
			return;
		}
		errorMessage =
			result.type === 'failure'
				? ((result.data as { moveError?: string } | undefined)?.moveError ??
					'Verschieben fehlgeschlagen.')
				: 'Unerwarteter Fehler beim Verschieben.';
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>„{title}“ verschieben</Dialog.Title>
			<Dialog.Description>
				Unterseiten wandern mit. Links auf die Seite bleiben gültig, alte Adressen leiten weiter.
			</Dialog.Description>
		</Dialog.Header>
		<form onsubmit={submit}>
			<Field.FieldGroup>
				<Field.Field>
					<Field.FieldLabel>In Ordner</Field.FieldLabel>
					<PagePathPicker
						name="folder"
						bind:value={folder}
						paths={folders}
						label="In Ordner"
						emptyOption="Oberste Ebene"
						newLabel="Neuer Ordner"
					/>
				</Field.Field>
				<Field.Field data-invalid={preview?.ok === false || !!errorMessage}>
					<Field.FieldLabel for="move-name">Name in der Adresse</Field.FieldLabel>
					<Input id="move-name" bind:value={name} required autocomplete="off" />
					{#if preview?.ok}
						<Field.FieldDescription>
							Neue Adresse: /w/{preview.to}
							{#if preview.pages > 1}
								· {preview.pages - 1}
								{preview.pages === 2 ? 'Unterseite wandert' : 'Unterseiten wandern'} mit
							{/if}
							{#if preview.backlinks > 0}
								· {preview.backlinks}
								{preview.backlinks === 1 ? 'Seite verlinkt' : 'Seiten verlinken'} hierher, die Links bleiben
								gültig
							{/if}
						</Field.FieldDescription>
					{:else if preview?.ok === false}
						<Field.FieldError>{preview.message}</Field.FieldError>
					{/if}
					{#if errorMessage}
						<Field.FieldError>{errorMessage}</Field.FieldError>
					{/if}
				</Field.Field>
			</Field.FieldGroup>

			{#if preview?.ok && readersChanged}
				<Alert.Root class="mt-4">
					<TriangleAlertIcon />
					<Alert.Title>Am neuen Ort gelten andere Leserechte</Alert.Title>
					<Alert.Description>
						<ul class="list-disc pl-4">
							{#if preview.readers.gained.length > 0}
								<li>Neu lesen dürfen: {preview.readers.gained.join(', ')}</li>
							{/if}
							{#if preview.readers.lost.length > 0}
								<li>Nicht mehr lesen dürfen: {preview.readers.lost.join(', ')}</li>
							{/if}
							{#if preview.readers.withoutLogin === 'gained'}
								<li>Auch ohne Anmeldung lesbar</li>
							{:else if preview.readers.withoutLogin === 'lost'}
								<li>Ohne Anmeldung nicht mehr lesbar</li>
							{/if}
						</ul>
					</Alert.Description>
				</Alert.Root>
			{/if}

			<Dialog.Footer class="mt-4">
				<Button type="button" variant="ghost" onclick={() => (open = false)}>Abbrechen</Button>
				<Button type="submit" disabled={!preview?.ok || moving}>
					{moving ? 'Wird verschoben …' : 'Verschieben'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
