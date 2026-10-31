<!--
	@component
	Picks one of many options, e.g. a person or group: a button that opens a
	filterable list (shadcn Command in a Popover), with optional groups. The
	choice is submitted as a hidden form field named `name`.
-->
<script lang="ts" module>
	export interface PickerOption {
		value: string;
		label: string;
		/** Shown after the label, and searched too, e.g. an email address. */
		hint?: string;
		/** Options with the same group are listed under it as a heading. */
		group?: string;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	let {
		name,
		options,
		value = $bindable(''),
		label,
		placeholder = 'Auswählen …',
		searchPlaceholder = 'Suchen …',
		empty = 'Nichts gefunden.',
		class: className
	}: {
		name: string;
		options: PickerOption[];
		value?: string;
		/** Names the button for screen readers. */
		label: string;
		placeholder?: string;
		searchPlaceholder?: string;
		empty?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);

	const selected = $derived(options.find((option) => option.value === value));
	/** The options by group, in the order they come. */
	const groups = $derived(
		options.reduce<{ heading?: string; options: PickerOption[] }[]>((all, option) => {
			const last = all.at(-1);
			if (last && last.heading === option.group) last.options.push(option);
			else all.push({ heading: option.group, options: [option] });
			return all;
		}, [])
	);

	async function choose(option: PickerOption) {
		value = option.value;
		open = false;
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
				class={cn('min-w-40 justify-between font-normal', className)}
			>
				<span class={cn('truncate', !selected && 'text-muted-foreground')}>
					{selected?.label ?? placeholder}
				</span>
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-anchor-width) min-w-64 p-0" align="start">
		<Command.Root>
			<Command.Input placeholder={searchPlaceholder} />
			<Command.List>
				<Command.Empty>{empty}</Command.Empty>
				{#each groups as group, i (group.heading ?? i)}
					<Command.Group heading={group.heading}>
						{#each group.options as option (option.value)}
							<Command.Item
								value={option.value}
								keywords={[option.label, option.hint ?? '']}
								onSelect={() => choose(option)}
							>
								<CheckIcon class={cn(value !== option.value && 'text-transparent')} />
								<span class="truncate">{option.label}</span>
								{#if option.hint}
									<span class="truncate text-muted-foreground">{option.hint}</span>
								{/if}
							</Command.Item>
						{/each}
					</Command.Group>
				{/each}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
