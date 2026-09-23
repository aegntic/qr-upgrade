# Seedance 2.5 server-side example

Run from the repository root using Node 22+ and npm. The official `@higgsfield/client/v2` SDK is installed; Node's built-in `loadEnvFile` loads `.env.local`, so no extra loader is needed.

Add `HF_CREDENTIALS=key-id:key-secret` locally to `.env.local` using your editor. This file is Git-ignored. Never use a NEXT_PUBLIC variable or import the example into the UI. Do not paste keys into chat or commit them.

```sh
npm run higgsfield:example
```

This submits ONE BILLABLE request to `bytedance/seedance-2.5/text-to-video`, with prompt `A cinematic scene at sunset`, duration 5, resolution 720p, ratio 16:9, MP4 and audio enabled. It waits through the SDK's `subscribe` method and prints only the HTTPS video URL on confirmed completion. It exits unsuccessfully for failure, moderation, cancellation or missing output. SDK errors are sanitised; credentials and full HTTP responses are never logged.

Submission retries are disabled. Polling is bounded to ten minutes. The installed SDK does not declare a cancellation status in its polling types; if it fails to terminate on a provider cancellation, the timeout is reported as unconfirmed, never successful. Check the dashboard before retrying a timeout/network error to avoid duplicate billing.

This is an API smoke example, not the final QR hero. Do not run it in CI, builds, or browser page loads. Website free generations and the API balance are separate; verify promotional credit in the API dashboard.

Official sources read before implementation:
- https://docs.higgsfield.ai/docs/how-to/sdk
- https://console.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference

## Verification — 23 September 2026

The example was executed once but exited unsuccessfully and returned no video URL. The signed-in API dashboard showed a $0.00 balance, and the promotional-credit dialog required adding a card and verifying business email. Generation is NOT verified successful. No automatic retry or purchase was made. Complete that account step, then rerun the command.
