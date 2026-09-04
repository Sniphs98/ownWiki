<script lang="ts">
	import PageEditForm from '$lib/components/wiki/page-edit-form.svelte';

	let { data, form } = $props();
</script>

<div class="mx-auto max-w-3xl p-8">
	{#key data.path}
		<PageEditForm
			path={data.path}
			pageExists={data.page !== null}
			existingTitle={data.prefillTitle}
			existingContent={data.version?.content ?? ''}
			errorMessage={form?.message}
		/>
	{/key}
</div>
