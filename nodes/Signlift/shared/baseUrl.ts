import type { IDataObject } from 'n8n-workflow';

/**
 * The deployment switch lives on the credential, and this is the only thing
 * that tells staging from production. The declarative router reads it from
 * `requestDefaults`; everything that builds its own request reads it here.
 */
export function baseUrlFor(credentials: IDataObject): string {
	return credentials.deployment === 'staging'
		? 'https://app.staging-signlift.eu'
		: 'https://app.signlift.eu';
}
