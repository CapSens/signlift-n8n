import type { INodeProperties } from 'n8n-workflow';
import { EVENT_OPTIONS } from '../Signlift/shared/events';

export const triggerDescription: INodeProperties[] = [
	{
		displayName: 'Events',
		name: 'events',
		type: 'multiOptions',
		required: true,
		options: EVENT_OPTIONS,
		default: ['request.completed', 'request.expired'],
		description:
			'Which events wake this workflow. Signlift filters on its side, and the node checks again on arrival, so an event you did not ask for never starts an execution.',
	},
	{
		displayName: 'Subscribe To',
		name: 'subscribeTo',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'All Signature Requests',
				value: 'all',
				description:
					'Register this workflow with Signlift, so every envelope created by this API key wakes it. Activating the workflow registers it, deactivating unregisters it.',
			},
			{
				name: 'Only Requests Pointed at This URL',
				value: 'routed',
				description:
					'Register nothing. Point envelopes here one at a time, with Subscribe a URL on Create or Send for Signature, or from your own backend.',
			},
		],
		default: 'all',
		description:
			'Whether the workflow subscribes to everything this API key creates, or only receives the envelopes explicitly pointed at it',
	},
];
