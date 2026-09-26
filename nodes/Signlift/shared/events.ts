import type { INodePropertyOptions } from 'n8n-workflow';

/**
 * The catalogue Signlift delivers. Hand-written, like every other parameter
 * here: the node has no generated types, so an event added API-side stays
 * invisible until this list gains it.
 */
export const EVENT_OPTIONS: INodePropertyOptions[] = [
	{
		name: 'Request Completed',
		value: 'request.completed',
		description: 'Every signer has signed. The signed PDFs and the evidence file follow.',
	},
	{
		name: 'Request Expired',
		value: 'request.expired',
		description: 'The envelope ran out of time before everyone had signed',
	},
	{
		name: 'Signer Notified',
		value: 'signer.notified',
		description: 'A signer has been invited to sign',
	},
	{
		name: 'Signer One-Time Code Sent',
		value: 'signer.otp_sent',
		description: 'A signer has been sent the code that authenticates their signature',
	},
	{
		name: 'Signer Signed',
		value: 'signer.signed',
		description: 'One signer has signed, and the envelope is not finished',
	},
];

/**
 * The two an envelope ends on. Nothing follows either, which is why they are
 * the default subscription: a workflow that only needs the outcome asks for
 * these and is never woken in between.
 */
export const TERMINAL_EVENTS = ['request.completed', 'request.expired'];
