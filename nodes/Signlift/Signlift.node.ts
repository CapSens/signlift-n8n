import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { signatureRequestDescription } from './resources/signatureRequest';
import { documentDescription } from './resources/document';
import { auditLogDescription } from './resources/auditLog';
import { brandingProfileDescription } from './resources/brandingProfile';
import { getBrandingProfiles } from './listSearch/getBrandingProfiles';

// The rule below says "when in doubt, set it to true". This is not doubt: the
// node carries binary operations, which tools cannot pass, and letting an
// agent send a legally binding signature request is a decision to take
// deliberately. Omitting the property is the only way the type expresses
// "not a tool" — it accepts `true | UsableAsToolDescription | undefined`,
// never `false`.
// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool
export class Signlift implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Signlift',
		name: 'signlift',
		icon: { light: 'file:../../icons/signlift.svg', dark: 'file:../../icons/signlift.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send documents for electronic signature with Signlift',
		defaults: {
			name: 'Signlift',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'signliftApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL:
				'={{$credentials.deployment === "staging" ? "https://app.staging-signlift.eu" : "https://app.signlift.eu"}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Signature Request', value: 'signatureRequest' },
					{ name: 'Document', value: 'document' },
					{ name: 'Audit Log', value: 'auditLog' },
					{ name: 'Branding Profile', value: 'brandingProfile' },
				],
				default: 'signatureRequest',
			},
			...signatureRequestDescription,
			...documentDescription,
			...auditLogDescription,
			...brandingProfileDescription,
		],
	};

	methods = {
		listSearch: {
			getBrandingProfiles,
		},
	};
}
