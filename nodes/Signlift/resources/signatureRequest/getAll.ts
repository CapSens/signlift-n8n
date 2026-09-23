import type { INodeProperties } from 'n8n-workflow';
import { collectionFilters, paginationDescription } from '../../shared/descriptions';

const showOnlyForGetMany = {
	operation: ['getAll'],
	resource: ['signatureRequest'],
};

export const signatureRequestGetManyDescription: INodeProperties[] = [
	...paginationDescription(showOnlyForGetMany),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		displayOptions: { show: showOnlyForGetMany },
		default: {},
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Pending', value: 'pending' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Expired', value: 'expired' },
				],
				default: 'pending',
				description: 'Drafts never reach the API, so they are not an offered value',
				routing: { send: { type: 'query', property: 'status' } },
			},
			...collectionFilters,
		],
	},
];
