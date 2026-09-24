import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type INodeProperties,
} from 'n8n-workflow';

const showOnlyForCreate = {
	operation: ['create'],
	resource: ['signatureRequest'],
};

// Everything below `documentId` is shared with sendForSignature, which
// uploads the file itself instead of being handed an id.
const showForBothCreators = {
	operation: ['create', 'sendForSignature'],
	resource: ['signatureRequest'],
};

interface SignerRow {
	firstName: string;
	lastName: string;
	email: string;
	phone?: string;
	otpChannel?: string;
	tag?: string;
}

/**
 * Assembles the nested payload the API expects from the flat form above.
 *
 * Two things are done for the user rather than asked of them. The `ref` that
 * binds a signer to a stamp is generated here: it is not persisted, it only
 * has to be unique within the payload, so asking for it would be asking the
 * user to invent an identifier for nothing. And the signing order follows the
 * order of the rows, which is what a sequential mode means to anyone reading
 * the form.
 */
export async function buildSignatureRequestBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const documentId = this.getNodeParameter('documentId') as number;

	requestOptions.body = { signature_request: buildPayload.call(this, documentId) };

	return requestOptions;
}

export function buildPayload(this: IExecuteSingleFunctions, documentId: number): IDataObject {
	const mode = this.getNodeParameter('mode') as string;
	const signerRows = (this.getNodeParameter('signers') as IDataObject)?.signer as
		| SignerRow[]
		| undefined;
	const options = (this.getNodeParameter('options', {}) as IDataObject) ?? {};

	const signers = (signerRows ?? []).map((row, index) => {
		const signer: IDataObject = {
			ref: `signer-${index}`,
			first_name: row.firstName,
			last_name: row.lastName,
			email: row.email,
		};

		if (mode === 'sequential') signer.order = index + 1;
		if (row.otpChannel) signer.otp_channel = row.otpChannel;
		// The API drops the phone when the channel is email, but sending one
		// with an SMS channel is what makes the text message possible at all.
		if (row.phone) signer.phone = row.phone;

		return signer;
	});

	const documentSigners = (signerRows ?? []).map((row, index) => ({
		signer_ref: `signer-${index}`,
		stamp: {
			type: 'magic_field',
			value: { tag: row.tag },
		},
	}));

	// The branding picker is a resource locator, so it arrives as {mode, value}
	// rather than as the integer the API wants. Validated rather than coerced:
	// Number('abc') is NaN, which JSON.stringify turns into null without
	// complaining, and the envelope would then be created with no branding at
	// all while the user believes they picked one.
	// The API refuses an envelope it is asked to email without this, with a
	// message naming a field the interface never showed. Raised here so the
	// failure names the checkbox the user has to tick.
	if (options.send_email === true && options.identity_declaration_accepted !== true) {
		throw new NodeOperationError(
			this.getNode(),
			'Sending invitation emails requires the identity declaration',
			{
				description:
					'Signlift emails the signers on your behalf, so it asks you to declare having verified their identity. Tick "I Have Verified the Signers\' Identity" under Options, or turn off "Send Invitation Emails" and hand out the signing URLs yourself.',
			},
		);
	}

	const brandingProfile = options.branding_profile_id as IDataObject | string | undefined;
	if (brandingProfile !== undefined) {
		const raw = typeof brandingProfile === 'object' ? brandingProfile.value : brandingProfile;

		if (raw === '' || raw === undefined || raw === null) {
			delete options.branding_profile_id;
		} else if (Number.isInteger(Number(raw))) {
			options.branding_profile_id = Number(raw);
		} else {
			throw new NodeOperationError(
				this.getNode(),
				`Branding Profile is not a valid id: ${String(raw)}`,
				{ description: 'Pick a profile from the list, or pass the integer id the API returns.' },
			);
		}
	}

	return {
		mode,
		validity_days: this.getNodeParameter('validityDays') as number,
		signers,
		documents: [{ id: documentId, signers: documentSigners }],
		...options,
	};
}

export const signatureRequestCreateDescription: INodeProperties[] = [
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show: showOnlyForCreate },
		description: 'The document to sign, as returned by an upload',
	},
	{
		displayName: 'Mode',
		name: 'mode',
		type: 'options',
		options: [
			{
				name: 'Sequential',
				value: 'sequential',
				description: 'Each signer is invited once the previous one has signed',
			},
			{
				name: 'Parallel',
				value: 'parallel',
				description: 'Every signer is invited at the same time',
			},
		],
		default: 'sequential',
		displayOptions: { show: showForBothCreators },
	},
	{
		displayName: 'Validity (Days)',
		name: 'validityDays',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 90 },
		default: 30,
		displayOptions: { show: showForBothCreators },
		description: 'How long the signers have to sign before the request expires',
	},
	{
		displayName: 'Signers',
		name: 'signers',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true, sortable: true },
		placeholder: 'Add Signer',
		default: {},
		required: true,
		displayOptions: { show: showForBothCreators },
		description: 'In sequential mode, signers are invited in the order listed here',
		options: [
			{
				displayName: 'Signer',
				name: 'signer',
				values: [
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						placeholder: 'name@email.com',
						default: '',
						required: true,
					},
					{
						displayName: 'First Name',
						name: 'firstName',
						type: 'string',
						default: '',
						required: true,
					},
					{
						displayName: 'Last Name',
						name: 'lastName',
						type: 'string',
						default: '',
						required: true,
					},
					{
						displayName: 'One-Time Code Channel',
						name: 'otpChannel',
						type: 'options',
						options: [
							{ name: 'Email', value: 'email' },
							{ name: 'SMS', value: 'sms' },
						],
						default: 'email',
						description: 'How the signer receives the code that authenticates the signature',
					},
					{
						displayName: 'Phone',
						name: 'phone',
						type: 'string',
						default: '',
						required: true,
						placeholder: '+33612345678',
						displayOptions: { show: { otpChannel: ['sms'] } },
						description:
							'E.164 format. Required by the SMS channel, and only available on the Pro and Enterprise plans.',
					},
					{
						displayName: 'Signature Tag',
						name: 'tag',
						type: 'string',
						default: '',
						required: true,
						placeholder: '[SIG_JEAN]',
						description:
							'Text that must appear verbatim in the PDF, where this signer signs. Write it in your document template, in white or tiny type if you do not want it visible.',
					},
				],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showForBothCreators },
		options: [
			{
				displayName: 'Branding Profile',
				name: 'branding_profile_id',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				description: 'Colors applied to the signing flow. Pro and Enterprise plans only.',
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: { searchListMethod: 'getBrandingProfiles', searchable: true },
					},
					{
						displayName: 'By ID',
						name: 'id',
						type: 'string',
					},
				],
			},
			{
				displayName: 'I Have Verified the Signers\' Identity',
				name: 'identity_declaration_accepted',
				type: 'boolean',
				default: false,
				description:
					'Whether you declare having verified the identity of every signer. Required by the API when Signlift sends the invitations on your behalf, and refused otherwise. This is a statement you make, so the node never sets it for you.',
			},
			{
				displayName: 'Notify Signers On Completion',
				name: 'notify_signers_on_completion',
				type: 'boolean',
				default: false,
				description:
					'Whether each signer receives the signed PDFs and the evidence file once everyone has signed',
			},
			{
				displayName: 'Require Initials',
				name: 'initials_required',
				type: 'boolean',
				default: false,
				description:
					'Whether to stamp initials on every page where the signer has no signature. Pro and Enterprise plans only.',
			},
			{
				displayName: 'Send Invitation Emails',
				name: 'send_email',
				type: 'boolean',
				default: false,
				description:
					'Whether Signlift emails the signers. Leave off to handle the invitations yourself from the signing URLs the response returns. Turning this on requires the identity declaration below.',
			},
		],
	},
];
