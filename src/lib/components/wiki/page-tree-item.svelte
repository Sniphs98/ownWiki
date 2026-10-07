<script lang="ts">
	import Self from './page-tree-item.svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import NewPageDialog from './new-page-dialog.svelte';
	import PageToc from './page-toc.svelte';
	import { pageToc } from '$lib/page-toc.svelte';
	import { resolve } from '$app/paths';
	import { page as currentPage } from '$app/state';
	import type { PageTreeNode } from '$lib/page-tree';

	let { node, canEdit = false }: { node: PageTreeNode; canEdit?: boolean } = $props();

	const href = $derived(resolve('/(app)/w/[...path]', { path: node.fullPath }));
	const isActive = $derived(currentPage.url.pathname === href);
	const isAncestorOfActive = $derived(currentPage.url.pathname.startsWith(href + '/'));

	let open = $state(isAncestorOfActive);
	// The open page (viewed or edited) shows its table of contents.
	const showToc = $derived(!!node.page && pageToc.path === node.fullPath);
	let addOpen = $state(false);
</script>

{#if node.children.length > 0}
	<Collapsible.Root bind:open class="group/collapsible">
		<Sidebar.MenuItem>
			<div class="flex items-center">
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
				{#if canEdit}
					<Sidebar.MenuAction
						showOnHover
						class="right-6"
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
			{#if showToc}
				<PageToc />
			{/if}
			<!-- Always mounted, hidden while closed: bits-ui's own presence
				 handling left a folder that starts open (the open page's
				 ancestors) marked open but still hidden after hydration. -->
			<Collapsible.Content forceMount class="data-[state=closed]:hidden">
				<Sidebar.MenuSub class="mr-0 pr-0">
					{#each node.children as child (child.fullPath)}
						<Self node={child} {canEdit} />
					{/each}
				</Sidebar.MenuSub>
			</Collapsible.Content>
		</Sidebar.MenuItem>
	</Collapsible.Root>
{:else}
	<Sidebar.MenuItem>
		<div class="flex items-center">
			<Sidebar.MenuButton {isActive} class="flex-1">
				{#snippet child({ props })}
					<a {...props} {href}>
						<FileTextIcon />
						<span>{node.page?.title ?? node.name}</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
			{#if canEdit}
				<Sidebar.MenuAction
					showOnHover
					title="Unterseite hinzufügen"
					onclick={() => (addOpen = true)}
				>
					<PlusIcon />
					<span class="sr-only">Unterseite hinzufügen</span>
				</Sidebar.MenuAction>
			{/if}
		</div>
		{#if showToc}
			<PageToc />
		{/if}
	</Sidebar.MenuItem>
{/if}

{#if canEdit}
	<NewPageDialog
		bind:open={addOpen}
		parentPath={node.fullPath}
		parentTitle={node.page?.title ?? node.name}
	/>
{/if}
