import type { IExecuteFunctions, IExecuteSingleFunctions } from 'n8n-workflow';

/**
 * Lets the payload builders, written against the per-item context the
 * declarative router hands them, run inside a custom operation.
 *
 * The two contexts spell the same call differently: `getNodeParameter(name)`
 * on one side, `getNodeParameter(name, itemIndex)` on the other. Only the
 * parameters are bridged — the binary helpers are not, because their argument
 * order differs too and the wait path reads them itself.
 */
export function singleItemContext(
	context: IExecuteFunctions,
	itemIndex: number,
): IExecuteSingleFunctions {
	return {
		getNode: () => context.getNode(),
		getNodeParameter: (name: string, fallback?: unknown) =>
			context.getNodeParameter(name, itemIndex, fallback),
		helpers: context.helpers,
	} as unknown as IExecuteSingleFunctions;
}
