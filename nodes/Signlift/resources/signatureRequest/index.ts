import type { INodeProperties } from 'n8n-workflow';
import { signatureRequestGetManyDescription } from './getAll';

const showOnlyForSignatureRequests = {
	resource: ['signatureRequest'],
};

export const signatureRequestDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForSignatureRequests },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many signature requests',
				description: 'List the signature requests of your organization',
				routing: {
					request: { method: 'GET', url: '/api/v1/signature_requests' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
				},
			},
		],
		default: 'getAll',
	},
	...signatureRequestGetManyDescription,
];
