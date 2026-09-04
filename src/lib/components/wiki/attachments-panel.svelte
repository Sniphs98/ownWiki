<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import type { AttachmentMeta } from '$lib/server/repo/attachments';

	let {
		pageId,
		attachments,
		canEdit
	}: { pageId: string; attachments: AttachmentMeta[]; canEdit: boolean } = $props();

	let uploading = $state(false);
	let errorMessage = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		uploading = true;
		errorMessage = '';

		try {
			for (const file of files) {
				const body = new FormData();
				body.set('file', file);
				body.set('pageId', pageId);
				const response = await fetch('/api/files', { method: 'POST', body });
				if (!response.ok) {
					errorMessage = (await response.text().catch(() => '')) || 'Upload fehlgeschlagen.';
				}
			}
			await invalidateAll();
		} finally {
			uploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function remove(id: string) {
		await fetch(`/api/files/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-base">Anhänge</Card.Title>
		<Card.Description>Dateien, die an dieser Seite hängen (unabhängig vom Text).</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-2">
		{#if attachments.length === 0}
			<p class="text-sm text-muted-foreground">Noch keine Anhänge.</p>
		{/if}
		{#each attachments as file (file.id)}
			<div class="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
				<div class="flex min-w-0 items-center gap-2">
					<PaperclipIcon class="shrink-0 text-muted-foreground" />
					<span class="truncate">{file.filename}</span>
					<span class="shrink-0 text-xs text-muted-foreground">{formatSize(file.size)}</span>
				</div>
				<div class="flex shrink-0 items-center gap-1">
					<Button
						href="/api/files/{file.id}"
						download={file.filename}
						variant="ghost"
						size="icon-sm"
					>
						<DownloadIcon />
						<span class="sr-only">Herunterladen</span>
					</Button>
					{#if canEdit}
						<Button onclick={() => remove(file.id)} variant="ghost" size="icon-sm">
							<Trash2Icon />
							<span class="sr-only">Löschen</span>
						</Button>
					{/if}
				</div>
			</div>
		{/each}
		{#if errorMessage}
			<p class="text-sm text-destructive">{errorMessage}</p>
		{/if}
	</Card.Content>
	{#if canEdit}
		<Card.Footer>
			<input
				bind:this={fileInput}
				type="file"
				multiple
				class="hidden"
				onchange={(event) => handleFiles(event.currentTarget.files)}
			/>
			<Button variant="outline" size="sm" disabled={uploading} onclick={() => fileInput?.click()}>
				{uploading ? 'Lädt hoch …' : 'Datei hochladen'}
			</Button>
		</Card.Footer>
	{/if}
</Card.Root>
