import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import App from '#app/app.ts';
import config from '#config';

const NativeRequest = globalThis.Request;
const nativeFetch = globalThis.fetch;

/**
 * Node's native `Request` (undici) requires an absolute URL with an origin,
 * whereas browser code commonly passes root-relative paths like `'/data/scrobbles.json'`.
 *
 * `vite-ember-ssr` wraps `globalThis.fetch` with middleware that constructs
 * `new Request(input, init)` before delegating to the underlying `fetch`.
 * Extending `globalThis.Request` resolves root-relative paths against the
 * HappyDOM window's `location.origin` (`http://localhost`) so `new Request(...)`
 * does not throw `TypeError: Failed to parse URL`.
 */
globalThis.Request = class extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = new URL(input, globalThis.location?.origin ?? 'http://localhost');
    }
    super(input, init);
  }
};

/**
 * During build-time SSG (`vite build`), there is no HTTP server listening on
 * `http://localhost` to serve static assets from `public/`.
 *
 * `vite-ember-ssr` imports this SSR entry module before capturing `globalThis.fetch`
 * as its underlying `realFetch`. Wrapping `globalThis.fetch` here intercepts
 * same-origin requests and serves the matching file directly from `public/` on disk,
 * while forwarding any external URLs to Node's native `fetch`.
 */
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const request = new globalThis.Request(input, init);
  const url = new URL(request.url);
  const origin = globalThis.location?.origin ?? 'http://localhost';

  if (url.origin === origin) {
    try {
      const filePath = join(process.cwd(), 'public', url.pathname);
      const body = await readFile(filePath);
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  }

  return nativeFetch(request);
};

/**
 * The server waits for settled() before it reads the DOM,
 * so pending data, timers, and test waiters are part of the page.
 */
export { settled } from '@ember/test-helpers';

/**
 * Entrypoint used by vite-ember-ssr.
 */
export function createSsrApp() {
  return App.create({ ...config.APP, autoboot: false });
}
