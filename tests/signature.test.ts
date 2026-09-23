import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isSignatureValid } from '../nodes/Signlift/wait/signature';

const SECRET = 'whsec_test';
const BODY = Buffer.from('{"event":"request.completed"}');
const VALID = `sha256=${createHmac('sha256', SECRET).update(BODY).digest('hex')}`;

describe('isSignatureValid', () => {
	it('accepts the signature Signlift computes', () => {
		expect(isSignatureValid(BODY, VALID, SECRET)).toBe(true);
	});

	it('rejects a signature computed with another secret', () => {
		expect(isSignatureValid(BODY, VALID, 'whsec_other')).toBe(false);
	});

	it('rejects a signature over different bytes', () => {
		expect(isSignatureValid(Buffer.from('{}'), VALID, SECRET)).toBe(false);
	});

	it('rejects an absent signature', () => {
		expect(isSignatureValid(BODY, undefined, SECRET)).toBe(false);
	});

	it('rejects a signature with no sha256 prefix', () => {
		expect(isSignatureValid(BODY, VALID.slice('sha256='.length), SECRET)).toBe(false);
	});

	// Buffer.from(str, 'hex') stops at the first bad pair instead of throwing,
	// so a same-length malformed signature decodes short and makes
	// timingSafeEqual throw — reachable without knowing the secret.
	it('rejects malformed hex of the right length without crashing', () => {
		expect(isSignatureValid(BODY, `sha256=${'z'.repeat(64)}`, SECRET)).toBe(false);
	});

	it('rejects hex of the wrong length', () => {
		expect(isSignatureValid(BODY, 'sha256=abcd', SECRET)).toBe(false);
	});

	it('accepts uppercase hex', () => {
		expect(isSignatureValid(BODY, VALID.toUpperCase().replace('SHA256=', 'sha256='), SECRET)).toBe(true);
	});
});
