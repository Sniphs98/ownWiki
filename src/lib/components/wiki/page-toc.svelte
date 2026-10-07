<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ListTreeIcon from '@lucide/svelte/icons/list-tree';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import { pageToc } from '$lib/page-toc.svelte';
	import { cn } from '$lib/utils';

	/**
	 * The open page's headings, shown under it in the page tree (see
	 * page-tree-item.svelte): click one to scroll there; the section in
	 * view is highlighted (tracked in $lib/page-toc.svelte.ts). Foldable,
	 * remembered per browser.
	 */
	const sidebar = useSidebar();

	const entries = $derived(pageToc.entries);
	const topLevel = $derived(Math.min(...entries.map((entry) => entry.level)));

	function go(index: number) {
		pageToc.jumpTo(index);
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}
</script>

{#if entries.length > 0}
	<div class="mt-0.5 ml-3.5 border-l border-sidebar-border pl-1.5" data-page-toc>
		<button
			type="button"
			class="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			aria-expanded={pageToc.expanded}
			onclick={() => pageToc.toggle()}
		>
			<ChevronRightIcon
				class={cn('size-3.5 shrink-0 transition-transform', pageToc.expanded && 'rotate-90')}
			/>
			<ListTreeIcon class="size-3.5 shrink-0" />
			Inhalt
			<span class="ml-auto font-normal tabular-nums">{entries.length}</span>
		</button>

		{#if pageToc.expanded}
			<ul class="flex flex-col gap-px pb-1" aria-label="Inhaltsverzeichnis">
				{#each entries as entry, i (i)}
					<li>
						<button
							type="button"
							class={cn(
								'flex h-7 w-full min-w-0 items-center rounded-md pr-2 text-left text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
								i === pageToc.activeIndex &&
									'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
							)}
							style:padding-left="{0.5 + (entry.level - topLevel) * 0.75}rem"
							aria-current={i === pageToc.activeIndex ? 'location' : undefined}
							title={entry.text}
							onclick={() => go(i)}
						>
							<span class="truncate">{entry.text}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
