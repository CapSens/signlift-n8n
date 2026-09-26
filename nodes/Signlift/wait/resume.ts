import {
	NodeOperationError,
	type IDataObject,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { isSignatureValid } from '../shared/signature';

/** Only terminal events reach a callback, so anything else is not ours. */
const TERMINAL_EVENTS = ['request.completed', 'request.expired'];

/**
 * The resume. Signlift's callback body is what the node answers with, so an
 * expired envelope comes out as an envelope with `status: "expired"` rather
 * than as a failure — `request.expired` being terminal, it is delivered here
 * like a completion.
 */
export async function resumeOnCallback(this: IWebhookFunctions): Promise<IWebhookResponseData> {
	const credentials = await this.getCredentials('signliftApi');
	const secret = credentials.webhookSecret as string;

	if (!secret) {
		throw new NodeOperationError(this.getNode(), 'No webhook secret configured', {
			description:
				'The callback cannot be told apart from anything else posting to this URL without it.',
		});
	}

	// The signature covers the bytes Signlift sent. Re-serialising the parsed
	// body would produce different ones and never match.
	const request = this.getRequestObject();
	await request.readRawBody();

	const headers = this.getHeaderData() as IDataObject;
	if (!isSignatureValid(request.rawBody, headers['x-signlift-signature'] as string, secret)) {
		this.getResponseObject().status(401).json({ error: 'invalid signature' });

		return { noWebhookResponse: true };
	}

	// Signlift only ever posts terminal events to a callback. An intermediate
	// one arriving here means this URL was also set as the application
	// webhook, and resuming on it would wake an execution whose envelope is
	// still unsigned.
	const event = headers['x-signlift-event'] as string | undefined;
	if (event && !TERMINAL_EVENTS.includes(event)) {
		return { webhookResponse: { status: 'ignored' } };
	}

	return {
		workflowData: [
			this.helpers.returnJsonArray({ event, ...(this.getBodyData() as IDataObject) }),
		],
	};
}
