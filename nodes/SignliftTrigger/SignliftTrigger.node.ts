import { createHmac, timingSafeEqual } from 'node:crypto';
import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type INodeType,
	type INodeTypeDescription,
	type IHookFunctions,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

/** Signlift replays a delivery up to five times over thirteen hours. */
const REMEMBERED_DELIVERIES = 200;

const HEX_SHA256 = /^[0-9a-f]{64}$/i;

interface TriggerStaticData {
	seenDeliveries?: string[];
}

export class SignliftTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Signlift Trigger',
		name: 'signliftTrigger',
		icon: { light: 'file:../../icons/signlift.svg', dark: 'file:../../icons/signlift.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when Signlift reports a signing event',
		defaults: {
			name: 'Signlift Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'signliftApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Paste the URL above into your Signlift external application, under <b>Webhook URL</b>. Signlift sends every event to that one URL; the node filters them below.',
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['request.completed'],
				description: 'Events that start the workflow. Others are acknowledged and ignored.',
				options: [
					{
						name: 'Request Completed',
						value: 'request.completed',
						description:
							'Every signer has signed. Carries fresh download links for the sealed PDFs and the evidence file.',
					},
					{
						name: 'Request Expired',
						value: 'request.expired',
						description: 'The validity period elapsed without every signer signing',
					},
					{
						name: 'Signer Notified',
						value: 'signer.notified',
						description: 'An invitation was sent to a signer',
					},
					{
						name: 'Signer OTP Sent',
						value: 'signer.otp_sent',
						description: 'A one-time code was sent to a signer',
					},
					{
						name: 'Signer Signed',
						value: 'signer.signed',
						description: 'One signer signed. Others may still be pending.',
					},
				],
			},
		],
	};

	// Signlift carries one webhook URL per external application, set in the
	// dashboard, and exposes no endpoint to change it. The registration is
	// therefore managed outside n8n, which is what these three say: the
	// webhook already exists, and there is nothing for n8n to create or to
	// clean up. Should the API gain a registration endpoint, `create` and
	// `delete` are where it goes.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const headers = this.getHeaderData() as IDataObject;
		const event = headers['x-signlift-event'] as string | undefined;
		const delivery = headers['x-signlift-delivery'] as string | undefined;
		const signature = headers['x-signlift-signature'] as string | undefined;

		const credentials = await this.getCredentials('signliftApi');
		const secret = credentials.webhookSecret as string;

		if (!secret) {
			throw new NodeOperationError(this.getNode(), 'No webhook secret configured', {
				description:
					'Add the webhook secret to your Signlift credential. Without it an event cannot be told apart from anything else posting to this URL.',
			});
		}

		// The signature covers the bytes Signlift sent. Re-serialising the parsed
		// body would produce different ones, and the comparison would never match.
		const request = this.getRequestObject();
		await request.readRawBody();
		const rawBody = request.rawBody;

		if (!isSignatureValid(rawBody, signature, secret)) {
			const response = this.getResponseObject();
			response.status(401).json({ error: 'invalid signature' });

			return { noWebhookResponse: true };
		}

		// Acknowledge a replay without running the workflow again. Signlift
		// retries whenever it does not get a 2xx in five seconds, so a lost
		// acknowledgement alone would otherwise fire the workflow twice.
		if (delivery && alreadySeen.call(this, delivery)) {
			return { webhookResponse: { status: 'duplicate' } };
		}

		const events = this.getNodeParameter('events') as string[];
		if (event && !events.includes(event)) {
			return { webhookResponse: { status: 'ignored' } };
		}

		return {
			workflowData: [
				this.helpers.returnJsonArray({
					event,
					delivery_id: delivery,
					...(this.getBodyData() as IDataObject),
				}),
			],
		};
	}
}

function isSignatureValid(
	rawBody: Buffer,
	signature: string | undefined,
	secret: string,
): boolean {
	if (!signature?.startsWith('sha256=')) return false;

	const received = signature.slice('sha256='.length);

	// Checked before decoding, and on the shape rather than the length alone:
	// Buffer.from(str, 'hex') stops at the first non-hex pair instead of
	// throwing, so a same-length but malformed signature would decode to a
	// shorter buffer and make timingSafeEqual throw. Anyone could reach that
	// without knowing the secret.
	if (!HEX_SHA256.test(received)) return false;

	const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

	return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

function alreadySeen(this: IWebhookFunctions, delivery: string): boolean {
	const staticData = this.getWorkflowStaticData('node') as TriggerStaticData;
	const seen = staticData.seenDeliveries ?? [];

	if (seen.includes(delivery)) return true;

	seen.push(delivery);
	// Bounded on purpose: n8n keeps this in the workflow record, and it is
	// meant to stay small.
	staticData.seenDeliveries = seen.slice(-REMEMBERED_DELIVERIES);

	return false;
}
