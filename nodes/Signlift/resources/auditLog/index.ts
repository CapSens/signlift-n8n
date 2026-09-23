import type { INodeProperties } from 'n8n-workflow';
import { paginationDescription } from '../../shared/descriptions';

const showOnlyForAuditLogs = { resource: ['auditLog'] };

export const auditLogDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForAuditLogs },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many audit log entries',
				description:
					'Read the audit trail of a signature request, oldest entry first. A trail spans several pages once several signers are involved, so turn on Return All to collect a complete one.',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/signature_requests/{{$parameter.signatureRequestId}}/audit_logs',
					},
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
				},
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'Signature Request ID',
		name: 'signatureRequestId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: showOnlyForAuditLogs },
	},
	...paginationDescription({ operation: ['getAll'], resource: ['auditLog'] }),
];
