<!--
	@component
	Picks a page path: a button that opens a filterable list (shadcn Command
	in a Popover). Typing a path that isn't listed offers it as a new one.
	The choice is submitted as a hidden form field named `name`.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { slugifyPath } from '$lib/slug';
	import { cn } from '$lib/utils';

	let {
		name,
		paths,
		value = $bindable(''),
		label,
		placeholder = 'Seite wählen …',
		newLabel = 'Neue Seite',
		/** Shown for the empty value, if choosing nothing means something (e.g. the whole wiki). */
		emptyOption,
		class: className
	}: {
		name: string;
		paths: string[];
		value?: string;
		/** Names the button for screen readers. */
		label: string;
		placeholder?: string;
		/** What a typed, unlisted path is offered as. */
		newLabel?: string;
		emptyOption?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let trigger = $state<HTMLButtonElement | null>(null);

	// An empty path is no page (only old data has one); emptyOption stands for "nothing".
	const options = $derived(paths.filter(Boolean));
	/** The typed text as a path, when it isn't one of the listed ones. */
	const typed = $derived(slugifyPath(search.trim()));
	const offerTyped = $derived(typed !== '' && !options.includes(typed));

	async function choose(path: string) {
		value = path;
		open = false;
		search = '';
		// Back to the button, so keyboard users carry on where they were.
		await tick();
		trigger?.focus();
	}
</script>

<input type="hidden" {name} {value} />

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={trigger}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				aria-label={label}
				class={cn('min-w-48 justify-between font-normal', className)}
			>
				<span class={cn('truncate', !value && !emptyOption && 'text-muted-foreground')}>
					{value || emptyOption || placeholder}
				</span>
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-anchor-width) min-w-72 p-0" align="start">
		<Command.Root>
			<!-- Read through oninput: bind:value doesn't reach back out of the generated command-input. -->
			<Command.Input
				value={search}
				oninput={(event) => (search = event.currentTarget.value)}
				placeholder="Pfad suchen oder eingeben …"
			/>
			<Command.List>
				{#if offerTyped}
					<!-- Shown whatever the filter says: it only appears once typed. -->
					<Command.Group forceMount>
						<Command.Item value={`neu:${typed}`} forceMount onSelect={() => choose(typed)}>
							<PlusIcon />
							{newLabel}: {typed}
						</Command.Item>
					</Command.Group>
				{:else}
					<Command.Empty>Keine passende Seite.</Command.Empty>
				{/if}
				<Command.Group>
					{#if emptyOption}
						<Command.Item value={emptyOption} onSelect={() => choose('')}>
							<CheckIcon class={cn(value !== '' && 'text-transparent')} />
							{emptyOption}
						</Command.Item>
					{/if}
					{#each options as path (path)}
						<Command.Item value={path} onSelect={() => choose(path)}>
							<CheckIcon class={cn(value !== path && 'text-transparent')} />
							{path}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
