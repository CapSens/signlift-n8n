import type {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Always application/pdf, never the incoming mime type. A generic upstream
 * node — an HTTP download, an S3 read — often reports
 * application/octet-stream, and forwarding that gets a valid PDF rejected.
 * The API accepts nothing else anyway, so there is nothing to negotiate.
 *
 * Kept separate from the hook below because the two execution contexts spell
 * the binary helpers differently — `assertBinaryData(name)` against
 * `assertBinaryData(itemIndex, name)` — while the body they build is the same.
 */
export function documentUploadFormData(buffer: Buffer, fileName?: string): FormData {
	const formData = new FormData();
	formData.append(
		'file',
		new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }),
		fileName || 'document.pdf',
	);

	return formData;
}

/**
 * Turns the incoming binary property into the multipart body the API expects.
 *
 * The Content-Type header is deleted rather than overwritten: requestDefaults
 * sets application/json for every other operation, and leaving it here would
 * stop the runtime from writing the multipart boundary, which the API then
 * rejects on a motive that says nothing about the real cause.
 */
export async function buildDocumentUploadBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const binaryProperty = this.getNodeParameter('binaryPropertyName') as string;
	const binary = this.helpers.assertBinaryData(binaryProperty);
	const buffer = await this.helpers.getBinaryDataBuffer(binaryProperty);

	requestOptions.body = documentUploadFormData(buffer, binary.fileName);
	delete (requestOptions.headers ?? {})['Content-Type'];

	return requestOptions;
}

export const binaryPropertyDescription: INodeProperties = {
	displayName: 'Input Binary Field',
	name: 'binaryPropertyName',
	type: 'string',
	default: 'data',
	required: true,
	description: 'Name of the field in the input holding the PDF to upload',
};
