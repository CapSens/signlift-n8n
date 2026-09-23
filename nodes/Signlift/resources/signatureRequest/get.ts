import type { INodeProperties } from 'n8n-workflow';

export const signatureRequestGetDescription: INodeProperties[] = [
	{
		displayName: 'Signature Request ID',
		name: 'signatureRequestId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { operation: ['get'], resource: ['signatureRequest'] } },
	},
];
