/**
 * The one Signlift the node talks to. Sandbox and production share it: the
 * key carries that switch, not the host.
 *
 * There is deliberately no way to choose another deployment from n8n. The
 * staging one is for Signlift's own team, and a public option would only let
 * a user pick it by mistake. To test against it, change this constant in a
 * local build — never in a published one.
 *
 * The declarative router reads it from `requestDefaults`; everything that
 * builds its own request reads it here.
 */
export const BASE_URL = 'https://app.signlift.eu';
