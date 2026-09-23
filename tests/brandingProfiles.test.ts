import { describe, expect, it, vi } from 'vitest';
import { getBrandingProfiles, resolveBaseUrl } from '../nodes/Signlift/listSearch/getBrandingProfiles';

function searchContext(data: unknown, deployment = 'production') {
	const httpRequestWithAuthentication = { call: vi.fn(async () => data) };

	return {
		getCredentials: vi.fn(async () => ({ deployment })),
		helpers: { httpRequestWithAuthentication },
		httpRequestWithAuthentication,
	};
}

const profiles = { data: [{ id: 1, name: 'Marque principale' }, { id: 2, name: 'Filiale' }] };

describe('getBrandingProfiles', () => {
	// The picker must show names; ids are what the API wants back.
	it('offers readable names carrying the id as value', async () => {
		const context = searchContext(profiles);

		const result = await getBrandingProfiles.call(context as never);

		expect(result.results).toEqual([
			{ name: 'Marque principale', value: 1 },
			{ name: 'Filiale', value: 2 },
		]);
	});

	it('filters on the name, ignoring case', async () => {
		const context = searchContext(profiles);

		const result = await getBrandingProfiles.call(context as never, 'FILI');

		expect(result.results).toEqual([{ name: 'Filiale', value: 2 }]);
	});

	it('returns everything when the filter is empty', async () => {
		const context = searchContext(profiles);

		const result = await getBrandingProfiles.call(context as never, '');

		expect(result.results).toHaveLength(2);
	});

	it('copes with a response carrying no data key', async () => {
		const context = searchContext({});

		const result = await getBrandingProfiles.call(context as never);

		expect(result.results).toEqual([]);
	});

	it('asks for a single page, the plans capping the collection well below it', async () => {
		const context = searchContext(profiles);

		await getBrandingProfiles.call(context as never);

		const [, , options] = context.httpRequestWithAuthentication.call.mock.calls[0] as [
			unknown,
			string,
			{ qs: { limit: number } },
		];
		expect(options.qs).toEqual({ limit: 100 });
	});
});

describe('resolveBaseUrl', () => {
	it.each([
		['staging', 'https://app.staging-signlift.eu'],
		['production', 'https://app.signlift.eu'],
		[undefined, 'https://app.signlift.eu'],
	])('sends a %s credential to %s', async (deployment, expected) => {
		const context = searchContext({}, deployment as string);

		await expect(resolveBaseUrl.call(context as never)).resolves.toBe(expected);
	});
});
