import {
	NodeConnectionTypes,
	type IExecuteFunctions,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
	type NodeOutput,
} from 'n8n-workflow';
import { signatureRequestDescription } from './resources/signatureRequest';
import { documentDescription } from './resources/document';
import { auditLogDescription } from './resources/auditLog';
import { brandingProfileDescription } from './resources/brandingProfile';
import { getBrandingProfiles } from './listSearch/getBrandingProfiles';
import { waitDescription } from './wait/descriptions';
import { signatureRequestWithWait } from './wait/waitForCompletion';
import { resumeOnCallback } from './wait/resume';

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
		// An agent only reaches this node if someone attaches it to one, and
		// the binary operations stay out of its reach either way — tools carry
		// no binary. What an agent can really call is Create and the reads.
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		// The address Signlift calls back on when waiting. It is this node's own
		// resume url, so no trigger has to be wired to the workflow — possible
		// only because the API takes a callback per request.
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				// Empty, as n8n's own Wait node leaves it. The path is a suffix of
				// the resume url, and `$execution.resumeUrl` carries none: anything
				// here registers the webhook where the callback never knocks, and
				// the 404 surfaces nowhere.
				path: '',
				restartWebhook: true,
			},
		],
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
			...waitDescription,
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

	// Declaring `webhooks` above is what requires these, and the scanner
	// checks they exist. They are honest no-ops rather than a workaround: the
	// address Signlift calls back on is this execution's own resume url, which
	// belongs to n8n and is registered nowhere.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	// Only these two operations leave the declarative router: every other one
	// keeps its `routing` block untouched, pagination included. A custom
	// operation runs whether the option is on or off, so it carries the
	// unwaiting path as well.
	customOperations = {
		signatureRequest: {
			create: async function (this: IExecuteFunctions): Promise<NodeOutput> {
				return await signatureRequestWithWait.call(this);
			},
			sendForSignature: async function (this: IExecuteFunctions): Promise<NodeOutput> {
				return await signatureRequestWithWait.call(this);
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return await resumeOnCallback.call(this);
	}
}
