<script lang="ts">
	import { pdfTocSetting } from '$lib/pdf-toc-setting.svelte';
</script>

<label
	class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none"
	title="Fügt dem PDF nach der ersten Seite ein Inhaltsverzeichnis mit Seitenzahlen hinzu"
>
	<input
		type="checkbox"
		class="size-3.5 accent-primary"
		checked={pdfTocSetting.enabled}
		onchange={(event) => pdfTocSetting.set(event.currentTarget.checked)}
	/>
	Inhaltsverzeichnis
</label>
