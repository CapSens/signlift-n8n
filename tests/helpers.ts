import { vi } from 'vitest';

/** The slice of an n8n execution context these units actually touch. */
export function contextWith(parameters: Record<string, unknown>, helpers: Record<string, unknown> = {}) {
	return {
		getNode: () => ({ name: 'Signlift', type: 'CUSTOM.signlift', typeVersion: 1 }),
		getNodeParameter: vi.fn((name: string, fallback?: unknown) =>
			name in parameters ? parameters[name] : fallback,
		),
		helpers,
	};
}

export function signerRow(overrides: Record<string, unknown> = {}) {
	return {
		firstName: 'Jean',
		lastName: 'Dupont',
		email: 'jean@example.test',
		tag: '[SIG_JEAN]',
		...overrides,
	};
}

/** The slice of IExecuteFunctions the wait path touches. */
export function executeContext({
	parameters = {} as Record<string, unknown>,
	items = [{ json: {} }] as unknown[],
	responses = [] as unknown[],
	credentials = { deployment: 'staging', webhookSecret: 'whsec_test' } as Record<string, unknown>,
	resumeUrl = 'https://n8n.example.test/webhook/abc',
	continueOnFail = false,
} = {}) {
	const queue = [...responses];
	const httpRequestWithAuthentication = {
		call: vi.fn(async () => queue.shift() ?? {}),
	};
	const putExecutionToWait = vi.fn(async () => undefined);

	return {
		getNode: () => ({ name: 'Signlift' }),
		getInputData: () => items,
		getNodeParameter: vi.fn((name: string, _index?: number, fallback?: unknown) =>
			name in parameters ? parameters[name] : fallback,
		),
		evaluateExpression: vi.fn(() => resumeUrl),
		getCredentials: vi.fn(async () => credentials),
		getWorkflowStaticData: vi.fn(() => ({})),
		continueOnFail: () => continueOnFail,
		putExecutionToWait,
		helpers: {
			httpRequestWithAuthentication,
			assertBinaryData: vi.fn(() => ({ fileName: 'contrat.pdf' })),
			getBinaryDataBuffer: vi.fn(async () => Buffer.from('%PDF-1.4')),
		},
	};
}
