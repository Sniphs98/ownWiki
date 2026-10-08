<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { pdfTocSetting } from '$lib/pdf-toc-setting.svelte';
</script>

<label
	class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none"
	title="Fügt dem PDF nach der ersten Seite ein Inhaltsverzeichnis mit Seitenzahlen hinzu"
>
	<Checkbox
		checked={pdfTocSetting.enabled}
		onCheckedChange={(checked) => pdfTocSetting.set(checked)}
	/>
	Inhaltsverzeichnis
</label>
