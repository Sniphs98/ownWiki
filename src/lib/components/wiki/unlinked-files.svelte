<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button';
	import * as Alert from '$lib/components/ui/alert';
	import type { AttachmentMeta } from '$lib/server/repo/attachments';

	/**
	 * Files belong in the text, inserted via "/" → Datei. This lists the
	 * page's files that the text (as currently edited) doesn't link or show
	 * anywhere — e.g. after their link was deleted, or files attached before
	 * that existed — so they can be put back or deleted for good.
	 */
	let {
		attachments,
		content,
		oninsert
	}: {
		attachments: AttachmentMeta[];
		/** The page's current (unsaved) markdown. */
		content: string;
		oninsert: (file: AttachmentMeta) => void;
	} = $props();

	const unlinked = $derived(
		attachments.filter((file) => !content.includes(`/api/files/${file.id}`))
	);

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	async function remove(file: AttachmentMeta) {
		const confirmed = confirm(
			`„${file.filename}“ endgültig löschen? Ältere Versionen der Seite, die die Datei verlinken, verlieren sie dann ebenfalls.`
		);
		if (!confirmed) return;
		await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
		await invalidateAll();
	}
</script>

{#if unlinked.length > 0}
	<Alert.Root>
		<PaperclipIcon />
		<Alert.Title>Dateien, die nicht im Text vorkommen</Alert.Title>
		<Alert.Description>
			<p>
				Sie gehören zu dieser Seite, sind aber nirgends verlinkt. Füge sie an der Cursor-Stelle ein
				oder lösche sie.
			</p>
			<ul class="mt-2 flex w-full flex-col gap-1">
				{#each unlinked as file (file.id)}
					<li class="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
						<span class="min-w-0 truncate text-foreground">
							<!-- Lets you check what the file is before deciding. -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- file download -->
							<a href="/api/files/{file.id}" target="_blank" class="hover:underline">
								{file.filename}
							</a>
							<span class="ml-1 text-xs text-muted-foreground">{formatSize(file.size)}</span>
						</span>
						<span class="flex shrink-0 items-center gap-1">
							<Button
								variant="outline"
								size="sm"
								aria-label="„{file.filename}“ einfügen"
								onclick={() => oninsert(file)}>Einfügen</Button
							>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="„{file.filename}“ löschen"
								title="Löschen"
								onclick={() => remove(file)}
							>
								<Trash2Icon />
							</Button>
						</span>
					</li>
				{/each}
			</ul>
		</Alert.Description>
	</Alert.Root>
{/if}
