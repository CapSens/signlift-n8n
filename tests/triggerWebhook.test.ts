import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SignliftTrigger } from '../nodes/SignliftTrigger/SignliftTrigger.node';

const SECRET = 'whsec_test';

function sign(body: string, secret = SECRET) {
	return `sha256=${createHmac('sha256', secret).update(Buffer.from(body)).digest('hex')}`;
}

function webhookContext({
	body = { event: 'request.completed', signature_request: { id: 7 } },
	headers = {},
	secret = SECRET as string | undefined,
	events = ['request.completed'],
	staticData = {} as Record<string, unknown>,
	signature = undefined as string | undefined,
} = {}) {
	const raw = JSON.stringify(body);
	const status = vi.fn().mockReturnThis();
	const json = vi.fn();

	return {
		context: {
			getNode: () => ({ name: 'Signlift Trigger' }),
			getCredentials: vi.fn(async () => ({ webhookSecret: secret })),
			getHeaderData: () => ({
				'x-signlift-event': body.event,
				'x-signlift-signature': signature ?? sign(raw),
				...headers,
			}),
			getRequestObject: () => ({
				readRawBody: vi.fn(async () => undefined),
				rawBody: Buffer.from(raw),
			}),
			getResponseObject: () => ({ status, json }),
			getBodyData: () => body,
			getNodeParameter: vi.fn(() => events),
			getWorkflowStaticData: vi.fn(() => staticData),
			helpers: { returnJsonArray: (value: unknown) => [value] },
		},
		status,
		json,
		staticData,
	};
}

const run = async (setup: Parameters<typeof webhookContext>[0] = {}) => {
	const fixture = webhookContext(setup);
	const result = await new SignliftTrigger().webhook.call(fixture.context as never);
	return { ...fixture, result };
};

describe('SignliftTrigger webhook', () => {
	it('starts the workflow on a correctly signed event', async () => {
		const { result } = await run();

		expect(result.workflowData).toEqual([[{ event: 'request.completed', delivery_id: undefined, signature_request: { id: 7 } }]]);
	});

	it('carries the delivery id into the workflow data', async () => {
		const { result } = await run({ headers: { 'x-signlift-delivery': '42' } });

		expect((result.workflowData as never as Array<Array<{ delivery_id: string }>>)[0][0].delivery_id).toBe('42');
	});

	it('refuses to run without a configured secret', async () => {
		await expect(run({ secret: '' })).rejects.toThrow(/No webhook secret configured/);
	});

	it('answers 401 on a signature computed with another secret', async () => {
		const { result, status } = await run({ signature: sign('{"event":"x"}', 'whsec_other') });

		expect(status).toHaveBeenCalledWith(401);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('answers 401 when the signature header is missing', async () => {
		const { status } = await run({ signature: '' });

		expect(status).toHaveBeenCalledWith(401);
	});

	it('answers 401 on a signature with no sha256 prefix', async () => {
		const { status } = await run({ signature: 'a'.repeat(64) });

		expect(status).toHaveBeenCalledWith(401);
	});

	// Buffer.from(str, 'hex') stops at the first bad pair instead of throwing,
	// so a same-length malformed signature would decode short and make
	// timingSafeEqual throw — reachable without knowing the secret.
	it('rejects a malformed hex signature without crashing', async () => {
		const { status } = await run({ signature: `sha256=${'z'.repeat(64)}` });

		expect(status).toHaveBeenCalledWith(401);
	});

	it('rejects a signature of the wrong length', async () => {
		const { status } = await run({ signature: 'sha256=abcd' });

		expect(status).toHaveBeenCalledWith(401);
	});

	it('ignores an event the node was not asked to listen for', async () => {
		const { result } = await run({
			body: { event: 'signer.signed', signature_request: { id: 7 } },
			events: ['request.completed'],
		});

		expect(result).toEqual({ webhookResponse: { status: 'ignored' } });
	});

	// Signlift retries whenever it does not get a 2xx in five seconds, so a
	// lost acknowledgement alone would fire the workflow twice.
	it('acknowledges a replayed delivery without running the workflow again', async () => {
		const staticData = { seenDeliveries: ['42'] };

		const { result } = await run({ headers: { 'x-signlift-delivery': '42' }, staticData });

		expect(result).toEqual({ webhookResponse: { status: 'duplicate' } });
	});

	it('remembers a delivery it has just accepted', async () => {
		const staticData: Record<string, unknown> = {};

		await run({ headers: { 'x-signlift-delivery': '99' }, staticData });

		expect(staticData.seenDeliveries).toEqual(['99']);
	});

	it('keeps the remembered deliveries bounded', async () => {
		const staticData = { seenDeliveries: Array.from({ length: 200 }, (_, i) => `d${i}`) };

		await run({ headers: { 'x-signlift-delivery': 'fresh' }, staticData });

		const seen = staticData.seenDeliveries as string[];
		expect(seen).toHaveLength(200);
		expect(seen.at(-1)).toBe('fresh');
		expect(seen).not.toContain('d0');
	});

	it('runs the workflow when no delivery header is sent at all', async () => {
		const { result } = await run({ headers: { 'x-signlift-delivery': undefined } });

		expect(result).toHaveProperty('workflowData');
	});
});

describe('SignliftTrigger webhookMethods', () => {
	// Signlift has no webhook management API: the URL is pasted by hand, so
	// there is nothing to register, verify or clean up.
	it.each(['checkExists', 'create', 'delete'] as const)('%s is a no-op that succeeds', async (method) => {
		const trigger = new SignliftTrigger();

		await expect(trigger.webhookMethods.default[method].call({} as never)).resolves.toBe(true);
	});
});
