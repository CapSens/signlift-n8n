import type { INodeProperties } from 'n8n-workflow';

const showOnlyForOrganization = { resource: ['organization'] };

export const organizationDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForOrganization },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get the organization',
				description:
					'Read what the organization behind this API key can do with it: its plan, the features it has and the effective limits, where null means unlimited. The environment is the one of the key; on a sandbox key no SMS is ever sent, whatever the SMS feature says.',
				routing: {
					request: { method: 'GET', url: '/api/v1/organization' },
				},
			},
		],
		default: 'get',
	},
];
