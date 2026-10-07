<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ListTreeIcon from '@lucide/svelte/icons/list-tree';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import { pageToc, type TocEntry } from '$lib/page-toc.svelte';
	import { cn } from '$lib/utils';

	/**
	 * The open page's headings, shown under it in the page tree (see
	 * page-tree-item.svelte): click one to scroll there; the section in
	 * view is highlighted. Foldable, remembered per browser.
	 */
	const sidebar = useSidebar();

	const entries = $derived(pageToc.entries);
	const topLevel = $derived(Math.min(...entries.map((entry) => entry.level)));
	let activeIndex = $state(-1);
	// The heading last jumped to. Near the end of a page it can't scroll up
	// to the top, so the scroll position alone would point at an earlier one.
	let jumpedTo = -1;

	function go(entry: TocEntry, index: number) {
		jumpedTo = index;
		activeIndex = index;
		entry.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	// Highlight the last heading scrolled past the top of the content area.
	$effect(() => {
		const scroller = document.querySelector('main main');
		if (!scroller || entries.length === 0) return;

		let frame = 0;
		const update = () => {
			frame = 0;
			const bounds = scroller.getBoundingClientRect();
			let index = -1;
			entries.forEach((entry, i) => {
				if (
					entry.element.isConnected &&
					entry.element.getBoundingClientRect().top <= bounds.top + 96
				)
					index = i;
			});
			const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
			const jumped = entries[jumpedTo]?.element;
			if (atBottom && jumped?.isConnected && jumped.getBoundingClientRect().top < bounds.bottom) {
				index = jumpedTo;
			}
			activeIndex = index;
		};
		const onScroll = () => (frame ||= requestAnimationFrame(update));
		// Scrolling by hand ends what the last jump pinned.
		const onUserScroll = () => (jumpedTo = -1);

		update();
		scroller.addEventListener('scroll', onScroll, { passive: true });
		for (const type of ['wheel', 'touchmove', 'keydown'] as const) {
			scroller.addEventListener(type, onUserScroll, { passive: true });
		}
		return () => {
			scroller.removeEventListener('scroll', onScroll);
			for (const type of ['wheel', 'touchmove', 'keydown'] as const) {
				scroller.removeEventListener(type, onUserScroll);
			}
			cancelAnimationFrame(frame);
		};
	});
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
								i === activeIndex && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
							)}
							style:padding-left="{0.5 + (entry.level - topLevel) * 0.75}rem"
							aria-current={i === activeIndex ? 'location' : undefined}
							title={entry.text}
							onclick={() => go(entry, i)}
						>
							<span class="truncate">{entry.text}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
