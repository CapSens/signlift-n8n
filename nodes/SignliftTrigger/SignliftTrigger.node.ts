import {
	NodeConnectionTypes,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { triggerDescription } from './descriptions';
import { checkExists, create, remove } from './subscription';
import { receiveEvent } from './receive';

export class SignliftTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Signlift Trigger',
		name: 'signliftTrigger',
		icon: { light: 'file:../../icons/signlift.svg', dark: 'file:../../icons/signlift.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts a workflow when a Signlift signature request moves',
		defaults: {
			name: 'Signlift Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'signliftApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: triggerDescription,
	};

	// A real lifecycle, unlike the action node's: activating the workflow
	// registers its URL with the API, deactivating unregisters it. The row
	// survives the unregistration, which is what lets the same URL come back
	// when the workflow is activated again.
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return await checkExists.call(this);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return await create.call(this);
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return await remove.call(this);
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		return await receiveEvent.call(this);
	}
}
