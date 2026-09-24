import { describe, expect, it } from 'vitest';
import { buildPayload, buildSignatureRequestBody } from '../nodes/Signlift/resources/signatureRequest/create';
import { contextWith, signerRow } from './helpers';

function build(parameters: Record<string, unknown>, documentId = 42) {
	const context = contextWith({ mode: 'sequential', validityDays: 30, ...parameters });
	return buildPayload.call(context as never, documentId);
}

describe('buildPayload', () => {
	it('numbers the signers in sequential mode', () => {
		const payload = build({ signers: { signer: [signerRow(), signerRow({ email: 'b@example.test' })] } });

		expect(payload.signers).toMatchObject([{ ref: 'signer-0', order: 1 }, { ref: 'signer-1', order: 2 }]);
	});

	it('omits the order in parallel mode', () => {
		const payload = build({ mode: 'parallel', signers: { signer: [signerRow()] } });

		expect(payload.signers).toEqual([
			{ ref: 'signer-0', first_name: 'Jean', last_name: 'Dupont', email: 'jean@example.test' },
		]);
	});

	it('binds each stamp to its signer by generated ref', () => {
		const payload = build({ signers: { signer: [signerRow({ tag: '[A]' }), signerRow({ tag: '[B]' })] } });

		expect(payload.documents).toEqual([
			{
				id: 42,
				signers: [
					{ signer_ref: 'signer-0', stamp: { type: 'magic_field', value: { tag: '[A]' } } },
					{ signer_ref: 'signer-1', stamp: { type: 'magic_field', value: { tag: '[B]' } } },
				],
			},
		]);
	});

	it('carries the OTP channel and the phone when both are given', () => {
		const payload = build({
			signers: { signer: [signerRow({ otpChannel: 'sms', phone: '+33612345678' })] },
		});

		expect(payload.signers).toMatchObject([{ otp_channel: 'sms', phone: '+33612345678' }]);
	});

	it('tolerates an empty signer collection', () => {
		const payload = build({ signers: {} });

		expect(payload).toMatchObject({ signers: [], documents: [{ id: 42, signers: [] }] });
	});

	it('tolerates an absent signer collection', () => {
		const payload = build({});

		expect(payload.signers).toEqual([]);
	});

	it('tolerates a null options collection', () => {
		const payload = build({ signers: { signer: [signerRow()] }, options: null });

		expect(payload).toMatchObject({ mode: 'sequential', validity_days: 30 });
	});
});

describe('buildPayload / branding profile', () => {
	it('unwraps the resource locator into an integer', () => {
		const payload = build({
			signers: { signer: [signerRow()] },
			options: { branding_profile_id: { mode: 'list', value: '7' } },
		});

		expect(payload.branding_profile_id).toBe(7);
	});

	it('accepts a bare id passed as a string', () => {
		const payload = build({
			signers: { signer: [signerRow()] },
			options: { branding_profile_id: '7' },
		});

		expect(payload.branding_profile_id).toBe(7);
	});

	it.each([
		['an empty locator', { mode: 'list', value: '' }],
		['a null value', { mode: 'list', value: null }],
		['an undefined value', { mode: 'list', value: undefined }],
	])('drops %s rather than sending it', (_label, locator) => {
		const payload = build({
			signers: { signer: [signerRow()] },
			options: { branding_profile_id: locator },
		});

		expect(payload).not.toHaveProperty('branding_profile_id');
	});

	it('refuses a non-numeric id instead of silently dropping the branding', () => {
		expect(() =>
			build({
				signers: { signer: [signerRow()] },
				options: { branding_profile_id: { mode: 'id', value: 'abc' } },
			}),
		).toThrow(/not a valid id: abc/);
	});

	it('passes the identity declaration through when emails are sent', () => {
		const payload = build({
			signers: { signer: [signerRow()] },
			options: { send_email: true, identity_declaration_accepted: true },
		});

		expect(payload).toMatchObject({ send_email: true, identity_declaration_accepted: true });
	});

	// The API refuses this combination with a message naming a field the
	// interface never showed, so the node names the checkbox instead.
	it('refuses to send invitations without the identity declaration', () => {
		expect(() =>
			build({ signers: { signer: [signerRow()] }, options: { send_email: true } }),
		).toThrow(/requires the identity declaration/);
	});

	it('refuses an explicitly declined declaration just the same', () => {
		expect(() =>
			build({
				signers: { signer: [signerRow()] },
				options: { send_email: true, identity_declaration_accepted: false },
			}),
		).toThrow(/requires the identity declaration/);
	});

	it('does not ask for the declaration when no email is sent', () => {
		const payload = build({
			signers: { signer: [signerRow()] },
			options: { send_email: false },
		});

		expect(payload).toMatchObject({ send_email: false });
	});

	it('keeps the other options untouched', () => {
		const payload = build({
			signers: { signer: [signerRow()] },
			options: { notify_signers_on_completion: true, initials_required: false },
		});

		expect(payload).toMatchObject({
			notify_signers_on_completion: true,
			initials_required: false,
		});
	});
});

describe('buildSignatureRequestBody', () => {
	it('nests the payload under signature_request', async () => {
		const context = contextWith({
			documentId: 99,
			mode: 'parallel',
			validityDays: 15,
			signers: { signer: [signerRow()] },
		});

		const options = await buildSignatureRequestBody.call(context as never, { url: '/x' } as never);

		expect(options.body).toMatchObject({
			signature_request: { mode: 'parallel', validity_days: 15, documents: [{ id: 99 }] },
		});
	});
});
