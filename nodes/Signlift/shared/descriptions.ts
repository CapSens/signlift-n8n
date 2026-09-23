import type { INodeProperties } from 'n8n-workflow';

/**
 * Filters shared by the collections the API exposes. The Signlift API is
 * strict on these where it is lenient on page and limit: an unreadable value
 * answers 422 rather than being ignored, so a wrong filter never silently
 * returns a wrong collection.
 */
export const collectionFilters: INodeProperties[] = [
	{
		displayName: 'Created After',
		name: 'created_after',
		type: 'dateTime',
		default: '',
		description: 'Only return records created at or after this moment. A bare date means the whole day, from midnight.',
		routing: { send: { type: 'query', property: 'created_after' } },
	},
	{
		displayName: 'Created Before',
		name: 'created_before',
		type: 'dateTime',
		default: '',
		description: 'Only return records created at or before this moment. A bare date runs to the end of that day.',
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
