<script lang="ts">
	import PageEditForm from '$lib/components/wiki/page-edit-form.svelte';

	let { data, form } = $props();

	const hasChildren = $derived(data.pages.some((p) => p.path.startsWith(`${data.path}/`)));
</script>

<div class="mx-auto w-[210mm] max-w-full p-8">
	{#key data.path}
		<PageEditForm
			path={data.path}
			pageId={data.page?.id}
			pageExists={data.page !== null}
			{hasChildren}
			existingTitle={data.prefillTitle}
			existingContent={data.version?.content ?? ''}
			attachments={data.attachments}
			errorMessage={form?.message}
		/>
	{/key}
</div>
