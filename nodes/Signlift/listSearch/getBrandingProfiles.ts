import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

/**
 * Feeds the branding profile picker. The collection is short — the plans cap
 * it at 2 or 10 profiles — so one page covers every organization and there is
 * no paging to do here.
 */
export async function getBrandingProfiles(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'signliftApi', {
		method: 'GET',
		url: '/api/v1/branding_profiles',
		baseURL: await resolveBaseUrl.call(this),
		qs: { limit: 100 },
		json: true,
	})) as { data?: Array<{ id: number; name: string }> };

	const results = (response.data ?? [])
		.filter((profile) => !filter || profile.name.toLowerCase().includes(filter.toLowerCase()))
		.map((profile) => ({ name: profile.name, value: profile.id }));

	return { results };
}

export async function resolveBaseUrl(this: ILoadOptionsFunctions): Promise<string> {
	const credentials = await this.getCredentials('signliftApi');

	return credentials.deployment === 'staging'
		? 'https://app.staging-signlift.eu'
		: 'https://app.signlift.eu';
}
