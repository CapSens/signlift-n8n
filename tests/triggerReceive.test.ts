import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { receiveEvent } from '../nodes/SignliftTrigger/receive';

const SECRET = 'whsec_test';

function eventContext({
	body = { event: 'request.completed', signature_request: { id: 7, status: 'completed' } },
	event = 'request.completed' as string | undefined,
	events = ['request.completed', 'request.expired'] as string[],
	secret = SECRET as string | undefined,
	signature = undefined as string | undefined,
} = {}) {
	const raw = JSON.stringify(body);
	const status = vi.fn().mockReturnThis();
	const json = vi.fn();

	return {
		context: {
			getNode: () => ({ name: 'Signlift Trigger' }),
			getCredentials: vi.fn(async () => ({ webhookSecret: secret })),
			getNodeParameter: vi.fn(() => events),
			getHeaderData: () => ({
				'x-signlift-event': event,
				'x-signlift-signature':
					signature ?? `sha256=${createHmac('sha256', SECRET).update(Buffer.from(raw)).digest('hex')}`,
			}),
			getRequestObject: () => ({
				readRawBody: vi.fn(async () => undefined),
				rawBody: Buffer.from(raw),
			}),
			getResponseObject: () => ({ status, json }),
			getBodyData: () => body,
			helpers: { returnJsonArray: (value: unknown) => [value] },
		},
		status,
	};
}

const run = async (setup: Parameters<typeof eventContext>[0] = {}) => {
	const fixture = eventContext(setup);
	return { ...fixture, result: await receiveEvent.call(fixture.context as never) };
};

describe('receiveEvent', () => {
	it('starts the workflow with the event and the envelope', async () => {
		const { result } = await run();

		expect(result.workflowData).toEqual([
			[{ event: 'request.completed', signature_request: { id: 7, status: 'completed' } }],
		]);
	});

	it('takes an intermediate event when the node asked for it', async () => {
		const { result } = await run({
			body: { event: 'signer.signed', signature_request: { id: 7 } },
			event: 'signer.signed',
			events: ['signer.signed'],
		});

		expect(result).toHaveProperty('workflowData');
	});

	// Signlift filters on its side, but an endpoint registered by someone
	// else can point here with any subscription at all.
	it('ignores an event the node did not ask for', async () => {
		const { result } = await run({
			body: { event: 'signer.notified', signature_request: { id: 7 } },
			event: 'signer.notified',
		});

		expect(result).toEqual({ webhookResponse: { status: 'ignored' } });
	});

	it('takes anything when no event is selected at all', async () => {
		const { result } = await run({ events: [] });

		expect(result).toHaveProperty('workflowData');
	});

	it('takes a body that carries no event header', async () => {
		const { result } = await run({ event: undefined });

		expect(result).toHaveProperty('workflowData');
	});

	// Answered rather than executed: one run per stray request would be a way
	// to fill someone's execution list from the outside.
	it('answers 401 without starting anything on a bad signature', async () => {
		const { result, status } = await run({ signature: `sha256=${'a'.repeat(64)}` });

		expect(status).toHaveBeenCalledWith(401);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('refuses to run without a configured secret', async () => {
		await expect(run({ secret: '' })).rejects.toThrow(/No webhook secret configured/);
	});
});
