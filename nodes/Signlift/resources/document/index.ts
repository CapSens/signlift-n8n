import type { INodeProperties } from 'n8n-workflow';
import { collectionFilters, paginationDescription } from '../../shared/descriptions';

const showOnlyForDocuments = { resource: ['document'] };
const showOnlyForGetMany = { operation: ['getAll'], resource: ['document'] };

export const documentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDocuments },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a document',
				description: 'Read a document and get a link to download the original PDF',
				routing: {
					request: { method: 'GET', url: '=/api/v1/documents/{{$parameter.documentId}}' },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many documents',
				description: 'List the documents of your organization',
				routing: {
					request: { method: 'GET', url: '/api/v1/documents' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
				},
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { operation: ['get'], resource: ['document'] } },
	},
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
					{ name: 'Ready', value: 'ready' },
				],
				default: 'ready',
				routing: { send: { type: 'query', property: 'status' } },
			},
			...collectionFilters,
		],
	},
];
