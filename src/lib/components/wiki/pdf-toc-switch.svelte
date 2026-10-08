<script lang="ts">
	import { Switch } from '$lib/components/ui/switch';
	import { pdfTocSetting } from '$lib/pdf-toc-setting.svelte';
</script>

<label
	class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none"
	title="Fügt dem PDF nach der ersten Seite ein Inhaltsverzeichnis mit Seitenzahlen hinzu"
>
	<Switch
		size="sm"
		checked={pdfTocSetting.enabled}
		onCheckedChange={(checked) => pdfTocSetting.set(checked)}
	/>
	Inhaltsverzeichnis
</label>
