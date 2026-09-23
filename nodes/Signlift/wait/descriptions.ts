import type { INodeProperties } from 'n8n-workflow';

const showForBothCreators = {
	operation: ['create', 'sendForSignature'],
	resource: ['signatureRequest'],
};

export const waitDescription: INodeProperties[] = [
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: false,
		displayOptions: { show: showForBothCreators },
		description:
			'Whether to pause this execution until every signer has signed, and resume it with the envelope. Needs this n8n reachable over HTTPS and the webhook secret filled in on the credential.',
	},
	{
		displayName:
			'This execution will pause until Signlift calls back. One item at a time: an execution suspends once, so put the node behind a Loop Over Items to send several envelopes.',
		name: 'waitNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...showForBothCreators, waitForCompletion: [true] } },
	},
	{
		displayName: 'Limit Wait Time',
		name: 'limitWaitTime',
		type: 'boolean',
		default: false,
		displayOptions: { show: { ...showForBothCreators, waitForCompletion: [true] } },
		description:
			'Whether to give up once the envelope has expired. An expiring envelope already resumes the execution on its own, so this only covers a callback that never arrives — and on a timeout n8n forwards the input rather than the envelope.',
	},
];
