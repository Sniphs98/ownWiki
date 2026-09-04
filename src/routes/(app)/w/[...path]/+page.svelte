<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from '$lib/components/wiki/markdown-editor.svelte';
	import AttachmentsPanel from '$lib/components/wiki/attachments-panel.svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);
</script>

<svelte:head>
	<title>{data.version.title} · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">{data.version.title}</h1>
			<p class="text-sm text-muted-foreground">
				<a
					href={resolve('/(app)/w/[...path]/history', { path: data.page.path })}
					class="hover:underline"
				>
					Version {data.version.versionNumber}
				</a>
				· zuletzt geändert am {data.page.updatedAt.toLocaleString('de-DE')}
			</p>
		</div>
		<div class="flex shrink-0 gap-2">
			<Button
				href={resolve('/(app)/w/[...path]/history', { path: data.page.path })}
				variant="ghost"
			>
				<HistoryIcon data-icon="inline-start" />
				Verlauf
			</Button>
			{#if canEdit}
				<Button
					href={resolve('/(app)/w/[...path]/edit', { path: data.page.path })}
					variant="outline"
				>
					<PencilIcon data-icon="inline-start" />
					Bearbeiten
				</Button>
			{/if}
		</div>
	</div>
	<MarkdownEditor value={data.version.content} pageId={data.page.id} readonly />

	{#if canEdit || data.attachments.length > 0}
		<div class="mt-6">
			<AttachmentsPanel pageId={data.page.id} attachments={data.attachments} {canEdit} />
		</div>
	{/if}
</div>
