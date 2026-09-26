import {
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeProperties,
} from 'n8n-workflow';
import { EVENT_OPTIONS, TERMINAL_EVENTS } from '../../shared/events';

const showForBothCreators = {
	operation: ['create', 'sendForSignature'],
	resource: ['signatureRequest'],
};

export const subscriptionDescription: INodeProperties[] = [
	{
		displayName: 'Subscribe a URL to This Envelope',
		name: 'subscription',
		type: 'collection',
		placeholder: 'Add Subscription',
		default: {},
		displayOptions: { show: showForBothCreators },
		options: [
			{
				displayName: 'Notify URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'https://n8n.example.com/webhook/signlift',
				description:
					'Registered against this envelope alone, so the URL hears about it and nothing else. Typically the production URL of a Signlift Trigger set to "Only Requests Pointed at This URL", in the workflow that handles the outcome.',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENT_OPTIONS,
				default: ['request.completed', 'request.expired'],
				description:
					'Which of this envelope\'s events reach that URL. Unlike a waiting execution, a subscription can take the intermediate ones.',
			},
		],
	},
];

/**
 * Registered after the envelope exists, because the subscription names it.
 * Signlift unregisters it on its own once the envelope is settled, so a
 * workflow that subscribes per envelope leaves nothing behind to clean up.
 */
export async function subscribeToEnvelope(
	this: IExecuteFunctions,
	itemIndex: number,
	envelope: IDataObject,
	baseURL: string,
): Promise<void> {
	const subscription = (this.getNodeParameter('subscription', itemIndex, {}) as IDataObject) ?? {};
	const url = (subscription.url as string | undefined)?.trim();

	if (!url) return;

	const events = (subscription.events as string[] | undefined) ?? TERMINAL_EVENTS;

	try {
		await this.helpers.httpRequestWithAuthentication.call(this, 'signliftApi', {
			method: 'POST',
			url: '/api/v1/webhook_endpoints',
			baseURL,
			body: {
				webhook_endpoint: { url, events, signature_request_id: envelope.id },
			},
			json: true,
		});
	} catch (error) {
		// The envelope is already out. Failing loudly rather than swallowing
		// this is the point: silence would leave a signature request running
		// with nobody listening for its outcome.
		throw new NodeOperationError(this.getNode(), error as Error, {
			message: `Signature request ${String(envelope.id)} was created, but subscribing ${url} to it failed`,
			description:
				'The envelope exists and the signers can sign. Register the URL yourself with the Webhook Endpoint resource, or follow the envelope with Get.',
		});
	}
}
