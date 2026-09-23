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

	// In parallel: the links are independent, and a multi-document envelope
	// would otherwise pay the sum of the latencies rather than the longest.
	// Promise.all preserves order, so the caller sees a stable sequence.
	const results: INodeExecutionData[] = await Promise.all(
		entries
			.filter((entry) => entry.signed_url)
			.map(async (entry) => ({
				json: { kind: 'signed_document', document_id: entry.document_id },
				binary: {
					data: await this.helpers
						.httpRequest({
							method: 'GET',
							url: entry.signed_url as string,
							encoding: 'arraybuffer',
						})
						.then((file) =>
							this.helpers.prepareBinaryData(
								Buffer.from(file as ArrayBuffer),
								`document-${entry.document_id}.pdf`,
								'application/pdf',
							),
						),
				},
			})),
	);

	// Reported rather than skipped. A silent `continue` would let a download
	// "succeed" with two documents out of three, and a workflow counting its
	// output would be wrong without anything saying so.
	const missing = entries.filter((entry) => !entry.signed_url);
	for (const entry of missing) {
		results.push({
			json: {
				kind: 'missing_document',
				document_id: entry.document_id,
				reason: 'The API exposed no signed_url for this document',
			},
		});
	}

	const certificateUrl = entries.find((entry) => entry.certificate_url)?.certificate_url;
	if (!certificateUrl) {
		results.push({
			json: {
				kind: 'missing_evidence_file',
				reason: 'The API exposed no certificate_url on any entry',
			},
		});
	}

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
