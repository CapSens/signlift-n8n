import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

/**
 * Filters shared by the collections the API exposes. The API is strict on
 * these where it is lenient on page and limit: an unreadable value answers
 * 422 rather than being ignored, so a wrong filter never silently returns a
 * wrong collection.
 */
export const collectionFilters: INodeProperties[] = [
	{
		displayName: 'Created After',
		name: 'created_after',
		type: 'dateTime',
		default: '',
		description:
			'Only return records created at or after this moment. A bare date means the whole day, from midnight.',
		routing: { send: { type: 'query', property: 'created_after' } },
	},
	{
		displayName: 'Created Before',
		name: 'created_before',
		type: 'dateTime',
		default: '',
		description:
			'Only return records created at or before this moment. A bare date runs to the end of that day.',
		routing: { send: { type: 'query', property: 'created_before' } },
	},
	{
		displayName: 'Sort Order',
		name: 'order',
		type: 'options',
		options: [
			{ name: 'Oldest First', value: 'asc' },
			{ name: 'Newest First', value: 'desc' },
		],
		default: 'asc',
		description:
			'Oldest first keeps a walk through a long archive stable, because new records land at the end rather than shifting every page',
		routing: { send: { type: 'query', property: 'order' } },
	},
];

/**
 * The API caps `limit` at 100 and answers with the value it actually applied,
 * so asking for more is pointless rather than rejected. Paging is by page
 * number, and the envelope carries the totals.
 */
export function paginationDescription(show: IDisplayOptions['show']): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			displayOptions: { show },
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			routing: {
				send: { paginate: '={{ $value }}', type: 'query', property: 'limit', value: '100' },
				operations: {
					pagination: {
						type: 'offset',
						properties: {
							limitParameter: 'limit',
							offsetParameter: 'page',
							pageSize: 100,
							type: 'query',
						},
					},
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			displayOptions: { show: { ...show, returnAll: [false] } },
			typeOptions: { minValue: 1, maxValue: 100 },
			default: 50,
			description: 'Max number of results to return',
			routing: { send: { type: 'query', property: 'limit' } },
		},
		{
			displayName: 'Page',
			name: 'page',
			type: 'number',
			displayOptions: { show: { ...show, returnAll: [false] } },
			typeOptions: { minValue: 1 },
			default: 1,
			description:
				'Which page of results to return. Read pagination.pages in the response to know how many there are.',
			routing: { send: { type: 'query', property: 'page' } },
		},
	];
}
