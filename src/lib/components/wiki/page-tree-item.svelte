<script lang="ts">
	import Self from './page-tree-item.svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { resolve } from '$app/paths';
	import { page as currentPage } from '$app/state';
	import type { PageTreeNode } from '$lib/page-tree';

	let { node }: { node: PageTreeNode } = $props();

	const href = $derived(resolve('/(app)/w/[...path]', { path: node.fullPath }));
	const isActive = $derived(currentPage.url.pathname === href);
	const isAncestorOfActive = $derived(currentPage.url.pathname.startsWith(href + '/'));

	let open = $state(isAncestorOfActive);
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
			<Collapsible.Content>
				<Sidebar.MenuSub class="mr-0 pr-0">
					{#each node.children as child (child.fullPath)}
						<Self node={child} />
					{/each}
				</Sidebar.MenuSub>
			</Collapsible.Content>
		</Sidebar.MenuItem>
	</Collapsible.Root>
{:else}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton {isActive}>
			{#snippet child({ props })}
				<a {...props} {href}>
					<FileTextIcon />
					<span>{node.page?.title ?? node.name}</span>
				</a>
			{/snippet}
		</Sidebar.MenuButton>
	</Sidebar.MenuItem>
{/if}
