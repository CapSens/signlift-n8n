import { describe, expect, it, vi } from 'vitest';
import { uploadThenCreate } from '../nodes/Signlift/resources/signatureRequest/sendForSignature';
import { contextWith, signerRow } from './helpers';

function sendContext(upload: () => Promise<unknown>) {
	return contextWith(
		{
			binaryPropertyName: 'data',
			mode: 'sequential',
			validityDays: 30,
			signers: { signer: [signerRow()] },
		},
		{
			assertBinaryData: vi.fn(() => ({ fileName: 'contrat.pdf' })),
			getBinaryDataBuffer: vi.fn(async () => Buffer.from('%PDF-1.4')),
			httpRequestWithAuthentication: { call: vi.fn(async () => await upload()) },
		},
	);
}

const incoming = { url: '/api/v1/signature_requests', baseURL: 'https://app.example', headers: {} };

describe('uploadThenCreate', () => {
	it('builds the envelope on the document it just uploaded', async () => {
		const context = sendContext(async () => ({ id: 1234 }));

		const options = await uploadThenCreate.call(context as never, { ...incoming } as never);

		expect(options.body).toMatchObject({
			signature_request: { documents: [{ id: 1234 }] },
		});
	});

	it('uploads to the documents endpoint on the same deployment', async () => {
		const context = sendContext(async () => ({ id: 1 }));

		await uploadThenCreate.call(context as never, { ...incoming } as never);

		const [, credentialName, uploadOptions] = (
			context.helpers.httpRequestWithAuthentication as { call: ReturnType<typeof vi.fn> }
		).call.mock.calls[0] as [unknown, string, { url: string; baseURL: string }];
		expect(credentialName).toBe('signliftApi');
		expect(uploadOptions).toMatchObject({
			url: '/api/v1/documents',
			baseURL: 'https://app.example',
		});
	});

	// Naming the upload matters: the operation advertises a POST to
	// /signature_requests, and a bare failure sends the reader hunting in the
	// wrong call.
	it('says the upload failed rather than blaming the envelope', async () => {
		const context = sendContext(async () => {
			throw new Error('413 Payload Too Large');
		});

		await expect(
			uploadThenCreate.call(context as never, { ...incoming } as never),
		).rejects.toThrow(/Uploading the document failed, so no signature request was created/);
	});

	it('refuses an upload response with no usable id', async () => {
		const context = sendContext(async () => ({ id: 'not-a-number' }));

		await expect(
			uploadThenCreate.call(context as never, { ...incoming } as never),
		).rejects.toThrow(/answered without a document id/);
	});

	it('refuses an upload response with no id at all', async () => {
		const context = sendContext(async () => ({}));

		await expect(
			uploadThenCreate.call(context as never, { ...incoming } as never),
		).rejects.toThrow(/answered without a document id/);
	});
});
