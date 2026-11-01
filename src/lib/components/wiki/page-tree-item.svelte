<script lang="ts">
	import Self from './page-tree-item.svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PinIcon from '@lucide/svelte/icons/pin';
	import PinOffIcon from '@lucide/svelte/icons/pin-off';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import FolderInputIcon from '@lucide/svelte/icons/folder-input';
	import LinkIcon from '@lucide/svelte/icons/link';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import NewPageDialog from './new-page-dialog.svelte';
	import MoveDialog from './move-dialog.svelte';
	import AccessDialog from './access-dialog.svelte';
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
		canPin = false,
		canManageAccess = false,
		pagePaths = []
	}: {
		node: PageTreeNode;
		canEdit?: boolean;
		canPin?: boolean;
		/** Admins set who may read and edit, right from the tree. */
		canManageAccess?: boolean;
		/** All pages the person sees, for the move dialog. */
		pagePaths?: string[];
	} = $props();

	const href = $derived(resolve('/(app)/w/[...path]', { path: node.fullPath }));
	const isActive = $derived(currentPage.url.pathname === href);
	const isAncestorOfActive = $derived(currentPage.url.pathname.startsWith(href + '/'));
	const title = $derived(node.page?.title ?? node.name);

	// Opened for the open page — also when it's reached by a link later on.
	let open = $state(untrack(() => isAncestorOfActive));
	$effect.pre(() => {
		if (isAncestorOfActive) open = true;
	});
	let addOpen = $state(false);
	let moveOpen = $state(false);
	let accessOpen = $state(false);

	// Shown while this row is hovered (or reached by keyboard, or its menu is
	// open). Not shadcn's showOnHover: that reacts to any menu item around
	// this one, so hovering a folder showed the actions of everything inside
	// it, and a clicked action stayed visible while it kept the focus.
	const ON_HOVER =
		'md:opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100';

	// Right to left: the chevron (folders), the menu, and the pin of a pinned one —
	// on hover too, like the menu; its place at the top shows it's pinned.
	const isFolder = $derived(node.children.length > 0);
	const menuOffset = $derived(isFolder ? 'right-6' : 'right-1');
	const pinOffset = $derived(isFolder ? 'right-11' : 'right-6');

	async function setPinned(pinned: boolean) {
		await fetch(withBase('/api/pins'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ path: node.fullPath, pinned })
		});
		await invalidateAll();
	}

	async function copyLink() {
		if (!node.page) return;
		await navigator.clipboard.writeText(`${location.origin}${withBase(`/p/${node.page.id}`)}`);
	}
</script>

{#snippet actions()}
	{#if canPin && node.pinned}
		<Sidebar.MenuAction
			class={cn(pinOffset, ON_HOVER)}
			title="Nicht mehr anpinnen"
			aria-pressed="true"
			onclick={() => setPinned(false)}
		>
			<PinIcon class="fill-current" />
			<span class="sr-only">Nicht mehr anpinnen: {title}</span>
		</Sidebar.MenuAction>
	{/if}
	{#if canEdit || canPin || canManageAccess || node.page}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Sidebar.MenuAction {...props} class={cn(menuOffset, ON_HOVER)} title="Mehr">
						<EllipsisIcon />
						<span class="sr-only">Mehr zu {title}</span>
					</Sidebar.MenuAction>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content side="right" align="start" class="min-w-48">
				{#if canEdit}
					<DropdownMenu.Item onclick={() => (addOpen = true)}>
						<PlusIcon />
						Unterseite hinzufügen
					</DropdownMenu.Item>
				{/if}
				{#if canPin}
					<DropdownMenu.Item onclick={() => setPinned(!node.pinned)}>
						{#if node.pinned}
							<PinOffIcon />
							Nicht mehr anpinnen
						{:else}
							<PinIcon />
							Oben anpinnen
						{/if}
					</DropdownMenu.Item>
				{/if}
				{#if node.page}
					<DropdownMenu.Item onclick={copyLink}>
						<LinkIcon />
						Link kopieren
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {...props} href={resolve('/(app)/w/[...path]/history', { path: node.fullPath })}>
								<HistoryIcon />
								Verlauf
							</a>
						{/snippet}
					</DropdownMenu.Item>
				{/if}
				{#if canEdit}
					<DropdownMenu.Separator />
					{#if node.page}
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a {...props} href={resolve('/(app)/w/[...path]/edit', { path: node.fullPath })}>
									<PencilIcon />
									Bearbeiten
								</a>
							{/snippet}
						</DropdownMenu.Item>
					{/if}
					<DropdownMenu.Item onclick={() => (moveOpen = true)}>
						<FolderInputIcon />
						Verschieben …
					</DropdownMenu.Item>
				{/if}
				{#if canManageAccess}
					<DropdownMenu.Item onclick={() => (accessOpen = true)}>
						<ShieldIcon />
						Rechte …
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
{/snippet}

{#if isFolder}
	<Collapsible.Root bind:open class="group/collapsible">
		<Sidebar.MenuItem>
			<div class="group/row relative flex items-center">
				{#if node.page}
					<Sidebar.MenuButton {isActive} class="flex-1">
						{#snippet child({ props })}
							<a {...props} {href}>
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
				{@render actions()}
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
						<Self node={child} {canEdit} {canPin} {canManageAccess} {pagePaths} />
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
						<span>{title}</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
			{@render actions()}
		</div>
	</Sidebar.MenuItem>
{/if}

{#if canEdit}
	<NewPageDialog bind:open={addOpen} parentPath={node.fullPath} parentTitle={title} />
	<!-- Mounted when opened, so it starts from where the page is now. -->
	{#if moveOpen}
		<MoveDialog bind:open={moveOpen} path={node.fullPath} {title} {pagePaths} />
	{/if}
{/if}
{#if canManageAccess && accessOpen}
	<AccessDialog bind:open={accessOpen} path={node.fullPath} {title} />
{/if}
