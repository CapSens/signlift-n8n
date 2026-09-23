import { describe, expect, it } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';
import { Signlift } from '../nodes/Signlift/Signlift.node';

const description = new Signlift().description;

function operationsOf(resource: string) {
	const property = description.properties.find(
		(candidate) =>
			candidate.name === 'operation' &&
			(candidate.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
	) as INodeProperties;

	return property.options as Array<{
		value: string;
		routing?: { request?: { method?: string; url?: string } };
	}>;
}

function route(resource: string, operation: string) {
	const found = operationsOf(resource).find((candidate) => candidate.value === operation);

	return `${found?.routing?.request?.method} ${found?.routing?.request?.url}`;
}

/**
 * The call each operation makes, asserted from the declaration itself.
 *
 * This is the regression guard for turning the node programmatic: a node that
 * defines `execute` never runs the declarative router, so these routes stop
 * being enforced by anything the day they move into code. The table must keep
 * passing against whatever builds the requests.
 */
const ROUTES: Array<[string, string, string]> = [
	['signatureRequest', 'sendForSignature', 'POST /api/v1/signature_requests'],
	['signatureRequest', 'create', 'POST /api/v1/signature_requests'],
	['signatureRequest', 'get', 'GET =/api/v1/signature_requests/{{$parameter.signatureRequestId}}'],
	['signatureRequest', 'download', 'GET =/api/v1/signature_requests/{{$parameter.signatureRequestId}}'],
	['signatureRequest', 'getAll', 'GET /api/v1/signature_requests'],
	['document', 'upload', 'POST /api/v1/documents'],
	['document', 'get', 'GET =/api/v1/documents/{{$parameter.documentId}}'],
	['document', 'getAll', 'GET /api/v1/documents'],
	['auditLog', 'getAll', 'GET =/api/v1/signature_requests/{{$parameter.signatureRequestId}}/audit_logs'],
	['brandingProfile', 'getAll', 'GET /api/v1/branding_profiles'],
];

describe('operation routes', () => {
	it.each(ROUTES)('%s.%s calls %s', (resource, operation, expected) => {
		expect(route(resource, operation)).toBe(expected);
	});

	it('declares every advertised resource', () => {
		const resources = description.properties.find((p) => p.name === 'resource') as INodeProperties;

		expect((resources.options as Array<{ value: string }>).map((o) => o.value)).toEqual([
			'signatureRequest',
			'document',
			'auditLog',
			'brandingProfile',
		]);
	});

	it('covers every declared operation in the table above', () => {
		const declared = ['signatureRequest', 'document', 'auditLog', 'brandingProfile'].flatMap(
			(resource) => operationsOf(resource).map((o) => `${resource}.${o.value}`),
		);

		expect(declared.sort()).toEqual(ROUTES.map(([r, o]) => `${r}.${o}`).sort());
	});
});

describe('node description', () => {
	// The deployment switch lives on the credential, and the base url is the
	// only thing that tells staging from production.
	it('resolves the base url from the credential deployment', () => {
		expect(description.requestDefaults?.baseURL).toContain('app.staging-signlift.eu');
		expect(description.requestDefaults?.baseURL).toContain('app.signlift.eu');
	});

	it('requires the Signlift credential', () => {
		expect(description.credentials).toEqual([{ name: 'signliftApi', required: true }]);
	});

	// n8n verification requires the node to be reachable as a tool.
	it('stays usable as a tool', () => {
		expect(description.usableAsTool).toBe(true);
	});
});
