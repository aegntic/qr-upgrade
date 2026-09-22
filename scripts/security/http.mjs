export function childExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

export async function readHttpResponse(
  url,
  init = {},
  timeoutMs = 15000,
  label = String(url),
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.text();
    return {
      body,
      headers: response.headers,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        `${label} timed out after ${timeoutMs}ms while reading the response.`,
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
