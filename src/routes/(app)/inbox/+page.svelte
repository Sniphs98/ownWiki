<script lang="ts">
	import { enhance } from '$app/forms';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	let { data, form } = $props();

	const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<svelte:head>
	<title>Inbox · ownWiki</title>
</svelte:head>

<div class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
	<div>
		<h1 class="text-2xl font-semibold">Inbox</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Schnelle Notizen, die noch keinen Platz im Wiki haben – nur du siehst sie. Auch ein
			verbundener KI-Assistent kann hier etwas für dich notieren. Später sortierst du sie in eine
			Seite ein.
		</p>
	</div>

	{#if form?.message}
		<p class="rounded-lg border border-destructive/50 px-3 py-2 text-sm text-destructive">
			{form.message}
		</p>
	{/if}

	<form method="post" action="?/add" use:enhance class="flex flex-col gap-2">
		<textarea
			name="content"
			rows="3"
			placeholder="Was willst du festhalten?"
			aria-label="Neue Notiz"
			class="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
			value={form && 'content' in form && typeof form.content === 'string' ? form.content : ''}
		></textarea>
		<div class="flex justify-end">
			<Button type="submit">Notieren</Button>
		</div>
	</form>

	<datalist id="inbox-paths">
		{#each data.paths as path (path)}
			<option value={path}></option>
		{/each}
	</datalist>

	{#if data.notes.length === 0}
		<p class="text-sm text-muted-foreground">Die Inbox ist leer.</p>
	{:else}
		<ol class="flex flex-col gap-3" aria-label="Notizen">
			{#each data.notes as note (note.id)}
				<li class="rounded-lg border p-4">
					<p class="text-sm whitespace-pre-wrap">{note.content}</p>
					<p class="mt-2 text-xs text-muted-foreground">
						{dateFormat.format(note.createdAt)}{note.via ? ` · über ${note.via}` : ''}
					</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<form method="post" action="?/file" use:enhance class="flex flex-1 gap-2">
							<input type="hidden" name="noteId" value={note.id} />
							<Input
								name="path"
								list="inbox-paths"
								required
								placeholder="Seite, z. B. projekte/ideen"
								aria-label="Einsortieren in Seite"
								class="min-w-48 flex-1"
							/>
							<Button type="submit" variant="outline">Einsortieren</Button>
						</form>
						<form method="post" action="?/delete" use:enhance>
							<input type="hidden" name="noteId" value={note.id} />
							<Button
								type="submit"
								variant="ghost"
								size="icon"
								aria-label="Notiz löschen"
								title="Notiz löschen"
							>
								<Trash2Icon />
							</Button>
						</form>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>
