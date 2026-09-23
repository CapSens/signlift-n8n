# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-09-23

### Added

- **Wait for Completion** on *Send for Signature* and *Create*. The node hands
  Signlift this execution's own resume URL as the envelope's callback, suspends
  the execution, and resumes it when the envelope reaches a terminal state.
  Nothing to configure on the Signlift side: each execution carries its own
  address, so any number of workflows can wait at once.

  It waits indefinitely by default. An envelope running out of time is not a
  hang — `request.expired` is terminal, so the execution resumes with the
  envelope. **Limit Wait Time** only guards against a callback that never
  arrives at all.

  It needs this n8n reachable over HTTPS and the webhook secret on the
  credential, and refuses a batch, an execution suspending only once. All three
  are refused up front with an explanation rather than failing later.

### Removed

- **Signlift Trigger**, and with it every webhook this package registered.

  It served the case of one workflow listening to everything, and it could not
  register its own URL: Signlift has no webhook management API, so the node
  carried `webhookMethods` that claimed to register with an endpoint that does
  not exist, and asked the user to paste the URL by hand. Worse, a Signlift
  application holds a single webhook URL, so activating a second listening
  workflow silently stole the first one's.

  The wait mode covers what most integrations actually wanted from it. The
  trigger comes back when Signlift exposes endpoint management, which is
  tracked in CapSens/signlift#367.

### Changed

- The package now has a test suite, with the build failing below 90% branch
  coverage. Branches are at 100%.

## [0.1.2] - 2026-09-23

### Changed

- The node can now be attached to an AI agent. n8n's verification requires
  the property, and its linter disregards an inline exemption, so there was
  no middle ground between this and staying off n8n Cloud. An agent still
  only reaches the node if someone attaches it to one, and the binary
  operations — upload, download, send for signature — stay out of its reach
  either way, since tools carry no binary.

## [0.1.1] - 2026-09-23

Same node as 0.1.0. This version exists to carry a provenance attestation,
which 0.1.0 could not: it was published by hand to create the package, and
npm only signs provenance from a recognised CI. Prefer this one.

### Changed

- Releases are automatic. Merging a pull request that bumps the version
  publishes it and tags the commit, with no token stored anywhere: npm trusts
  the repository and the workflow directly.

## [0.1.0] - 2026-09-23

First release. The API surface is stable but the node is young: expect the
parameter shapes to move before 1.0.

### Added

**Signlift node** — four resources, declarative:

- **Signature Request** — Send for Signature (upload and create in one step),
  Create, Get, Get Many, Download.
- **Document** — Upload, Get, Get Many.
- **Audit Log** — Get Many.
- **Branding Profile** — Get Many, also feeding a searchable picker on the
  creation form so an id never has to be read from the dashboard.

Collections share one envelope, with filters on status and creation date, a
sort order, and paging that honours the API's cap of 100 per page.

**Signlift Trigger** — starts a workflow on a signing event: request
completed or expired, signer notified, signed, or sent a one-time code.

- Verifies the HMAC signature against the raw request body, in constant time.
  A request that does not verify gets a `401` and never starts the workflow.
- Remembers recent delivery ids, so a lost acknowledgement does not run the
  workflow twice when Signlift replays a delivery.

**Credential** — API key, deployment selector, and an optional webhook secret
used by the trigger alone.

### Notes

- Signatures are placed by **tag** — a marker such as `[SIG_JEAN]` written in
  the document — rather than by page and coordinates, which break as soon as
  the document reflows.
- **Send for Signature** must not be retried with n8n's Retry On Fail: a retry
  re-runs the upload and leaves an unattached document behind each time. Chain
  **Upload** and **Create** when a retry matters.
- The node is deliberately not exposed as an AI tool. It moves binary data,
  which tools cannot carry, and sending a legally binding signature request is
  not something to hand to an agent by default.
- There is no polling trigger. The list endpoint filters and sorts on
  creation and exposes no completion timestamp, so polling could notice new
  requests but not a request being signed.

[0.1.2]: https://github.com/CapSens/signlift-n8n/releases/tag/0.1.2
[0.1.1]: https://github.com/CapSens/signlift-n8n/releases/tag/0.1.1
[0.1.0]: https://github.com/CapSens/signlift-n8n/releases/tag/0.1.0
