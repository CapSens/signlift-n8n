import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type INodeProperties,
} from 'n8n-workflow';
import { buildDocumentUploadBody, binaryPropertyDescription } from '../document/upload';
import { buildPayload } from './create';

/**
 * Uploads the incoming PDF, then builds the envelope on the document it just
 * created. Two calls behind one operation, because the split between a
 * document and an envelope is a Signlift concept rather than the user's.
 *
 * A failed second call leaves the uploaded document unattached. That costs
 * storage and nothing else — the API has no delete, and an orphan document is
 * never signed — but it is why `Upload` stays an operation of its own: a
 * caller looping over many files wants to see, and reuse, each id.
 *
 * For the same reason, do NOT turn on n8n's Retry On Fail for this operation:
 * a retry re-runs the node, hence this hook, hence the upload, and every
 * attempt would leave another orphan behind. Chain Upload and Create when a
 * retry matters — Create is idempotent enough to be replayed on the same id.
 */
export async function uploadThenCreate(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const uploadOptions = await buildDocumentUploadBody.call(this, {
		method: 'POST',
		url: '/api/v1/documents',
		baseURL: requestOptions.baseURL,
		headers: {},
		json: true,
	});

	let document: IDataObject;
	try {
		document = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'signliftApi',
			uploadOptions,
		)) as IDataObject;
	} catch (error) {
		// Without this the failure names /api/v1/documents under an operation
		// the interface says posts to /api/v1/signature_requests, and the
		// reader hunts for a problem in the wrong call.
		throw new NodeOperationError(this.getNode(), error as Error, {
			message: 'Uploading the document failed, so no signature request was created',
		});
	}

	if (typeof document.id !== 'number') {
		throw new NodeOperationError(
			this.getNode(),
			'The upload answered without a document id',
			{ description: 'No signature request was created. This is an API contract change.' },
		);
	}

	requestOptions.body = {
		signature_request: buildPayload.call(this, document.id),
	};

	return requestOptions;
}

export const sendForSignatureDescription: INodeProperties[] = [
	{
		...binaryPropertyDescription,
		displayOptions: {
			show: { operation: ['sendForSignature'], resource: ['signatureRequest'] },
		},
	},
];
