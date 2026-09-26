import {
	NodeApiError,
	NodeOperationError,
	WAIT_INDEFINITELY,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type JsonObject,
	type NodeOutput,
} from 'n8n-workflow';
import { buildPayload } from '../resources/signatureRequest/create';
import { documentUploadFormData } from '../resources/document/upload';
import { singleItemContext } from './resumeContext';
import { baseUrlFor } from '../shared/baseUrl';
import { subscribeToEnvelope } from '../resources/signatureRequest/subscribe';

/** A day of slack on top of the envelope's own expiry. */
const DEADLINE_MARGIN_MS = 24 * 60 * 60 * 1000;

/** Signlift refuses a callback that is not https, and says so with a 422. */
function assertResumableOverHttps(context: IExecuteFunctions, resumeUrl: string): void {
	if (resumeUrl.startsWith('https://')) return;

	throw new NodeOperationError(
		context.getNode(),
		`Waiting needs this n8n to be reachable over HTTPS, and its resume URL is ${resumeUrl}`,
		{
			description:
				'Signlift only calls back on https, for a waiting execution as for a registered endpoint. Set WEBHOOK_URL to a public https address, or turn off "Wait for Completion" and poll the envelope with Get.',
		},
	);
}

export async function signatureRequestWithWait(this: IExecuteFunctions): Promise<NodeOutput> {
	const operation = this.getNodeParameter('operation', 0) as string;
	const waits = this.getNodeParameter('waitForCompletion', 0, false) as boolean;
	const items = this.getInputData();

	if (!waits) return await withoutWaiting.call(this, operation, items);

	// An execution suspends once, so a batch cannot each have its own resume
	// url. Refused rather than silently sending the first and dropping the rest.
	if (items.length > 1) {
		throw new NodeOperationError(
			this.getNode(),
			`Waiting for completion handles one item per execution, and this node received ${items.length}. Turn off "Wait for Completion", or put the node behind a Loop Over Items.`,
		);
	}

	const resumeUrl = this.evaluateExpression('{{ $execution.resumeUrl }}', 0) as string;
	assertResumableOverHttps(this, resumeUrl);

	const credentials = await this.getCredentials('signliftApi');
	if (!credentials.webhookSecret) {
		throw new NodeOperationError(this.getNode(), 'No webhook secret configured', {
			description:
				'Waiting authenticates the callback with the webhook secret of your Signlift application. Add it to the credential, or turn off "Wait for Completion".',
		});
	}

	const envelope = await createEnvelope.call(this, operation, 0, resumeUrl);

	await this.putExecutionToWait(deadlineOf.call(this, envelope));

	return [[{ json: envelope }]];
}

/** The declarative path, kept for when the option is off. */
async function withoutWaiting(
	this: IExecuteFunctions,
	operation: string,
	items: INodeExecutionData[],
): Promise<NodeOutput> {
	const results: INodeExecutionData[] = [];

	for (let index = 0; index < items.length; index++) {
		try {
			results.push({
				json: await createEnvelope.call(this, operation, index),
				pairedItem: { item: index },
			});
		} catch (error) {
			if (!this.continueOnFail()) {
				throw error instanceof NodeOperationError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject);
			}

			results.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
		}
	}

	return [results];
}

async function createEnvelope(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
	callbackUrl?: string,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('signliftApi');
	const baseURL = baseUrlFor(credentials);

	const documentId =
		operation === 'sendForSignature'
			? await uploadDocument.call(this, itemIndex, baseURL)
			: (this.getNodeParameter('documentId', itemIndex) as number);

	const payload = buildPayload.call(singleItemContext(this, itemIndex), documentId);
	if (callbackUrl) payload.callback_url = callbackUrl;

	const envelope = (await this.helpers.httpRequestWithAuthentication.call(this, 'signliftApi', {
		method: 'POST',
		url: '/api/v1/signature_requests',
		baseURL,
		body: { signature_request: payload },
		json: true,
	})) as IDataObject;

	await subscribeToEnvelope.call(this, itemIndex, envelope, baseURL);

	return envelope;
}

async function uploadDocument(
	this: IExecuteFunctions,
	itemIndex: number,
	baseURL: string,
): Promise<number> {
	const property = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
	const binary = this.helpers.assertBinaryData(itemIndex, property);
	const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, property);

	let document: IDataObject;
	try {
		document = (await this.helpers.httpRequestWithAuthentication.call(this, 'signliftApi', {
			method: 'POST',
			url: '/api/v1/documents',
			baseURL,
			body: documentUploadFormData(buffer, binary.fileName),
			json: true,
		})) as IDataObject;
	} catch (error) {
		// Without this the failure names /api/v1/documents under an operation
		// the interface says posts to /api/v1/signature_requests.
		throw new NodeOperationError(this.getNode(), error as Error, {
			message: 'Uploading the document failed, so no signature request was created',
		});
	}

	if (typeof document.id !== 'number') {
		throw new NodeOperationError(this.getNode(), 'The upload answered without a document id', {
			description: 'No signature request was created. This is an API contract change.',
		});
	}

	return document.id;
}

/**
 * Indefinite by default, as n8n's own Wait node is when it resumes on a
 * webhook. An expiring envelope does not need a deadline here: `request.expired`
 * is terminal, so Signlift delivers it to the callback and the execution
 * resumes with the envelope in hand.
 *
 * The limit is therefore only a guard against a callback that never arrives at
 * all — this n8n unreachable for longer than Signlift retries, some thirteen
 * hours. Worth knowing before turning it on: on a deadline n8n disables the
 * node and forwards its input, so the envelope does NOT come out that way.
 */
function deadlineOf(this: IExecuteFunctions, envelope: IDataObject): Date {
	if (this.getNodeParameter('limitWaitTime', 0, false) !== true) return WAIT_INDEFINITELY;

	const expiresAt = envelope.expires_at as string | undefined;
	const expiry = expiresAt ? Date.parse(expiresAt) : NaN;

	if (Number.isNaN(expiry)) return WAIT_INDEFINITELY;

	return new Date(expiry + DEADLINE_MARGIN_MS);
}
