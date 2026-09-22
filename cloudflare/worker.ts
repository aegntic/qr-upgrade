// @ts-ignore OpenNext generates this module during the separate Cloudflare build.
import handler from '../.open-next/worker.js';
import { guardRequest } from './guard';
import type { WebEnvironment } from './runtime';
export default {
  fetch(request: Request, env: WebEnvironment, ctx: unknown) {
    return guardRequest(request, env, forwarded => handler.fetch(forwarded, env, ctx));
  },
};
