import { describe, expect, it } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';
import { SignliftTrigger } from '../nodes/SignliftTrigger/SignliftTrigger.node';

const node = new SignliftTrigger();
const description = node.description;

const property = (name: string) =>
	description.properties.find((candidate) => candidate.name === name) as INodeProperties;

describe('trigger description', () => {
	it('is a trigger with no input', () => {
		expect(description.group).toEqual(['trigger']);
		expect(description.inputs).toEqual([]);
	});

	it('takes the same credential as the action node', () => {
		expect(description.credentials).toEqual([{ name: 'signliftApi', required: true }]);
	});

	// A path is what tells this webhook from the action node's resume url,
	// which deliberately has none.
	it('declares a webhook on a path of its own', () => {
		expect(description.webhooks).toEqual([
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
		]);
	});

	it('defaults to the two events an envelope ends on', () => {
		expect(property('events').default).toEqual(['request.completed', 'request.expired']);
	});

	it('offers every event Signlift emits', () => {
		const options = property('events').options as Array<{ value: string }>;

		expect(options.map((option) => option.value).sort()).toEqual([
			'request.completed',
			'request.expired',
			'signer.notified',
			'signer.otp_sent',
			'signer.signed',
		]);
	});

	it('subscribes to everything unless told otherwise', () => {
		expect(property('subscribeTo').default).toBe('all');
	});
});

describe('trigger lifecycle', () => {
	// The action node's three are honest no-ops on a url n8n owns. These are
	// the real thing, and the scanner's webhook-lifecycle-complete rule reads
	// this object literally, which is why they are declared here rather than
	// assigned from the imports.
	it.each(['checkExists', 'create', 'delete'] as const)('implements %s', (method) => {
		expect(typeof node.webhookMethods.default[method]).toBe('function');
	});

	// Routed mode is the one path through all three that touches no network,
	// which is what makes it the way to prove the class really delegates.
	it.each(['checkExists', 'create', 'delete'] as const)('routes %s to the real implementation', async (method) => {
		const context = {
			getNodeParameter: (name: string, fallback?: unknown) =>
				name === 'subscribeTo' ? 'routed' : fallback,
			getWorkflowStaticData: () => ({}),
		};

		await expect(node.webhookMethods.default[method].call(context as never)).resolves.toBe(true);
	});
});
