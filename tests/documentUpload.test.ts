import { describe, expect, it, vi } from 'vitest';
import { buildDocumentUploadBody } from '../nodes/Signlift/resources/document/upload';
import { contextWith } from './helpers';

function uploadContext(binary: Record<string, unknown>, buffer = Buffer.from('%PDF-1.4')) {
	return contextWith(
		{ binaryPropertyName: 'data' },
		{
			assertBinaryData: vi.fn(() => binary),
			getBinaryDataBuffer: vi.fn(async () => buffer),
		},
	);
}

describe('buildDocumentUploadBody', () => {
	it('sends the file as multipart under the name the API expects', async () => {
		const context = uploadContext({ fileName: 'contrat.pdf' });

		const options = await buildDocumentUploadBody.call(context as never, {
			url: '/api/v1/documents',
			headers: { 'Content-Type': 'application/json' },
		} as never);

		const form = options.body as FormData;
		const file = form.get('file') as File;
		expect(file.name).toBe('contrat.pdf');
	});

	it('always declares application/pdf, whatever the upstream node reported', async () => {
		const context = uploadContext({ fileName: 'x.pdf', mimeType: 'application/octet-stream' });

		const options = await buildDocumentUploadBody.call(context as never, { url: '/x' } as never);

		expect((options.body as FormData).get('file')).toMatchObject({ type: 'application/pdf' });
	});

	it('falls back to a default name when the binary carries none', async () => {
		const context = uploadContext({});

		const options = await buildDocumentUploadBody.call(context as never, { url: '/x' } as never);

		expect((options.body as FormData).get('file')).toMatchObject({ name: 'document.pdf' });
	});

	// Left in place, the JSON content type from requestDefaults stops the
	// runtime writing a multipart boundary and the API rejects the upload.
	it('removes the JSON content type so the boundary can be written', async () => {
		const context = uploadContext({ fileName: 'x.pdf' });

		const options = await buildDocumentUploadBody.call(context as never, {
			url: '/x',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		} as never);

		expect(options.headers).toEqual({ Accept: 'application/json' });
	});

	it('copes with a request that carries no headers at all', async () => {
		const context = uploadContext({ fileName: 'x.pdf' });

		await expect(
			buildDocumentUploadBody.call(context as never, { url: '/x' } as never),
		).resolves.toMatchObject({ url: '/x' });
	});

	it('preserves the bytes it was given', async () => {
		const context = uploadContext({ fileName: 'x.pdf' }, Buffer.from('%PDF-1.7 hello'));

		const options = await buildDocumentUploadBody.call(context as never, { url: '/x' } as never);

		const text = await (options.body as FormData).get('file')!.text();
		expect(text).toBe('%PDF-1.7 hello');
	});
});
