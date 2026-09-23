import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { resumeOnCallback } from '../nodes/Signlift/wait/resume';

const SECRET = 'whsec_test';

function callbackContext({
	body = { event: 'request.completed', signature_request: { id: 7, status: 'completed' } },
	event = 'request.completed' as string | undefined,
	secret = SECRET as string | undefined,
	signature = undefined as string | undefined,
} = {}) {
	const raw = JSON.stringify(body);
	const status = vi.fn().mockReturnThis();
	const json = vi.fn();

	return {
		context: {
			getNode: () => ({ name: 'Signlift' }),
			getCredentials: vi.fn(async () => ({ webhookSecret: secret })),
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

const run = async (setup: Parameters<typeof callbackContext>[0] = {}) => {
	const fixture = callbackContext(setup);
	return { ...fixture, result: await resumeOnCallback.call(fixture.context as never) };
};

describe('resumeOnCallback', () => {
	it('resumes the execution with the envelope', async () => {
		const { result } = await run();

		expect(result.workflowData).toEqual([
			[{ event: 'request.completed', signature_request: { id: 7, status: 'completed' } }],
		]);
	});

	// request.expired is terminal too, so an envelope that ran out of time
	// comes back through here rather than through a timeout.
	it('resumes on an expired envelope as it does on a completed one', async () => {
		const { result } = await run({
			body: { event: 'request.expired', signature_request: { id: 7, status: 'expired' } },
			event: 'request.expired',
		});

		expect(result).toHaveProperty('workflowData');
	});

	it('answers 401 on a signature that does not match', async () => {
		const { result, status } = await run({ signature: `sha256=${'a'.repeat(64)}` });

		expect(status).toHaveBeenCalledWith(401);
		expect(result).toEqual({ noWebhookResponse: true });
	});

	it('refuses to run without a configured secret', async () => {
		await expect(run({ secret: '' })).rejects.toThrow(/No webhook secret configured/);
	});

	// An intermediate event here means the resume url was also set as the
	// application webhook; resuming would wake an unsigned envelope.
	it('ignores an intermediate event instead of resuming on it', async () => {
		const { result } = await run({
			body: { event: 'signer.signed', signature_request: { id: 7 } },
			event: 'signer.signed',
		});

		expect(result).toEqual({ webhookResponse: { status: 'ignored' } });
	});

	it('resumes when no event header is sent at all', async () => {
		const { result } = await run({ event: undefined });

		expect(result).toHaveProperty('workflowData');
	});
});
