import type { INodeProperties } from 'n8n-workflow';
import { paginationDescription } from '../../shared/descriptions';
import { EVENT_OPTIONS } from '../../shared/events';

const showOnlyForWebhookEndpoints = { resource: ['webhookEndpoint'] };

const showFor = (operation: string[]) => ({ ...showOnlyForWebhookEndpoints, operation });

export const webhookEndpointDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForWebhookEndpoints },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Register a webhook endpoint',
				description:
					'Register a URL to receive events, for every envelope or for one. Registering a URL that is already known switches it back on instead of refusing it.',
				routing: {
					request: { method: 'POST', url: '/api/v1/webhook_endpoints' },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Unregister a webhook endpoint',
				description:
					'Stop sending events to this endpoint. The registration is kept, so the same URL can be registered again later and its history is not lost.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/api/v1/webhook_endpoints/{{$parameter.webhookEndpointId}}',
					},
					output: {
						postReceive: [{ type: 'set', properties: { value: '={{ { "success": true } }}' } }],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a webhook endpoint',
				description: 'Read one endpoint registered by this API key',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/webhook_endpoints/{{$parameter.webhookEndpointId}}',
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many webhook endpoints',
				description:
					'List the endpoints registered by this API key. An endpoint registered under another key is never listed, whatever the organization.',
				routing: {
					request: { method: 'GET', url: '/api/v1/webhook_endpoints' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a webhook endpoint',
				description:
					'Change which events an endpoint receives, or switch it on and off. The URL is immutable: an integration matches its endpoint by URL, and moving one would strand it.',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/api/v1/webhook_endpoints/{{$parameter.webhookEndpointId}}',
					},
				},
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Endpoint ID',
		name: 'webhookEndpointId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: showFor(['get', 'update', 'delete']) },
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/hooks/signlift',
		displayOptions: { show: showFor(['create']) },
		description: 'Where Signlift posts the events. HTTPS only.',
		routing: { send: { type: 'body', property: 'webhook_endpoint.url' } },
	},
	{
		displayName: 'Events',
		name: 'events',
		type: 'multiOptions',
		required: true,
		options: EVENT_OPTIONS,
		default: ['request.completed', 'request.expired'],
		displayOptions: { show: showFor(['create']) },
		description:
			'Which events this endpoint receives. Tick all five to take everything Signlift emits today.',
		routing: { send: { type: 'body', property: 'webhook_endpoint.events' } },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showFor(['create']) },
		options: [
			{
				displayName: 'Signature Request ID',
				name: 'signature_request_id',
				type: 'number',
				default: 0,
				description:
					'Bind the endpoint to one envelope instead of every one. Unregistered on its own once that envelope is settled, so a workflow that subscribes per envelope never has to clean up.',
				routing: { send: { type: 'body', property: 'webhook_endpoint.signature_request_id' } },
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showFor(['update']) },
		options: [
			{
				displayName: 'Active',
				name: 'active',
				type: 'boolean',
				default: true,
				description: 'Whether the endpoint receives events. Switching it off is what Delete does.',
				routing: { send: { type: 'body', property: 'webhook_endpoint.active' } },
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENT_OPTIONS,
				default: ['request.completed', 'request.expired'],
				description: 'Replaces the current selection rather than adding to it',
				routing: { send: { type: 'body', property: 'webhook_endpoint.events' } },
			},
		],
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showFor(['getAll']) },
		options: [
			{
				displayName: 'Status',
				name: 'active',
				type: 'options',
				options: [
					{ name: 'Registered', value: 'true' },
					{ name: 'Unregistered', value: 'false' },
				],
				default: 'true',
				description:
					'Whether to list the endpoints that are live or the ones that were unregistered. The API filters on one or the other, never both at once.',
				routing: { send: { type: 'query', property: 'active' } },
			},
			{
				displayName: 'Signature Request ID',
				name: 'signature_request_id',
				type: 'number',
				default: 0,
				description: 'Keep only the endpoints bound to that envelope',
				routing: { send: { type: 'query', property: 'signature_request_id' } },
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/hooks/signlift',
				description:
					'Exact match. This is how an integration checks whether its own URL is already registered.',
				routing: { send: { type: 'query', property: 'url' } },
			},
		],
	},
	...paginationDescription({ operation: ['getAll'], resource: ['webhookEndpoint'] }),
];
