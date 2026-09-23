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

- **Create** — send a document out for signature.
- **Get** — read an envelope. Download links for the signed PDFs and the
  evidence file appear once `finalized` is true.
- **Get Many** — list your signature requests, with filters on status and
  creation date.

### Document

- **Get** — read a document and get a link to download the original PDF.
- **Get Many** — list your documents.

### Audit Log

- **Get Many** — read the audit trail of a signature request. It is what the
  evidence file prints, in a machine-readable form.

### Branding Profile

- **Get Many** — list the branding profiles you can apply to a signing flow.

Uploading a document and the triggers are on the way.

## Signature tags

A signer signs where their **signature tag** appears in the PDF. Put a marker
such as `[SIG_JEAN]` in your document template at the place each signer should
sign, then give the node the same text. Write it in white or in a tiny font if
you do not want it visible in the finished document.

This beats positioning a signature by page and coordinates, which breaks the
moment the document reflows.

## Resources

- [Signlift API documentation](https://doc.signlift.eu)
- [Authentication guide](https://doc.signlift.eu/fr/docs/guides/authentication)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Compatibility

Requires n8n 1.x with community nodes enabled.

## License

[MIT](LICENSE)
