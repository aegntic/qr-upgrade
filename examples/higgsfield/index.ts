// Server-only CLI example. Never import this file from a browser component.
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { config, higgsfield } from '@higgsfield/client/v2';

async function main() {
  try {
    loadEnvFile(resolve(process.cwd(), '.env.local'));
  } catch {
    console.error('Cannot load .env.local. Run from the project root and enter HF_CREDENTIALS locally.');
    process.exitCode = 1;
    return;
  }
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials || !/^[^\s:]+:[^\s:]+$/.test(credentials)) {
    console.error('Set HF_CREDENTIALS in .env.local as key-id:key-secret. No request submitted.');
    process.exitCode = 1;
    return;
  }
  config({ credentials, maxRetries: 0, maxPollTime: 600_000, pollInterval: 5_000 });
  console.error('Submitting one billable Seedance 2.5 generation; waiting for completion.');
  const result = await higgsfield.subscribe('bytedance/seedance-2.5/text-to-video', {
    input: {
      prompt: 'A cinematic scene at sunset',
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
      output_format: 'mp4',
      generate_audio: true,
    },
    withPolling: true,
  });
  // Check runtime statuses, including future SDK cancellation/moderation states.
  const status: string = result.status;
  if (status !== 'completed') {
    const description = ({
      failed: 'Generation failed.',
      canceled: 'Generation was canceled.',
      cancelled: 'Generation was canceled.',
      nsfw: 'Generation was blocked by moderation.',
      moderated: 'Generation was blocked by moderation.',
    } as Record<string, string>)[status] ?? 'Generation did not complete.';
    console.error(description);
    process.exitCode = 1;
    return;
  }
  const url = result.video?.url;
  if (!url || !URL.canParse(url) || new URL(url).protocol !== 'https:') {
    console.error('Provider reported completion but did not return a valid HTTPS video URL.');
    process.exitCode = 1;
    return;
  }
  // Print only the generated video URL, never the response/configuration/credential.
  console.log(url);
}

main().catch((error: unknown) => {
  // Never print raw SDK errors: HTTP errors may contain Authorization headers.
  const messages: Record<string, string> = {
    AuthenticationError: 'Authentication failed. Check the credential locally.',
    CredentialsMissedError: 'Credential missing. Enter it locally in .env.local.',
    NotEnoughCreditsError: 'The provider rejected access or available credits. Check API billing.',
    AccountError: 'The provider rejected access or available credits. Check API billing.',
    ValidationError: 'The provider rejected the request parameters.',
    BadInputError: 'The provider rejected the request input.',
    TimeoutError: 'Completion could not be confirmed before timeout. Check the dashboard before retrying; the request may still be running or billed.',
  };
  const name = error instanceof Error ? error.name : '';
  console.error(messages[name] ?? 'Higgsfield request failed or was interrupted. No success confirmed; check the dashboard before retrying.');
  process.exitCode = 1;
});
