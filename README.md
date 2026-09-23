# n8n-nodes-signlift

An [n8n](https://n8n.io) community node for [Signlift](https://signlift.eu), an
eIDAS electronic signature API.

Send a PDF for signature, follow an envelope through to completion, and collect
the signed document and its evidence file — from an n8n workflow.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Resources](#resources)

## Installation

Follow the
[community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and search for `n8n-nodes-signlift`.

## Credentials

You need an **API key** from a Signlift external application. Create one in your
Signlift dashboard under **External applications**, then copy the key — it is
shown in full only once.

| Field | Notes |
| --- | --- |
| API Key | Production keys start with `sk_live_`, sandbox keys with `sk_sandbox_` |
| Deployment | Leave on **Production** unless Signlift gave you a staging account |

**Sandbox and production are decided by the key, not by the Deployment field.**
A sandbox key only ever sees sandbox data: it cannot read a production envelope,
download a production PDF, or build an envelope from a production document. That
makes a sandbox key safe to hand to a developer or an outside integrator.

Sandbox signatures carry a visible watermark and are not legally binding.

## Operations

### Signature Request

- **Get Many** — list the signature requests of your organization, with filters
  on status and creation date.

More operations are on the way: uploading documents, creating signature
requests, reading an envelope and its audit trail, and triggers.

## Resources

- [Signlift API documentation](https://doc.signlift.eu)
- [Authentication guide](https://doc.signlift.eu/fr/docs/guides/authentication)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Compatibility

Requires n8n 1.x with community nodes enabled.

## License

[MIT](LICENSE)
