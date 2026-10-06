<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import EditorToolbar, { TOOLBAR_ICONS } from '$lib/components/wiki/editor-toolbar.svelte';
	import { toolbarSetting } from '$lib/toolbar-setting.svelte';
	import {
		SEPARATOR,
		TOOLBAR_ITEMS,
		normalizeToolbar,
		type ToolbarEntry,
		type ToolbarItemKey
	} from '$lib/toolbar';

	let { data } = $props();

	// Edited locally, saved with the button below.
	let draft = $state<ToolbarEntry[]>([...toolbarSetting.layout]);
	let saving = $state(false);
	let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);

	// Pick up the stored layout once it has loaded (the app layout loads it).
	let loadedFrom = toolbarSetting.layout;
	$effect(() => {
		if (toolbarSetting.layout !== loadedFrom) {
			loadedFrom = toolbarSetting.layout;
			draft = [...toolbarSetting.layout];
		}
	});

	const hidden = $derived(
		(Object.keys(TOOLBAR_ITEMS) as ToolbarItemKey[]).filter((key) => !draft.includes(key))
	);
	const changed = $derived(
		JSON.stringify(normalizeToolbar(draft)) !== JSON.stringify(toolbarSetting.layout)
	);

	function move(index: number, by: -1 | 1) {
		const target = index + by;
		if (target < 0 || target >= draft.length) return;
		const next = [...draft];
		[next[index], next[target]] = [next[target], next[index]];
		draft = next;
	}

	function remove(index: number) {
		draft = draft.filter((_, i) => i !== index);
	}

	async function save(layout: ToolbarEntry[] | null) {
		saving = true;
		message = null;
		try {
			await toolbarSetting.save(layout);
			draft = [...toolbarSetting.layout];
			message = { kind: 'ok', text: 'Gespeichert.' };
		} catch (error) {
			message = {
				kind: 'error',
				text: error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'
			};
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Einstellungen · ownWiki</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-8">
	<h1 class="mb-6 text-2xl font-semibold">Einstellungen</h1>

	<Card.Root>
		<Card.Header>
			<Card.Title>Werkzeugleiste</Card.Title>
			<Card.Description>
				Welche Werkzeuge über dem Editor erscheinen, und in welcher Reihenfolge.
				{data.user
					? 'Gilt für dein Konto, auf jedem Gerät.'
					: 'Gilt für diesen Browser; angemeldet wird sie in deinem Konto gespeichert.'}
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			<section aria-label="Vorschau" class="rounded-md border px-2">
				<EditorToolbar layout={normalizeToolbar(draft)} onrun={() => {}} onheading={() => {}} />
			</section>

			<section>
				<h2 class="mb-2 text-sm font-medium">Angezeigt</h2>
				<ol class="flex flex-col gap-1">
					{#each draft as entry, index (index)}
						<li class="flex items-center gap-2 rounded-md border px-2 py-1">
							{#if entry === SEPARATOR}
								<span class="flex-1 text-sm text-muted-foreground">— Trennlinie —</span>
							{:else}
								{@const Icon = TOOLBAR_ICONS[entry]}
								<Icon class="size-4 text-muted-foreground" />
								<span class="flex-1 text-sm">{TOOLBAR_ITEMS[entry]}</span>
							{/if}
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Nach oben"
								title="Nach oben"
								disabled={index === 0}
								onclick={() => move(index, -1)}
							>
								<ArrowUpIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Nach unten"
								title="Nach unten"
								disabled={index === draft.length - 1}
								onclick={() => move(index, 1)}
							>
								<ArrowDownIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={entry === SEPARATOR ? 'Trennlinie entfernen' : 'Ausblenden'}
								title={entry === SEPARATOR ? 'Trennlinie entfernen' : 'Ausblenden'}
								onclick={() => remove(index)}
							>
								<EyeOffIcon />
							</Button>
						</li>
					{/each}
				</ol>
				<Button
					variant="outline"
					size="sm"
					class="mt-2"
					onclick={() => (draft = [...draft, SEPARATOR])}
				>
					<PlusIcon data-icon="inline-start" />
					Trennlinie hinzufügen
				</Button>
			</section>

			{#if hidden.length > 0}
				<section>
					<h2 class="mb-2 text-sm font-medium">Ausgeblendet</h2>
					<ul class="flex flex-col gap-1">
						{#each hidden as key (key)}
							{@const Icon = TOOLBAR_ICONS[key]}
							<li class="flex items-center gap-2 rounded-md border border-dashed px-2 py-1">
								<Icon class="size-4 text-muted-foreground" />
								<span class="flex-1 text-sm text-muted-foreground">{TOOLBAR_ITEMS[key]}</span>
								<Button variant="ghost" size="sm" onclick={() => (draft = [...draft, key])}>
									<PlusIcon data-icon="inline-start" />
									Anzeigen
								</Button>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</Card.Content>
		<Card.Footer class="flex items-center justify-between gap-2">
			<Button variant="ghost" onclick={() => save(null)} disabled={saving}>
				<RotateCcwIcon data-icon="inline-start" />
				Standard wiederherstellen
			</Button>
			<div class="flex items-center gap-3">
				{#if message}
					<span
						role="status"
						class="text-sm {message.kind === 'ok' ? 'text-muted-foreground' : 'text-destructive'}"
					>
						{message.text}
					</span>
				{/if}
				<Button onclick={() => save(draft)} disabled={saving || !changed}>Speichern</Button>
			</div>
		</Card.Footer>
	</Card.Root>
</div>
