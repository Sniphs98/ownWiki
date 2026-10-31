<script lang="ts">
	import Self from './page-tree-item.svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PinIcon from '@lucide/svelte/icons/pin';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import NewPageDialog from './new-page-dialog.svelte';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { page as currentPage } from '$app/state';
	import type { PageTreeNode } from '$lib/page-tree';
	import { untrack } from 'svelte';
	import { cn } from '$lib/utils';
	import { withBase } from '$lib/base-path';

	let {
		node,
		canEdit = false,
		canPin = false
	}: { node: PageTreeNode; canEdit?: boolean; canPin?: boolean } = $props();

	const href = $derived(resolve('/(app)/w/[...path]', { path: node.fullPath }));
	const isActive = $derived(currentPage.url.pathname === href);
	const isAncestorOfActive = $derived(currentPage.url.pathname.startsWith(href + '/'));

	// Opened for the open page — also when it's reached by a link later on.
	let open = $state(untrack(() => isAncestorOfActive));
	$effect.pre(() => {
		if (isAncestorOfActive) open = true;
	});
	let addOpen = $state(false);

	// Shown while this row is hovered (or reached by keyboard). Not shadcn's
	// showOnHover: that reacts to any menu item around this one, so hovering a
	// folder showed the actions of everything inside it, and a clicked action
	// stayed visible while it kept the focus.
	const ON_HOVER = 'md:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100';

	// The pin sits left of the other actions: the chevron (folders) and "+".
	const PIN_OFFSETS = ['right-1', 'right-6', 'right-11'];
	const pinOffset = $derived(PIN_OFFSETS[(node.children.length > 0 ? 1 : 0) + (canEdit ? 1 : 0)]);
	let pinning = $state(false);

	async function togglePin() {
		pinning = true;
		try {
			await fetch(withBase('/api/pins'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ path: node.fullPath, pinned: !node.pinned })
			});
			await invalidateAll();
		} finally {
			pinning = false;
		}
	}
</script>

{#snippet pinAction()}
	{#if canPin}
		{@const label = node.pinned ? 'Nicht mehr anpinnen' : 'Oben anpinnen'}
		<Sidebar.MenuAction
			class={cn(pinOffset, !node.pinned && ON_HOVER)}
			title={label}
			aria-pressed={node.pinned}
			disabled={pinning}
			onclick={togglePin}
		>
			<PinIcon class={node.pinned ? 'fill-current' : ''} />
			<span class="sr-only">{label}: {node.page?.title ?? node.name}</span>
		</Sidebar.MenuAction>
	{/if}
{/snippet}

{#if node.children.length > 0}
	<Collapsible.Root bind:open class="group/collapsible">
		<Sidebar.MenuItem>
			<div class="group/row relative flex items-center">
				{#if node.page}
					<Sidebar.MenuButton {isActive} class="flex-1">
						{#snippet child({ props })}
							<a {...props} href={resolve('/(app)/w/[...path]', { path: node.fullPath })}>
								<FileTextIcon />
								<span>{node.page?.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				{:else}
					<Collapsible.Trigger class="flex-1">
						{#snippet child({ props })}
							<Sidebar.MenuButton {...props}>
								<FolderIcon />
								<span>{node.name}</span>
							</Sidebar.MenuButton>
						{/snippet}
					</Collapsible.Trigger>
				{/if}
				{@render pinAction()}
				{#if canEdit}
					<Sidebar.MenuAction
						class={cn('right-6', ON_HOVER)}
						title="Unterseite hinzufügen"
						onclick={() => (addOpen = true)}
					>
						<PlusIcon />
						<span class="sr-only">Unterseite hinzufügen</span>
					</Sidebar.MenuAction>
				{/if}
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuAction
							{...props}
							class="transition-transform group-data-[state=open]/collapsible:rotate-90"
						>
							<ChevronRightIcon />
						</Sidebar.MenuAction>
					{/snippet}
				</Collapsible.Trigger>
			</div>
			<!-- Always mounted, hidden while closed: bits-ui's own presence
				 handling left a folder that starts open (the open page's
				 ancestors) marked open but still hidden after hydration. -->
			<Collapsible.Content forceMount class="data-[state=closed]:hidden">
				<Sidebar.MenuSub class="mr-0 pr-0">
					{#each node.children as child (child.fullPath)}
						<Self node={child} {canEdit} {canPin} />
					{/each}
				</Sidebar.MenuSub>
			</Collapsible.Content>
		</Sidebar.MenuItem>
	</Collapsible.Root>
{:else}
	<Sidebar.MenuItem>
		<div class="group/row relative flex items-center">
			<Sidebar.MenuButton {isActive} class="flex-1">
				{#snippet child({ props })}
					<a {...props} {href}>
						<FileTextIcon />
						<span>{node.page?.title ?? node.name}</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
			{@render pinAction()}
			{#if canEdit}
				<Sidebar.MenuAction
					class={ON_HOVER}
					title="Unterseite hinzufügen"
					onclick={() => (addOpen = true)}
				>
					<PlusIcon />
					<span class="sr-only">Unterseite hinzufügen</span>
				</Sidebar.MenuAction>
			{/if}
		</div>
	</Sidebar.MenuItem>
{/if}

{#if canEdit}
	<NewPageDialog
		bind:open={addOpen}
		parentPath={node.fullPath}
		parentTitle={node.page?.title ?? node.name}
	/>
{/if}
