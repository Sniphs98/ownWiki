<script lang="ts">
	import { untrack } from 'svelte';
	import FileDownIcon from '@lucide/svelte/icons/file-down';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import MarkdownEditor from './markdown-editor.svelte';
	import { pdfTocSetting } from '$lib/pdf-toc-setting.svelte';
	import { toolbarSetting } from '$lib/toolbar-setting.svelte';
	import { PRINT_TEXT_WIDTH } from '$lib/print-layout';

	/**
	 * Export options for a page's PDF: subpages, contents page and a title
	 * page of its own. The title page is written in the normal editor
	 * (text, images, …), saved with the page (PUT /api/cover/…) when exporting,
	 * and becomes the PDF's first page instead of the generated cover.
	 */
	let {
		open = $bindable(false),
		path,
		pageId,
		hasChildren,
		canEdit,
		savedCover = $bindable()
	}: {
		open?: boolean;
		path: string;
		pageId: string;
		hasChildren: boolean;
		canEdit: boolean;
		/** The page's saved title page, if any; updated when one is saved here. */
		savedCover?: string | null;
	} = $props();

	let withSubpages = $state(false);
	let withCover = $state(false);
	let cover = $state('');
	let exporting = $state(false);
	let failure = $state('');
	let coverEditor: MarkdownEditor | undefined = $state();

	// Each time it opens, start from what's saved.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			cover = savedCover ?? '';
			withCover = !!savedCover;
			failure = '';
		});
	});

	async function responseError(response: Response) {
		const text = await response.text().catch(() => '');
		try {
			return (JSON.parse(text) as { message?: string }).message ?? text;
		} catch {
			return text || `HTTP ${response.status}`;
		}
	}

	async function exportPdf() {
		exporting = true;
		failure = '';
		if (coverEditor) cover = coverEditor.getMarkdown();
		try {
			if (canEdit && withCover && cover !== savedCover) {
				const saved = await fetch(`/api/cover/${path}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ content: cover })
				});
				if (!saved.ok) throw new Error(await responseError(saved));
				savedCover = cover;
			}

			const query = [
				withSubpages ? 'scope=subtree' : '',
				withCover && cover.trim() ? 'cover=1' : ''
			].filter(Boolean);
			const response = await fetch(pdfTocSetting.href(`/api/pdf/${path}?${query.join('&')}`));
			if (!response.ok) throw new Error(await responseError(response));

			const filename =
				response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
				'export.pdf';
			const url = URL.createObjectURL(await response.blob());
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
			open = false;
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		} finally {
			exporting = false;
		}
	}
</script>

<!-- The editor's "/" menu and image popups live outside the dialog, so
	 clicking them mustn't close it; Escape closes those popups first. -->
<Dialog.Root bind:open>
	<Dialog.Content
		class="flex max-h-[90vh] flex-col sm:max-w-none"
		style="width: min(calc({PRINT_TEXT_WIDTH} + 5rem), calc(100% - 2rem))"
		interactOutsideBehavior="ignore"
		escapeKeydownBehavior="ignore"
	>
		<Dialog.Header>
			<Dialog.Title>PDF exportieren</Dialog.Title>
		</Dialog.Header>

		<div class="flex flex-col gap-2 text-sm">
			{#if hasChildren}
				<label class="flex items-center gap-2">
					<input type="checkbox" class="size-4 accent-primary" bind:checked={withSubpages} />
					Mit Unterseiten
				</label>
			{/if}
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					class="size-4 accent-primary"
					checked={pdfTocSetting.enabled}
					onchange={(event) => pdfTocSetting.set(event.currentTarget.checked)}
				/>
				Inhaltsverzeichnis
			</label>
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					class="size-4 accent-primary"
					bind:checked={withCover}
					disabled={!canEdit && !savedCover}
				/>
				Eigene Titelseite
			</label>
		</div>

		{#if withCover}
			<div class="flex min-h-0 flex-col gap-1">
				<p class="text-xs text-muted-foreground">
					{#if canEdit}
						Erste Seite des PDFs – Text, Bilder („/“ → Bild) und alles andere wie auf einer
						Wiki-Seite. Wird beim Export mit der Seite gespeichert.
					{:else}
						Die gespeicherte Titelseite dieser Seite:
					{/if}
				</p>
				<div class="min-h-[40vh] overflow-y-auto rounded-md border p-4" data-cover-editor>
					<div class="mx-auto" style:width={PRINT_TEXT_WIDTH} style:max-width="100%">
						<MarkdownEditor
							bind:this={coverEditor}
							bind:value={cover}
							readonly={!canEdit}
							{pageId}
							toolbar={canEdit ? toolbarSetting.layout : undefined}
							placeholder="Titel, Logo, Untertitel … („/“ für Befehle)"
						/>
					</div>
				</div>
			</div>
		{/if}

		{#if failure}
			<p class="text-sm text-destructive" role="alert">{failure}</p>
		{/if}

		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (open = false)} disabled={exporting}>Abbrechen</Button>
			<Button onclick={exportPdf} disabled={exporting}>
				<FileDownIcon data-icon="inline-start" />
				{exporting ? 'PDF wird erstellt …' : 'PDF herunterladen'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
