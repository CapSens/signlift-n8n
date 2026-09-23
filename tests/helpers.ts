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
