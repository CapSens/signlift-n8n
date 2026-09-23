import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { signatureRequestDescription } from './resources/signatureRequest';

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
		usableAsTool: true,
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
					{
						name: 'Signature Request',
						value: 'signatureRequest',
					},
				],
				default: 'signatureRequest',
			},
			...signatureRequestDescription,
		],
	};
}
