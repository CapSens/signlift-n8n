import type {
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface DownloadEntry {
	document_id: number;
	signed_url: string | null;
	certificate_url: string | null;
}

/**
 * Emits one item per downloadable file: the sealed PDF of each document, then
 * the evidence file once. The API repeats the same certificate_url on every
 * entry — there is one evidence file per request, not per document — so
 * following it blindly would download the same bytes N times.
 *
 * The presigned links are fetched WITHOUT the API key: they are S3 URLs that
 * carry their own signature, and sending a credential to a third-party host
 * is never right.
 */
export async function emitSignedDocuments(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const entries = (body.download_urls ?? []) as DownloadEntry[];

	if (entries.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'No documents to download yet',
			{
				description:
					body.finalized === false
						? 'The request is not finalized: sealing runs after the last signer signs, and the evidence file is emitted last. Poll until finalized is true.'
						: 'This signature request exposes no download URLs.',
			},
		);
	}

	const results: INodeExecutionData[] = [];

	for (const entry of entries) {
		if (!entry.signed_url) continue;

		results.push(
			await this.helpers
				.httpRequest({ method: 'GET', url: entry.signed_url, encoding: 'arraybuffer' })
				.then(async (file) => ({
					json: { kind: 'signed_document', document_id: entry.document_id },
					binary: {
						data: await this.helpers.prepareBinaryData(
							Buffer.from(file as ArrayBuffer),
							`document-${entry.document_id}.pdf`,
							'application/pdf',
						),
					},
				})),
		);
	}

	const certificateUrl = entries.find((entry) => entry.certificate_url)?.certificate_url;
	if (certificateUrl) {
		const file = (await this.helpers.httpRequest({
			method: 'GET',
			url: certificateUrl,
			encoding: 'arraybuffer',
		})) as ArrayBuffer;

		results.push({
			json: { kind: 'evidence_file' },
			binary: {
				data: await this.helpers.prepareBinaryData(
					Buffer.from(file),
					'evidence-file.pdf',
					'application/pdf',
				),
			},
		});
	}

	return results;
}

export const downloadDescription: INodeProperties[] = [
	{
		displayName: 'Signature Request ID',
		name: 'signatureRequestId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: { operation: ['download'], resource: ['signatureRequest'] } },
	},
];
