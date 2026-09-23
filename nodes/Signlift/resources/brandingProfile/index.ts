import type { INodeProperties } from 'n8n-workflow';
import { paginationDescription } from '../../shared/descriptions';

const showOnlyForBrandingProfiles = { resource: ['brandingProfile'] };

export const brandingProfileDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForBrandingProfiles },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many branding profiles',
				description:
					'List the branding profiles of your organization. They are organization settings, so the same profiles answer on a sandbox and on a production key.',
				routing: {
					request: { method: 'GET', url: '/api/v1/branding_profiles' },
					output: { postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }] },
				},
			},
		],
		default: 'getAll',
	},
	...paginationDescription({ operation: ['getAll'], resource: ['brandingProfile'] }),
];
