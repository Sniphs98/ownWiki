<script lang="ts">
	import MarkdownEditor from './markdown-editor.svelte';
	import type { PrintablePage } from '$lib/server/pdf/printable-pages';

	let { wikiTitle, pages }: { wikiTitle: string; pages: PrintablePage[] } = $props();

	const isMulti = $derived(pages.length > 1);

	let readyCount = $state(0);
	let paginated = $state(false);
	let hideSource = $state(false);
	let sourceEl: HTMLDivElement | undefined = $state();
	let targetEl: HTMLDivElement | undefined = $state();

	function onChapterReady() {
		readyCount += 1;
	}

	// Only the pagination-specific rules (@page, break-*) need to go through
	// pagedjs's polisher — everything else (Crepe's theme, Tailwind) is
	// already applied live by the browser and stays that way. Passing this
	// explicit stylesheet instead of leaving pagedjs auto-discover every
	// stylesheet element on the page also sidesteps it choking on Tailwind's
	// generated CSS, which uses @media/@container syntax pagedjs's CSS
	// parser doesn't understand.
	const PRINT_CSS = `
		@page {
			size: A4;
			margin: 20mm 16mm;

			@bottom-center {
				content: counter(page) ' / ' counter(pages);
				font-family: 'Inter Variable', Arial, Helvetica, sans-serif;
				font-size: 8pt;
				color: #999;
			}
		}

		.wiki-chapter { break-before: page; }
		.wiki-chapter:first-child { break-before: avoid; }
		.wiki-chapter-title {
			font-family: Georgia, Cambria, 'Times New Roman', Times, serif;
			font-size: 22pt;
			font-weight: 700;
			margin: 0 0 0.2em;
		}
		.wiki-chapter-path {
			font-family: 'Cascadia Code', Consolas, 'Fira Code', monospace;
			color: #4f4539;
			font-size: 9pt;
			margin: 0 0 1.5em;
		}
		.wiki-cover { text-align: center; padding-top: 30vh; break-after: page; }
		.wiki-cover h1 { font-family: Georgia, Cambria, 'Times New Roman', Times, serif; font-size: 28pt; }
		.wiki-cover p { color: #4f4539; }

		img { max-width: 100%; break-inside: avoid; }
		table { break-inside: auto; }
		tr { break-inside: avoid; break-after: auto; }
		thead { display: table-header-group; }
		pre, blockquote, li { break-inside: avoid; }
	`;

	// Runs once every chapter's (readonly) Crepe instance has finished
	// mounting — only then does the DOM actually contain the real,
	// pixel-accurate rendering pagedjs needs to paginate.
	$effect(() => {
		if (readyCount < pages.length || paginated || !sourceEl || !targetEl) return;
		paginated = true;

		(async () => {
			const { Previewer } = await import('pagedjs');
			const blobUrl = URL.createObjectURL(new Blob([PRINT_CSS], { type: 'text/css' }));
			// Passing the live sourceEl node itself (instead of its HTML as a
			// string) made pagedjs's chunker nest a clone of the *whole*
			// document (html>body>...) inside every paginated page, pushing the
			// real content off to the source's off-screen position — pass a
			// plain string, matching pagedjs's documented usage, so it parses
			// fresh content instead.
			await new Previewer().preview(sourceEl!.innerHTML, [blobUrl], targetEl);
			URL.revokeObjectURL(blobUrl);
			// The source has been cloned into targetEl's paginated layout by
			// now; hiding it (the {#if !hideSource} below) is no longer just
			// cosmetic — its huge negative offset (needed so Crepe still gets a
			// real layout box while off-screen) has been seen to confuse
			// Chromium's full-page rendering if left in place.
			hideSource = true;
			// generate-pdf.ts waits on this to know the paginated layout is
			// final before calling page.pdf().
			document.body.dataset.printReady = 'true';
		})();
	});
</script>

<svelte:head>
	<title>{wikiTitle} · Druckansicht</title>
</svelte:head>

{#if !hideSource}
	<div bind:this={sourceEl} class="print-source">
		{#if isMulti}
			<div class="wiki-cover">
				<h1>{wikiTitle}</h1>
				<p>Exportiert am {new Date().toLocaleString('de-DE')}</p>
			</div>
		{/if}
		{#each pages as p (p.path)}
			<div class="wiki-chapter">
				{#if isMulti}
					<p class="wiki-chapter-path">/w/{p.path}</p>
					<h1 class="wiki-chapter-title">{p.title}</h1>
				{/if}
				<MarkdownEditor value={p.content} readonly onready={onChapterReady} />
			</div>
		{/each}
	</div>
{/if}
<div bind:this={targetEl}></div>

<style>
	/* On-screen preview chrome only — must not bleed into the printed PDF
		 (generate-pdf.ts renders with printBackground: true). Targets
		 dynamically created elements (body, pagedjs's own page boxes), so
		 these need :global — Svelte's scoping only ever matches elements
		 present in this component's own markup. */
	@media screen {
		:global(body) {
			background: #e5e5e5;
		}
		:global(.pagedjs_page) {
			background: white;
			box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
			margin: 12mm auto;
		}
	}

	.print-source {
		position: absolute;
		top: 0;
		left: -99999px;
		width: 178mm;
	}
</style>
