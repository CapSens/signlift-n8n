import { describe, expect, it, vi } from 'vitest';
import { subscribeToEnvelope } from '../nodes/Signlift/resources/signatureRequest/subscribe';

const BASE_URL = 'https://app.staging-signlift.eu';

function executeContext({
	subscription = {} as Record<string, unknown>,
	failure = undefined as Error | undefined,
} = {}) {
	const sent: Array<Record<string, unknown>> = [];

	return {
		getNode: () => ({ name: 'Signlift' }),
		getNodeParameter: vi.fn((name: string, _index: number, fallback?: unknown) =>
			name === 'subscription' ? subscription : fallback,
		),
		helpers: {
			httpRequestWithAuthentication: {
				call: vi.fn(async (_context: unknown, _name: string, options: Record<string, unknown>) => {
					sent.push(options);
					if (failure) throw failure;

					return { id: 44 };
				}),
			},
		},
		sent,
	};
}

const run = async (setup: Parameters<typeof executeContext>[0] = {}) => {
	const context = executeContext(setup);
	await subscribeToEnvelope.call(context as never, 0, { id: 7 }, BASE_URL);

	return context;
};

describe('subscribeToEnvelope', () => {
	it('registers nothing when no url was given', async () => {
		const context = await run();

		expect(context.sent).toHaveLength(0);
	});

	it('registers nothing for a url that is only whitespace', async () => {
		const context = await run({ subscription: { url: '   ' } });

		expect(context.sent).toHaveLength(0);
	});

	it('binds the url to the envelope it was just handed', async () => {
		const context = await run({
			subscription: { url: 'https://n8n.test/webhook/x', events: ['signer.signed'] },
		});

		expect(context.sent[0]).toMatchObject({
			method: 'POST',
			url: '/api/v1/webhook_endpoints',
			baseURL: BASE_URL,
			body: {
				webhook_endpoint: {
					url: 'https://n8n.test/webhook/x',
					events: ['signer.signed'],
					signature_request_id: 7,
				},
			},
		});
	});

	it('falls back to the terminal events when none were picked', async () => {
		const context = await run({ subscription: { url: 'https://n8n.test/webhook/x' } });

		expect(
			(context.sent[0].body as { webhook_endpoint: { events: string[] } }).webhook_endpoint.events,
		).toEqual(['request.completed', 'request.expired']);
	});

	// Silence here would leave a signature request running with nobody
	// listening for its outcome, which is the whole point of subscribing.
	it('fails loudly, naming the envelope that was created anyway', async () => {
		await expect(
			run({
				subscription: { url: 'https://n8n.test/webhook/x' },
				failure: new Error('422'),
			}),
		).rejects.toThrow(/Signature request 7 was created, but subscribing/);
	});
});
