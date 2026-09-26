# n8n-nodes-signlift

An [n8n](https://n8n.io) community node for [Signlift](https://signlift.eu), an
eIDAS electronic signature API.

Send a PDF for signature, follow an envelope through to completion, and collect
the signed document and its evidence file — from an n8n workflow.

The package holds two nodes: **Signlift**, which acts, and **Signlift Trigger**,
which starts a workflow when an envelope moves.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Starting a workflow on an event](#starting-a-workflow-on-an-event) · [Resources](#resources)

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
| Webhook Secret | Authenticates incoming events. Needed by the **Signlift Trigger** and by **Wait for Completion**, and by nothing else. |

### Sending the invitations

**Send Invitation Emails** makes Signlift email the signers. Because Signlift
then writes to them on your behalf, the API requires you to declare having
verified who they are: tick **I Have Verified the Signers' Identity** in the
same Options collection. The node never sets it for you — it is a statement you
make, not a flag.

Left off, no email goes out and you hand out the `signing_url` of each signer
from the node's output yourself.

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
  when one document goes into several envelopes, or when you want **Retry On
  Fail**: a retry re-runs the whole node, and Send for Signature would upload
  the file again on every attempt.
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

### Webhook Endpoint

- **Create** — register a URL to receive events, for every envelope or for one.
  Registering a URL that is already known switches it back on rather than
  refusing it as a duplicate.
- **Delete** — stop sending events to an endpoint. The registration is kept, so
  the same URL can come back later.
- **Get** / **Get Many** — read what this API key has registered. An endpoint
  registered under another key is never listed, whatever the organization.
- **Update** — change the event filter, or switch an endpoint on and off. The
  URL is immutable: an integration matches its endpoint by URL, and moving one
  would strand it.

The Signlift Trigger does all of this for itself. Reach for this resource when
a workflow manages someone else's subscriptions.

## Waiting for the signature

Turn on **Wait for Completion** on *Send for Signature* or *Create*. The node
passes this execution's own resume URL to Signlift as the callback for that
envelope, pauses the execution, and resumes it when the envelope reaches a
terminal state — with the callback body as its output.

No trigger, no webhook URL on your Signlift application, nothing to paste
anywhere. Each execution carries its own address, so any number of workflows
can wait at the same time.

### What it needs

| | |
| --- | --- |
| This n8n reachable over **HTTPS** | Signlift only calls back on `https://`, so a bare `localhost` is refused with a clear error. Set `WEBHOOK_URL` to a public address. |
| The **webhook secret** on the credential | The callback is authenticated with it. Without it the node refuses to wait rather than trusting whatever posts to the URL. |
| **One item per execution** | An execution suspends once, so a batch is refused. Put the node behind a **Loop Over Items** to send several envelopes. |

### How long it waits

Indefinitely, by default. An envelope that runs out of time is not a hang:
Signlift emits `request.expired`, which is terminal, so the execution resumes
with the envelope and `status: "expired"`.

**Limit Wait Time** only covers a callback that never arrives at all — this n8n
unreachable for longer than Signlift retries, some thirteen hours. Be aware
that on such a timeout n8n forwards the node's input rather than the envelope.

### Intermediate events

`signer.notified`, `signer.otp_sent` and `signer.signed` never reach a
callback. A waiting execution wakes on the first delivery it gets and cannot go
back to sleep, so waking it on a partial signature would be wrong. If you need
those events, use the [Signlift Trigger](#starting-a-workflow-on-an-event).

## Starting a workflow on an event

Add a **Signlift Trigger**. Activating the workflow registers its URL with
Signlift, deactivating unregisters it, and an event starts a run.

Nothing to paste anywhere, and nothing to clean up: the node holds the whole
lifecycle. It needs this n8n reachable over **HTTPS** and the webhook secret on
the credential — every event is verified against it before a run starts, and a
body whose signature does not match is answered `401` without starting one.

### What it hears

| | |
| --- | --- |
| `signer.notified` | A signer has been invited |
| `signer.otp_sent` | A signer has been sent their one-time code |
| `signer.signed` | One signer has signed, and the envelope is not finished |
| `request.completed` | Every signer has signed |
| `request.expired` | The envelope ran out of time |

The first three are the ones **Wait for Completion** can never deliver: an
execution wakes once and cannot go back to sleep, so waking it on a partial
signature would be wrong. A trigger has no such problem.

### Dropping a repeat

Delivery is at-least-once: a retry after a timeout that in fact succeeded
posts the same body again. The trigger's output carries `delivery_id`, stable
across those retries and the only thing telling two deliveries of one event
apart. Compare it against what you have already handled if a second run would
do damage.

### Subscribe To

**All Signature Requests** registers this workflow against everything the API
key creates. **Only Requests Pointed at This URL** registers nothing: the
workflow sits waiting to be named, by the option below or by your own backend.

An API key holds **three** subscriptions to everything at once, and an
organization migrated from the old single-webhook field already spends one on
it. One workflow subscribed to several events, with a **Switch** after it,
costs a single slot and is the way to spend them well. Past the limit the node
says so and names the URLs holding the slots.

Envelope-bound subscriptions are counted per envelope instead — five each,
with no ceiling on how many envelopes.

### One workflow per envelope

Turn on **Subscribe a URL to This Envelope** on *Send for Signature* or
*Create*, and give it the production URL of a trigger set to *Only Requests
Pointed at This URL*. That trigger then hears about this envelope alone.

Signlift unregisters the subscription itself once the envelope is settled, so a
workflow driving hundreds of signatures leaves nothing behind.

Where **Wait for Completion** suspends one execution per envelope, this hands
the outcome to a separate workflow — which is what lets it take the
intermediate events too, and what lets a batch go out without a **Loop Over
Items**.

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
