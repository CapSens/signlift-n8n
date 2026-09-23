import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SignliftApi implements ICredentialType {
	name = 'signliftApi';

	displayName = 'Signlift API';

	icon: Icon = { light: 'file:../icons/signlift.svg', dark: 'file:../icons/signlift.dark.svg' };

	documentationUrl = 'https://doc.signlift.eu/fr/docs/guides/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'API key of an external application. Production keys start with sk_live_, sandbox keys with sk_sandbox_. The key alone decides whether you work against sandbox or production data.',
		},
		{
			displayName: 'Deployment',
			name: 'deployment',
			type: 'options',
			options: [
				{ name: 'Production', value: 'production' },
				{ name: 'Staging', value: 'staging' },
			],
			default: 'production',
			description:
				'Which Signlift deployment to call. Leave on Production unless Signlift gave you a staging account: this is not the sandbox switch, which is carried by the key itself.',
		},
		{
			displayName: 'Webhook Secret',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Only needed by the Signlift Trigger, which uses it to verify that an incoming event really came from Signlift. Find it next to your API key in the dashboard, under External applications. Leave empty if you only use the action node.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Api-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// The health check answers 200 for any valid key, including a production key
	// whose organization has lost paid access. It keeps a credential test from
	// going red over a billing state rather than over a wrong key.
	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials.deployment === "staging" ? "https://app.staging-signlift.eu" : "https://app.signlift.eu"}}',
			url: '/api/v1/health',
			method: 'GET',
		},
	};
}
