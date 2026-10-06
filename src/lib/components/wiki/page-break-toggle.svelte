<script lang="ts">
	import ScissorsLineDashedIcon from '@lucide/svelte/icons/scissors-line-dashed';
	import { Button } from '$lib/components/ui/button';
	import { pageBreakSetting } from '$lib/page-break-setting.svelte';
</script>

<Button
	type="button"
	variant={pageBreakSetting.visible ? 'secondary' : 'ghost'}
	aria-pressed={pageBreakSetting.visible}
	title="Zeigt, wo im PDF eine neue Seite beginnt"
	onclick={() => pageBreakSetting.toggle()}
>
	<ScissorsLineDashedIcon data-icon="inline-start" />
	Seitenumbrüche
</Button>
