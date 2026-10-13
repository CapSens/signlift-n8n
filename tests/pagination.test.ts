import { describe, expect, it } from 'vitest';
import {
	Workflow,
	type IDataObject,
	type IN8nRequestOperationPaginationGeneric,
	type INode,
	type INodeProperties,
	type INodeTypes,
	type IWorkflowDataProxyAdditionalKeys,
	type NodeParameterValueType,
} from 'n8n-workflow';
import { Signlift } from '../nodes/Signlift/Signlift.node';

const signlift = new Signlift();

const node: INode = {
	id: 'signlift',
	name: 'Signlift',
	type: 'CUSTOM.signlift',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const nodeTypes: INodeTypes = {
	getByName: () => signlift,
	getByNameAndVersion: () => signlift,
	getKnownTypes: () => ({}),
};

const workflow = new Workflow({ nodes: [node], connections: {}, active: false, nodeTypes });

/** Resolved by n8n's own expression engine, with the keys its paginator passes. */
function evaluate(value: NodeParameterValueType, $request: IDataObject, $response: IDataObject) {
	const additionalKeys = { $request, $response, $version: 1 } as IWorkflowDataProxyAdditionalKeys;

	return workflow.expression.getParameterValue(
		value,
		null,
		0,
		0,
		node.name,
		[],
		'manual',
		additionalKeys,
	);
}

/**
 * A collection endpoint as the API reference describes it: pages numbered from
 * 1, a missing or unreadable page falling back to 1, an out-of-range page
 * capped at the last one, and limit capped at `maxLimit`.
 */
function collection(count: number, maxLimit = 100) {
	return (qs: IDataObject) => {
		const limit = Math.min(Math.max(Number(qs.limit) || 20, 1), maxLimit);
		const pages = Math.ceil(count / limit);
		let page = Number(qs.page);
		if (!(page >= 1)) page = 1;
		if (pages > 0 && page > pages) page = pages;

		const data = Array.from(
			{ length: Math.max(0, Math.min(limit, count - (page - 1) * limit)) },
			(_, i) => ({
				id: (page - 1) * limit + i + 1,
			}),
		);

		return {
			statusCode: 200,
			headers: {},
			body: { data, pagination: { page, limit, count, pages } },
		};
	};
}

/**
 * Return All as n8n's generic paginator runs it: the first request carries the
 * query the node's parameters built, each later one replaces its options with
 * the evaluated `request`, and it stops once `continue` turns false.
 */
function returnAll(answer: (qs: IDataObject) => IDataObject, qs: IDataObject = { limit: 100 }) {
	const pagination = paginationOf('signatureRequest');
	const request: IDataObject = { qs };
	const sent: IDataObject[] = [];
	const ids: number[] = [];
	let response: IDataObject = {};

	do {
		const options = {
			...request,
			...(evaluate(
				pagination.properties.request as NodeParameterValueType,
				request,
				response,
			) as IDataObject),
		};
		sent.push(options.qs as IDataObject);
		response = answer(options.qs as IDataObject);
		ids.push(
			...((response.body as IDataObject).data as Array<{ id: number }>).map((record) => record.id),
		);
	} while (
		evaluate(pagination.properties.continue as string, request, response) === true &&
		sent.length < 20
	);

	return { sent, ids };
}

function paginationOf(resource: string) {
	const returnAllProperty = signlift.description.properties.find(
		(property) =>
			property.name === 'returnAll' &&
			(property.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
	) as INodeProperties;

	return returnAllProperty.routing?.operations?.pagination as IN8nRequestOperationPaginationGeneric;
}

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('Return All', () => {
	// The offset paginator counts items into its parameter, starting at 0: on a
	// `page` parameter that asks for page 0, then 100, then 200.
	it.each(['signatureRequest', 'document', 'auditLog', 'brandingProfile', 'webhookEndpoint'])(
		'walks %s by page number',
		(resource) => {
			expect(paginationOf(resource).type).toBe('generic');
		},
	);

	it('asks for pages 1, 2 and 3 and returns every record', () => {
		const { sent, ids } = returnAll(collection(250));

		expect(sent.map((qs) => qs.page)).toEqual([1, 2, 3]);
		expect(ids).toEqual(range(1, 250));
	});

	// The case that never ended: past the last page the API answers the last
	// page again, full, so counting items could not tell it was done.
	it('stops on a full last page', () => {
		const { sent, ids } = returnAll(collection(200));

		expect(sent.map((qs) => qs.page)).toEqual([1, 2]);
		expect(ids).toEqual(range(1, 200));
	});

	it('makes a single request for a single page', () => {
		const { sent, ids } = returnAll(collection(99));

		expect(sent).toHaveLength(1);
		expect(ids).toEqual(range(1, 99));
	});

	it('makes a single request for an empty collection', () => {
		const { sent, ids } = returnAll(collection(0));

		expect(sent).toHaveLength(1);
		expect(ids).toEqual([]);
	});

	// The generic paginator replaces the query wholesale, so anything not
	// carried over would vanish from the second page on.
	it('keeps the limit and every filter on every page', () => {
		const filters = { limit: 100, status: 'pending', created_after: '2026-01-01', order: 'desc' };
		const { sent } = returnAll(collection(250), filters);

		expect(sent).toEqual([1, 2, 3].map((page) => ({ ...filters, page })));
	});

	// Reading the page count off the response rather than assuming 100 per page
	// keeps it whole if the API ever applies a smaller limit than asked for.
	it('follows the page count the API reports when it applies a smaller limit', () => {
		const { sent, ids } = returnAll(collection(120, 50));

		expect(sent.map((qs) => qs.page)).toEqual([1, 2, 3]);
		expect(ids).toEqual(range(1, 120));
	});
});
