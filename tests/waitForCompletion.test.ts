import { describe, expect, it } from 'vitest';
import { signatureRequestWithWait } from '../nodes/Signlift/wait/waitForCompletion';
import { executeContext, signerRow } from './helpers';

const BASE = {
	mode: 'sequential',
	validityDays: 30,
	signers: { signer: [signerRow()] },
	binaryPropertyName: 'data',
};

const ENVELOPE = { id: 7, status: 'pending', expires_at: '2026-12-31T00:00:00+01:00' };

const run = (context: ReturnType<typeof executeContext>) =>
	signatureRequestWithWait.call(context as never);

const callsOf = (context: ReturnType<typeof executeContext>) =>
	context.helpers.httpRequestWithAuthentication.call.mock.calls.map(
		([, , options]) => options as { method: string; url: string; body?: unknown },
	);

describe('without waiting', () => {
	it('creates the envelope and returns it', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42 },
			responses: [ENVELOPE],
		});

		const output = await run(context);

		expect(output).toEqual([[{ json: ENVELOPE, pairedItem: { item: 0 } }]]);
		expect(context.putExecutionToWait).not.toHaveBeenCalled();
	});

	it('sends no callback_url', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42 },
			responses: [ENVELOPE],
		});

		await run(context);

		const [create] = callsOf(context);
		expect(create.body).not.toHaveProperty('signature_request.callback_url');
		expect((create.body as { signature_request: Record<string, unknown> }).signature_request)
			.not.toHaveProperty('callback_url');
	});

	it('uploads first on sendForSignature, then builds on that id', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'sendForSignature' },
			responses: [{ id: 99 }, ENVELOPE],
		});

		await run(context);

		const [upload, create] = callsOf(context);
		expect(upload).toMatchObject({ method: 'POST', url: '/api/v1/documents' });
		expect(create.body).toMatchObject({ signature_request: { documents: [{ id: 99 }] } });
	});

	it('handles several items in one execution', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42 },
			items: [{ json: {} }, { json: {} }],
			responses: [ENVELOPE, ENVELOPE],
		});

		const output = await run(context);

		expect((output as unknown[][])[0]).toHaveLength(2);
	});

	it('raises a wrapped failure when Continue On Fail is off', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42 },
		});
		context.helpers.httpRequestWithAuthentication.call.mockRejectedValue(new Error('502'));

		await expect(run(context)).rejects.toThrow();
	});

	// Naming the upload matters: the operation advertises a POST to
	// /signature_requests, and a bare failure sends the reader to the wrong call.
	it('says the upload failed rather than blaming the envelope', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'sendForSignature' },
		});
		context.helpers.httpRequestWithAuthentication.call.mockRejectedValue(new Error('413'));

		await expect(run(context)).rejects.toThrow(/Uploading the document failed/);
	});

	it('refuses an upload response with no usable id', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'sendForSignature' },
			responses: [{ id: 'not-a-number' }],
		});

		await expect(run(context)).rejects.toThrow(/answered without a document id/);
	});

	it('collects the failure when Continue On Fail is on', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'sendForSignature' },
			responses: [],
			continueOnFail: true,
		});
		context.helpers.httpRequestWithAuthentication.call.mockRejectedValue(new Error('boom'));

		const output = await run(context);

		expect((output as Array<Array<{ json: { error?: string } }>>)[0][0].json.error).toMatch(/Uploading the document failed/);
	});
});

describe('waiting', () => {
	const waitingContext = (overrides = {}) =>
		executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42, waitForCompletion: true },
			responses: [ENVELOPE],
			...overrides,
		});

	it('passes its own resume url as the callback', async () => {
		const context = waitingContext();

		await run(context);

		const [create] = callsOf(context);
		expect((create.body as { signature_request: { callback_url: string } }).signature_request.callback_url)
			.toBe('https://n8n.example.test/webhook/abc');
	});

	it('suspends the execution and returns the envelope', async () => {
		const context = waitingContext();

		const output = await run(context);

		expect(context.putExecutionToWait).toHaveBeenCalledTimes(1);
		expect(output).toEqual([[{ json: ENVELOPE }]]);
	});

	// An expiring envelope resumes the execution on its own through
	// request.expired, so there is nothing to time out by default.
	it('waits indefinitely unless a limit is asked for', async () => {
		const context = waitingContext();

		await run(context);

		const [deadline] = context.putExecutionToWait.mock.calls[0] as [Date];
		expect(deadline.getUTCFullYear()).toBe(3000);
	});

	it('uses the envelope expiry when a limit is asked for', async () => {
		const context = waitingContext({
			parameters: {
				...BASE,
				operation: 'create',
				documentId: 42,
				waitForCompletion: true,
				limitWaitTime: true,
			},
		});

		await run(context);

		const [deadline] = context.putExecutionToWait.mock.calls[0] as [Date];
		expect(deadline.getTime()).toBe(Date.parse('2026-12-31T00:00:00+01:00') + 86_400_000);
	});

	it('falls back to indefinite when the API returns no expiry', async () => {
		const context = waitingContext({
			parameters: {
				...BASE,
				operation: 'create',
				documentId: 42,
				waitForCompletion: true,
				limitWaitTime: true,
			},
			responses: [{ id: 7, status: 'pending' }],
		});

		await run(context);

		const [deadline] = context.putExecutionToWait.mock.calls[0] as [Date];
		expect(deadline.getUTCFullYear()).toBe(3000);
	});
});

describe('waiting guards', () => {
	it('refuses a batch, an execution suspending only once', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42, waitForCompletion: true },
			items: [{ json: {} }, { json: {} }],
		});

		await expect(run(context)).rejects.toThrow(/handles one item per execution/);
	});

	it('refuses a resume url that is not https', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42, waitForCompletion: true },
			resumeUrl: 'http://localhost:5678/webhook/abc',
		});

		await expect(run(context)).rejects.toThrow(/reachable over HTTPS/);
	});

	it('refuses to wait without a webhook secret to authenticate the callback', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42, waitForCompletion: true },
			credentials: { deployment: 'staging' },
		});

		await expect(run(context)).rejects.toThrow(/No webhook secret configured/);
	});

	it('creates nothing when a guard refuses', async () => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42, waitForCompletion: true },
			resumeUrl: 'http://localhost:5678/webhook/abc',
		});

		await expect(run(context)).rejects.toThrow();
		expect(context.helpers.httpRequestWithAuthentication.call).not.toHaveBeenCalled();
	});
});

describe('deployment', () => {
	it.each([
		['staging', 'https://app.staging-signlift.eu'],
		['production', 'https://app.signlift.eu'],
	])('sends a %s credential to %s', async (deployment, expected) => {
		const context = executeContext({
			parameters: { ...BASE, operation: 'create', documentId: 42 },
			responses: [ENVELOPE],
			credentials: { deployment, webhookSecret: 'whsec_test' },
		});

		await run(context);

		expect(callsOf(context)[0]).toMatchObject({ baseURL: expected });
	});
});
