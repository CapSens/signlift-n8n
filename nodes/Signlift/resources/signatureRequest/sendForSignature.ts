import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
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

	const document = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'signliftApi',
		uploadOptions,
	)) as IDataObject;

	requestOptions.body = {
		signature_request: buildPayload.call(this, document.id as number),
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
