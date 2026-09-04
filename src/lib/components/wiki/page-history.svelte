<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import MarkdownEditor from './markdown-editor.svelte';
	import HistoryIcon from '@lucide/svelte/icons/history';

	interface VersionEntry {
		versionNumber: number;
		title: string;
		content: string;
		changeSummary: string | null;
		createdAt: Date;
	}

	let {
		data
	}: {
		data: {
			page: { title: string; path: string };
			versions: VersionEntry[];
			authMode: string;
			user?: { id: string };
		};
	} = $props();

	const canEdit = $derived(data.authMode === 'disabled' || !!data.user);
	const latestVersionNumber = data.versions[0]?.versionNumber;

	let selected = $state(latestVersionNumber);
	const selectedVersion = $derived(data.versions.find((v) => v.versionNumber === selected));

	let restoring = $state(false);
</script>

<svelte:head>
	<title>Versionen von {data.page.title} · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-5xl p-8">
	<div class="mb-6 flex items-center justify-between gap-4">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-bold">
				<HistoryIcon />
				Versionsverlauf
			</h1>
			<p class="text-sm text-muted-foreground">{data.page.title}</p>
		</div>
		<Button href={resolve('/(app)/w/[...path]', { path: data.page.path })} variant="outline">
			Zurück zur Seite
		</Button>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
		<div class="flex flex-col gap-2">
			{#each data.versions as version (version.versionNumber)}
				<button
					type="button"
					onclick={() => (selected = version.versionNumber)}
					class="rounded-md border px-3 py-2 text-left text-sm transition-colors {selected ===
					version.versionNumber
						? 'border-primary bg-muted'
						: 'hover:bg-muted/50'}"
				>
					<div class="flex items-center gap-2 font-medium">
						Version {version.versionNumber}
						{#if version.versionNumber === latestVersionNumber}
							<Badge variant="secondary">aktuell</Badge>
						{/if}
					</div>
					<div class="text-xs text-muted-foreground">
						{version.createdAt.toLocaleString('de-DE')}
					</div>
					{#if version.changeSummary}
						<div class="mt-1 text-xs italic">{version.changeSummary}</div>
					{/if}
				</button>
			{/each}
		</div>

		<div>
			{#if selectedVersion}
				<div class="mb-3 flex items-center justify-between gap-4">
					<h2 class="font-semibold">{selectedVersion.title}</h2>
					{#if canEdit && selectedVersion.versionNumber !== latestVersionNumber}
						<form
							method="post"
							action="?/restore"
							use:enhance={() => {
								restoring = true;
								return async ({ update }) => {
									await update();
									restoring = false;
								};
							}}
						>
							<input type="hidden" name="versionNumber" value={selectedVersion.versionNumber} />
							<Button type="submit" size="sm" disabled={restoring}>
								{restoring ? 'Stellt wieder her …' : 'Diese Version wiederherstellen'}
							</Button>
						</form>
					{/if}
				</div>
				{#key selectedVersion.versionNumber}
					<MarkdownEditor value={selectedVersion.content} readonly />
				{/key}
			{/if}
		</div>
	</div>
</div>
