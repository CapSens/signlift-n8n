import type { INodeProperties } from 'n8n-workflow';
import { signatureRequestGetManyDescription } from './getAll';
import { signatureRequestGetDescription } from './get';
import { buildSignatureRequestBody, signatureRequestCreateDescription } from './create';
import { sendForSignatureDescription, uploadThenCreate } from './sendForSignature';
import { downloadDescription, emitSignedDocuments } from './download';
import { subscriptionDescription } from './subscribe';

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
				name: 'Send for Signature',
				value: 'sendForSignature',
				action: 'Send a file for signature',
				description:
					'Upload a PDF and send it out for signature in one step. Use Upload plus Create instead when you reuse one document across several envelopes.',
				routing: {
					request: { method: 'POST', url: '/api/v1/signature_requests' },
					send: { preSend: [uploadThenCreate] },
				},
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a signature request',
				description: 'Send a document out for signature',
				routing: {
					request: { method: 'POST', url: '/api/v1/signature_requests' },
					send: { preSend: [buildSignatureRequestBody] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a signature request',
				description:
					'Read an envelope. Download links appear once every artefact is sealed, which the finalized field reports.',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/signature_requests/{{$parameter.signatureRequestId}}',
					},
				},
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download the signed documents',
				description:
					'Fetch the sealed PDFs and the evidence file of a completed request as binary data',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/signature_requests/{{$parameter.signatureRequestId}}',
					},
					output: { postReceive: [emitSignedDocuments] },
				},
			},
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
	...sendForSignatureDescription,
	...signatureRequestCreateDescription,
	...subscriptionDescription,
	...downloadDescription,
	...signatureRequestGetDescription,
	...signatureRequestGetManyDescription,
];
