import { createHmac, timingSafeEqual } from 'node:crypto';

const HEX_SHA256 = /^[0-9a-f]{64}$/i;

/**
 * Checked before decoding, and on the shape rather than the length alone:
 * `Buffer.from(str, 'hex')` stops at the first non-hex pair instead of
 * throwing, so a same-length but malformed signature would decode to a
 * shorter buffer and make `timingSafeEqual` throw. Anyone could reach that
 * without knowing the secret.
 */
export function isSignatureValid(
	rawBody: Buffer,
	signature: string | undefined,
	secret: string,
): boolean {
	if (!signature?.startsWith('sha256=')) return false;

	const received = signature.slice('sha256='.length);
	if (!HEX_SHA256.test(received)) return false;

	const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

	return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}
