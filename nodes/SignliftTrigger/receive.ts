import {
	NodeOperationError,
	type IDataObject,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { isSignatureValid } from '../Signlift/shared/signature';

/**
 * Anything can post to a public webhook URL, so the HMAC is what makes an
 * incoming body an event rather than a claim. Refused with a 401 and no
 * execution, not with a failed one: a run per stray request would be a way to
 * fill someone's execution list from the outside.
 */
export async function receiveEvent(this: IWebhookFunctions): Promise<IWebhookResponseData> {
	const credentials = await this.getCredentials('signliftApi');
	const secret = credentials.webhookSecret as string;

	if (!secret) {
		throw new NodeOperationError(this.getNode(), 'No webhook secret configured', {
			description:
				'Add the webhook secret of your Signlift application to the credential. Without it an event cannot be told apart from anything else posting to this URL.',
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

	// Checked again here, although Signlift filters on its side: an endpoint
	// registered by someone else can point at this URL with any subscription,
	// and the node promises the events its own form lists.
	const event = headers['x-signlift-event'] as string | undefined;
	const wanted = (this.getNodeParameter('events', []) as string[]) ?? [];

	if (event !== undefined && wanted.length > 0 && !wanted.includes(event)) {
		return { webhookResponse: { status: 'ignored' } };
	}

	return {
		workflowData: [
			this.helpers.returnJsonArray({ event, ...(this.getBodyData() as IDataObject) }),
		],
	};
}
