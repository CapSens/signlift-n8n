import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IHookFunctions,
	type IHttpRequestMethods,
	type JsonObject,
} from 'n8n-workflow';
import { baseUrlFor } from '../Signlift/shared/baseUrl';

export const ENDPOINTS_PATH = '/api/v1/webhook_endpoints';

/** Kept in step with WebhookEndpoint::MAX_PER_APPLICATION on the API side. */
export const MAX_APPLICATION_WIDE = 3;

interface Endpoint {
	id: number;
	url: string;
	events: string[];
	active: boolean;
	signature_request_id: number | null;
}

async function call(
	this: IHookFunctions,
	options: { method: IHttpRequestMethods; url: string; body?: IDataObject; qs?: IDataObject },
): Promise<IDataObject> {
	const credentials = await this.getCredentials('signliftApi');

	return (await this.helpers.httpRequestWithAuthentication.call(this, 'signliftApi', {
		baseURL: baseUrlFor(credentials),
		json: true,
		...options,
	})) as IDataObject;
}

function subscribesToEverything(context: IHookFunctions): boolean {
	return context.getNodeParameter('subscribeTo', 'all') === 'all';
}

/**
 * Refused rather than sent: an empty list means "every event" to the API, so
 * a user who unticks everything would be subscribed to more than they were,
 * not less.
 */
function selectedEvents(context: IHookFunctions): string[] {
	const events = (context.getNodeParameter('events', []) as string[]) ?? [];
	if (events.length > 0) return events;

	throw new NodeOperationError(context.getNode(), 'No event selected', {
		description:
			'Pick at least one event. An empty selection would subscribe this workflow to every event Signlift emits, which is the opposite of what unticking them all suggests.',
	});
}

function webhookUrlOf(context: IHookFunctions): string {
	const url = context.getNodeWebhookUrl('default') as string;

	if (url?.startsWith('https://')) return url;

	throw new NodeOperationError(
		context.getNode(),
		`Signlift only calls back on HTTPS, and this workflow's URL is ${url}`,
		{
			description:
				'Set WEBHOOK_URL to a public https address so n8n hands out one Signlift can reach, or switch "Subscribe To" to "Only Requests Pointed at This URL" and route envelopes here yourself.',
		},
	);
}

function sameEvents(registered: string[], wanted: string[]): boolean {
	return (
		registered.length === wanted.length && [...registered].sort().join() === [...wanted].sort().join()
	);
}

async function findByUrl(this: IHookFunctions, url: string): Promise<Endpoint | undefined> {
	const response = await call.call(this, { method: 'GET', url: ENDPOINTS_PATH, qs: { url } });

	// Active ones only, which is what the API lists by default: an endpoint
	// this workflow unregistered must be registered again, not recognised.
	return (response.data as Endpoint[] | undefined)?.[0];
}

export async function checkExists(this: IHookFunctions): Promise<boolean> {
	const staticData = this.getWorkflowStaticData('node');

	// Nothing to register, so nothing to check. Whatever this node registered
	// under the other mode is still unregistered by delete(), which n8n runs
	// with the parameters the workflow was activated on.
	if (!subscribesToEverything(this)) return true;

	const existing = await findByUrl.call(this, webhookUrlOf(this));
	if (!existing) return false;

	staticData.endpointId = existing.id;

	// Registered, but for other events than the node now asks for. Answering
	// false sends n8n to create(), and registering a known URL updates its
	// filter rather than refusing it as a duplicate.
	return sameEvents(existing.events ?? [], selectedEvents(this));
}

export async function create(this: IHookFunctions): Promise<boolean> {
	if (!subscribesToEverything(this)) return true;

	const url = webhookUrlOf(this);
	const events = selectedEvents(this);

	let endpoint: IDataObject;
	try {
		endpoint = await call.call(this, {
			method: 'POST',
			url: ENDPOINTS_PATH,
			body: { webhook_endpoint: { url, events } },
		});
	} catch (error) {
		throw await explainRefusal.call(this, error);
	}

	this.getWorkflowStaticData('node').endpointId = endpoint.id;

	return true;
}

export async function remove(this: IHookFunctions): Promise<boolean> {
	const staticData = this.getWorkflowStaticData('node');
	const endpointId = staticData.endpointId;

	// Keyed on what was registered rather than on what the form says now: a
	// node switched to "routed" after being activated still owns the
	// subscription it took out, and this is where it gives it back.
	if (endpointId === undefined) return true;

	try {
		await call.call(this, { method: 'DELETE', url: `${ENDPOINTS_PATH}/${String(endpointId)}` });
	} catch (error) {
		// Gone already, or registered under a key this credential has since
		// replaced. Either way this URL is no longer subscribed, which is all
		// deactivating the workflow asked for.
		if (statusOf(error) !== 404) throw new NodeApiError(this.getNode(), error as JsonObject);
	}

	delete staticData.endpointId;

	return true;
}

function statusOf(error: unknown): number | undefined {
	const candidate = error as { httpCode?: string; statusCode?: number };

	return candidate.statusCode ?? (candidate.httpCode ? Number(candidate.httpCode) : undefined);
}

/**
 * The ceiling is the one refusal worth translating, and it is recognised by
 * counting rather than by reading the message: the API answers in the
 * caller's language, so matching on its wording would work in French and
 * quietly stop working in English. When the count does not confirm it, the
 * API's own error is what surfaces.
 */
async function explainRefusal(this: IHookFunctions, error: unknown): Promise<Error> {
	if (statusOf(error) !== 422) return error as Error;

	let occupied: Endpoint[];
	try {
		const response = await call.call(this, {
			method: 'GET',
			url: ENDPOINTS_PATH,
			qs: { limit: 100 },
		});

		// Only the application-wide ones share the ceiling a trigger competes
		// for. An endpoint bound to an envelope counts against that envelope.
		occupied = ((response.data as Endpoint[] | undefined) ?? []).filter(
			(endpoint) => endpoint.signature_request_id === null,
		);
	} catch {
		return error as Error;
	}

	if (occupied.length < MAX_APPLICATION_WIDE) return error as Error;

	return new NodeOperationError(
		this.getNode(),
		`This API key already has ${String(occupied.length)} subscriptions covering every envelope, which is the limit`,
		{
			description: `Unregister one to free a slot: ${occupied
				.map((endpoint) => endpoint.url)
				.join(', ')}. One workflow subscribed to several events, with a Switch after it, costs a single slot.`,
		},
	);
}
