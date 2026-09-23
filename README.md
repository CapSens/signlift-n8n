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

| Field          | Notes                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| API Key        | Production keys start with `sk_live_`, sandbox keys with `sk_sandbox_`    |
| Deployment     | Leave on **Production** unless Signlift gave you a staging account        |
| Webhook Secret | Only needed by the trigger. Leave empty if you use the action node alone. |

**Sandbox and production are decided by the key, not by the Deployment field.**
A sandbox key only ever sees sandbox data: it cannot read a production envelope,
download a production PDF, or build an envelope from a production document. That
makes a sandbox key safe to hand to a developer or an outside integrator.

Sandbox signatures carry a visible watermark and are not legally binding.

## Operations

### Signature Request

- **Send for Signature** — upload a PDF and send it out for signature in one
  step. The usual starting point.
- **Create** — build an envelope on a document you already uploaded. Use this
  when one document goes into several envelopes.
- **Download** — fetch the sealed PDFs and the evidence file of a completed
  request as binary data, ready to store or attach.
- **Get** — read an envelope. Download links for the signed PDFs and the
  evidence file appear once `finalized` is true.
- **Get Many** — list your signature requests, with filters on status and
  creation date.

### Document

- **Upload** — upload a PDF from a binary field so it can be signed.
- **Get** — read a document and get a link to download the original PDF.
- **Get Many** — list your documents.

### Audit Log

- **Get Many** — read the audit trail of a signature request. It is what the
  evidence file prints, in a machine-readable form.

### Branding Profile

- **Get Many** — list the branding profiles you can apply to a signing flow.

## Trigger

**Signlift Trigger** starts a workflow when Signlift reports a signing event:
request completed, request expired, signer notified, signer signed, or a
one-time code sent.

### Setting it up

1. Add the node to a workflow and copy the webhook URL it shows.
2. Paste it into your Signlift external application, under **Webhook URL**.
3. Copy the **webhook secret** shown next to your API key into the Signlift
   credential in n8n.

Signlift sends every event to that one URL; the node filters on the events you
select and acknowledges the rest.

The secret is not optional. Without it the node cannot tell a Signlift event
from anything else that finds the URL, and it refuses to run.

### What it handles for you

- **Signature check** on the raw request body, in constant time. A request
  that does not verify gets a `401` and never starts the workflow.
- **Replays.** Signlift retries a delivery up to five times over thirteen
  hours whenever it does not get an acknowledgement within five seconds. The
  node remembers recent delivery ids, so a lost acknowledgement does not run
  your workflow twice.

### Why there is no polling trigger

Signlift's list endpoint filters and sorts on creation, and exposes no
completion timestamp, so a polling trigger could notice new requests but not
the event you actually care about — a request being signed. Webhooks carry
that reliably, with retries.

If you have a reason to poll anyway, compose a **Schedule Trigger** with the
**Get Many** action and its filters: nothing here prevents it.

## Signature tags

A signer signs where their **signature tag** appears in the PDF. Put a marker
such as `[SIG_JEAN]` in your document template at the place each signer should
sign, then give the node the same text. Write it in white or in a tiny font if
you do not want it visible in the finished document.

This beats positioning a signature by page and coordinates, which breaks the
moment the document reflows.

## Downloading the result

A signature request exposes its files once `finalized` is true, which is not
the same as `completed`. Completion says the last signer signed; sealing runs
afterwards and emits the evidence file last. **Download** fails with a clear
message while the request is still sealing, so poll on `finalized` rather than
on `status`.

The evidence file is emitted once per request, not per document: **Download**
returns one item per signed PDF plus one for the evidence file, each tagged in
`json.kind`.

## A note on AI agents

The node can be attached to an AI agent. It only reaches one if you attach it
yourself, and the binary operations — **Upload**, **Download**, **Send for
Signature** — stay out of an agent's reach either way, since tools carry no
binary data.

What an agent can really call is **Create** and the read operations. Creating
an envelope sends a legally binding signature request, so attach this node to
an agent deliberately.

## Resources

- [Signlift API documentation](https://doc.signlift.eu)
- [Authentication guide](https://doc.signlift.eu/fr/docs/guides/authentication)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Rate limits

Calls are counted **per organization**, over a per-minute and a per-hour
window, with independent budgets for sandbox and production. Every
authenticated response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`
and `X-RateLimit-Reset`.

A workflow that loops over many items can outrun the budget. Two things help:

- Turn on **Retry On Fail** in the node's Settings tab. n8n waits a fixed
  interval and tries again, which is enough to ride out a short burst.
  **Not on Send for Signature**: a retry re-runs the whole operation, upload
  included, and each attempt leaves another unattached document behind. Chain
  **Upload** and **Create** when a retry matters.
- Reach for **Get Many** with `Return All` rather than calling **Get** in a
  loop. One paginated walk costs far fewer calls than one request per record.

A refused call answers `429` with `Retry-After`. n8n surfaces it as _"The
service is receiving too many requests from you"_.

## Compatibility

Requires n8n 1.x with community nodes enabled.

## License

[MIT](LICENSE)
