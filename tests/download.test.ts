import { describe, expect, it, vi } from 'vitest';
import { emitSignedDocuments } from '../nodes/Signlift/resources/signatureRequest/download';
import { contextWith } from './helpers';

function downloadContext() {
	const httpRequest = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
	const prepareBinaryData = vi.fn(async (buffer: Buffer, fileName: string, mimeType: string) => ({
		fileName,
		mimeType,
		data: buffer.toString('base64'),
	}));

	return { context: contextWith({}, { httpRequest, prepareBinaryData }), httpRequest };
}

const kinds = (items: Array<{ json: { kind?: string } }>) => items.map((item) => item.json.kind);

describe('emitSignedDocuments', () => {
	it('emits one item per signed document plus the evidence file', async () => {
		const { context, httpRequest } = downloadContext();

		const items = await emitSignedDocuments.call(context as never, [], {
			body: {
				download_urls: [
					{ document_id: 1, signed_url: 'https://s3/1', certificate_url: 'https://s3/cert' },
					{ document_id: 2, signed_url: 'https://s3/2', certificate_url: 'https://s3/cert' },
				],
			},
		} as never);

		expect(kinds(items as never)).toEqual(['signed_document', 'signed_document', 'evidence_file']);
		expect(httpRequest).toHaveBeenCalledTimes(3);
	});

	// The API repeats the same certificate_url on every entry: one evidence
	// file per request, not per document.
	it('downloads the evidence file once however many documents repeat its URL', async () => {
		const { context, httpRequest } = downloadContext();

		await emitSignedDocuments.call(context as never, [], {
			body: {
				download_urls: [
					{ document_id: 1, signed_url: 'https://s3/1', certificate_url: 'https://s3/cert' },
					{ document_id: 2, signed_url: 'https://s3/2', certificate_url: 'https://s3/cert' },
					{ document_id: 3, signed_url: 'https://s3/3', certificate_url: 'https://s3/cert' },
				],
			},
		} as never);

		const certificateCalls = httpRequest.mock.calls.filter(
			([options]) => (options as { url: string }).url === 'https://s3/cert',
		);
		expect(certificateCalls).toHaveLength(1);
	});

	it('names each file after its document', async () => {
		const { context } = downloadContext();

		const items = await emitSignedDocuments.call(context as never, [], {
			body: {
				download_urls: [{ document_id: 7, signed_url: 'https://s3/7', certificate_url: 'https://s3/c' }],
			},
		} as never);

		expect((items[0] as never as { binary: { data: { fileName: string } } }).binary.data.fileName)
			.toBe('document-7.pdf');
	});

	// Reported, never skipped: a workflow counting its output would otherwise
	// be wrong with nothing saying so.
	it('reports a document with no signed URL instead of dropping it', async () => {
		const { context } = downloadContext();

		const items = await emitSignedDocuments.call(context as never, [], {
			body: {
				download_urls: [
					{ document_id: 1, signed_url: 'https://s3/1', certificate_url: 'https://s3/c' },
					{ document_id: 2, signed_url: null, certificate_url: 'https://s3/c' },
				],
			},
		} as never);

		expect(kinds(items as never)).toEqual(['signed_document', 'missing_document', 'evidence_file']);
	});

	it('reports a missing evidence file rather than staying silent', async () => {
		const { context } = downloadContext();

		const items = await emitSignedDocuments.call(context as never, [], {
			body: {
				download_urls: [{ document_id: 1, signed_url: 'https://s3/1', certificate_url: null }],
			},
		} as never);

		expect(kinds(items as never)).toEqual(['signed_document', 'missing_evidence_file']);
	});

	it('explains the sealing delay when nothing is downloadable yet', async () => {
		const { context } = downloadContext();

		await expect(
			emitSignedDocuments.call(context as never, [], {
				body: { download_urls: [], finalized: false },
			} as never),
		).rejects.toThrow(/No documents to download yet/);
	});

	it('distinguishes a finalized request that still exposes nothing', async () => {
		const { context } = downloadContext();

		await expect(
			emitSignedDocuments.call(context as never, [], {
				body: { download_urls: [], finalized: true },
			} as never),
		).rejects.toThrow(/No documents to download yet/);
	});

	it('treats an absent download_urls key as nothing to download', async () => {
		const { context } = downloadContext();

		await expect(
			emitSignedDocuments.call(context as never, [], { body: {} } as never),
		).rejects.toThrow(/No documents to download yet/);
	});

	// A credential sent to a third-party host is never right: the presigned
	// links carry their own signature.
	it('fetches the presigned links without any credential', async () => {
		const { context, httpRequest } = downloadContext();

		await emitSignedDocuments.call(context as never, [], {
			body: {
				download_urls: [{ document_id: 1, signed_url: 'https://s3/1', certificate_url: 'https://s3/c' }],
			},
		} as never);

		for (const [options] of httpRequest.mock.calls) {
			expect(options).not.toHaveProperty('headers');
			expect(options).toMatchObject({ method: 'GET', encoding: 'arraybuffer' });
		}
	});
});
