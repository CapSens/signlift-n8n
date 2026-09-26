import { describe, expect, it, vi } from 'vitest';
import { checkExists, create, remove } from '../nodes/SignliftTrigger/subscription';

const WEBHOOK_URL = 'https://n8n.example.test/webhook/abc';

function apiError(statusCode: number) {
	return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
}

function appWide(id: number, url: string, events = ['request.completed']) {
	return { id, url, events, active: true, signature_request_id: null };
}

function hookContext({
	parameters = {} as Record<string, unknown>,
	webhookUrl = WEBHOOK_URL as string,
	staticData = {} as Record<string, unknown>,
	responses = [] as unknown[],
} = {}) {
	const queue = [...responses];
	const sent: Array<Record<string, unknown>> = [];

	return {
		getNode: () => ({ name: 'Signlift Trigger' }),
		getNodeParameter: vi.fn((name: string, fallback?: unknown) =>
			name in parameters ? parameters[name] : fallback,
		),
		getNodeWebhookUrl: vi.fn(() => webhookUrl),
		getWorkflowStaticData: vi.fn(() => staticData),
		getCredentials: vi.fn(async () => ({ deployment: 'staging' })),
		helpers: {
			httpRequestWithAuthentication: {
				call: vi.fn(async (_context: unknown, _name: string, options: Record<string, unknown>) => {
					sent.push(options);
					const next = queue.shift();
					if (next instanceof Error) throw next;

					return next ?? {};
				}),
			},
		},
		sent,
		staticData,
	};
}

describe('checkExists', () => {
	it('registers nothing in routed mode', async () => {
		const context = hookContext({ parameters: { subscribeTo: 'routed' } });

		await expect(checkExists.call(context as never)).resolves.toBe(true);
		expect(context.sent).toHaveLength(0);
	});

	it('recognises its own registration and remembers its id', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [{ data: [appWide(12, WEBHOOK_URL)] }],
		});

		await expect(checkExists.call(context as never)).resolves.toBe(true);
		expect(context.staticData.endpointId).toBe(12);
		expect(context.sent[0].qs).toEqual({ url: WEBHOOK_URL });
	});

	// Answering false sends n8n to create(), and registering a known URL
	// updates its filter rather than refusing it as a duplicate.
	it('asks to be registered again when the event filter has drifted', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed', 'signer.signed'] },
			responses: [{ data: [appWide(12, WEBHOOK_URL)] }],
		});

		await expect(checkExists.call(context as never)).resolves.toBe(false);
		expect(context.staticData.endpointId).toBe(12);
	});

	it('is not registered when the listing comes back empty', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [{ data: [] }],
		});

		await expect(checkExists.call(context as never)).resolves.toBe(false);
	});

	it('is not registered when the listing carries no data at all', async () => {
		const context = hookContext({ parameters: { events: ['request.completed'] }, responses: [{}] });

		await expect(checkExists.call(context as never)).resolves.toBe(false);
	});

	// An endpoint the API answered without an events key reads as subscribed
	// to everything, which is not what the node asked for.
	it('asks to be registered again for an endpoint with no event list', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [{ data: [{ id: 12, url: WEBHOOK_URL, active: true, signature_request_id: null }] }],
		});

		await expect(checkExists.call(context as never)).resolves.toBe(false);
	});

	it('refuses a webhook url Signlift cannot call back on', async () => {
		const context = hookContext({ webhookUrl: 'http://localhost:5678/webhook/abc' });

		await expect(checkExists.call(context as never)).rejects.toThrow(/only calls back on HTTPS/);
	});

	// An empty list means "every event" to the API, so unticking everything
	// would subscribe to more than before rather than to less.
	it('refuses an empty event selection', async () => {
		const context = hookContext({
			parameters: { events: [] },
			responses: [{ data: [appWide(12, WEBHOOK_URL)] }],
		});

		await expect(checkExists.call(context as never)).rejects.toThrow(/No event selected/);
	});
});

describe('create', () => {
	it('registers nothing in routed mode', async () => {
		const context = hookContext({ parameters: { subscribeTo: 'routed' } });

		await expect(create.call(context as never)).resolves.toBe(true);
		expect(context.sent).toHaveLength(0);
	});

	it('registers the url with the selected events', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed', 'signer.signed'] },
			responses: [{ id: 31 }],
		});

		await expect(create.call(context as never)).resolves.toBe(true);
		expect(context.sent[0]).toMatchObject({
			method: 'POST',
			url: '/api/v1/webhook_endpoints',
			body: {
				webhook_endpoint: {
					url: WEBHOOK_URL,
					events: ['request.completed', 'signer.signed'],
				},
			},
		});
		expect(context.staticData.endpointId).toBe(31);
	});

	it('names the urls holding the slots when the ceiling is reached', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [
				apiError(422),
				{
					data: [
						appWide(1, 'https://one.test/hook'),
						appWide(2, 'https://two.test/hook'),
						appWide(3, 'https://three.test/hook'),
					],
				},
			],
		});

		await expect(create.call(context as never)).rejects.toThrow(/already has 3 subscriptions/);
	});

	// A subscription bound to an envelope counts against that envelope, not
	// against the key. Counting it here would blame the wrong ceiling.
	it('leaves envelope-bound endpoints out of the count', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [
				apiError(422),
				{
					data: [
						appWide(1, 'https://one.test/hook'),
						{ id: 2, url: 'https://two.test/hook', events: [], active: true, signature_request_id: 9 },
						{ id: 3, url: 'https://three.test/hook', events: [], active: true, signature_request_id: 8 },
					],
				},
			],
		});

		await expect(create.call(context as never)).rejects.toThrow(/HTTP 422/);
	});

	it('surfaces a refusal that is not the ceiling as the API worded it', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [apiError(422), { data: [] }],
		});

		await expect(create.call(context as never)).rejects.toThrow(/HTTP 422/);
	});

	it('surfaces the original refusal when the listing carries no data', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [apiError(422), {}],
		});

		await expect(create.call(context as never)).rejects.toThrow(/HTTP 422/);
	});

	it('surfaces the original refusal when the listing itself fails', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [apiError(422), apiError(500)],
		});

		await expect(create.call(context as never)).rejects.toThrow(/HTTP 422/);
	});

	it('surfaces anything that is not a 422 untouched', async () => {
		const context = hookContext({
			parameters: { events: ['request.completed'] },
			responses: [apiError(401)],
		});

		await expect(create.call(context as never)).rejects.toThrow(/HTTP 401/);
		expect(context.sent).toHaveLength(1);
	});
});

describe('remove', () => {
	it('has nothing to unregister when nothing was registered', async () => {
		const context = hookContext();

		await expect(remove.call(context as never)).resolves.toBe(true);
		expect(context.sent).toHaveLength(0);
	});

	it('unregisters the endpoint and forgets it', async () => {
		const context = hookContext({ staticData: { endpointId: 31 } });

		await expect(remove.call(context as never)).resolves.toBe(true);
		expect(context.sent[0]).toMatchObject({
			method: 'DELETE',
			url: '/api/v1/webhook_endpoints/31',
		});
		expect(context.staticData.endpointId).toBeUndefined();
	});

	// Registered under a key this credential has since replaced, or already
	// unregistered. Either way the URL is not subscribed any more.
	it('treats a 404 as the unregistration it asked for', async () => {
		const context = hookContext({ staticData: { endpointId: 31 }, responses: [apiError(404)] });

		await expect(remove.call(context as never)).resolves.toBe(true);
		expect(context.staticData.endpointId).toBeUndefined();
	});

	it('keeps the id when the unregistration fails for another reason', async () => {
		const context = hookContext({ staticData: { endpointId: 31 }, responses: [apiError(500)] });

		await expect(remove.call(context as never)).rejects.toThrow();
		expect(context.staticData.endpointId).toBe(31);
	});

	// NodeApiError spells the status as a string under httpCode, where a raw
	// http helper failure carries a numeric statusCode.
	it('reads the status off an error shaped like a NodeApiError', async () => {
		const context = hookContext({
			staticData: { endpointId: 31 },
			responses: [Object.assign(new Error('not found'), { httpCode: '404' })],
		});

		await expect(remove.call(context as never)).resolves.toBe(true);
		expect(context.staticData.endpointId).toBeUndefined();
	});

	// A node switched to "routed" after being activated still owns the
	// subscription it took out.
	it('unregisters what it registered even in routed mode', async () => {
		const context = hookContext({
			parameters: { subscribeTo: 'routed' },
			staticData: { endpointId: 31 },
		});

		await expect(remove.call(context as never)).resolves.toBe(true);
		expect(context.sent).toHaveLength(1);
	});
});
