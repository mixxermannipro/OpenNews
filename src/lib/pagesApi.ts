import {
  checkApiOrigin,
  createSlidingWindowLimiter,
  fetchPublicWithRedirects,
  handleAiProxy,
  handleArticleExtract,
  handleDiagnosticsPost,
  handleFeedsDiscover,
  handleFeedsFetch,
  handleMediaTranscript,
  handleTtsProxy,
  MAX_JSON_BODY_BYTES,
  MAX_RESPONSE_BYTES,
  RATE_LIMIT_AI,
  RATE_LIMIT_GENERAL,
  RATE_LIMIT_TTS,
  rateLimitHeaders,
  readPublicTextFromResponse,
  type ApiResult,
  type ApiRuntimeDeps,
  type ExtractedArticlePayload,
  type RateLimitDecision,
  type RateLimiter,
} from './apiCore.ts';

export type { ExtractedArticlePayload } from './apiCore.ts';

export interface CloudflareRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface PagesApiEnv {
  OPENNEWS_DIAGNOSTICS?: string;
  OPENNEWS_ORIGIN?: string;
  OPENNEWS_OPTOUT_DOMAINS?: string;
  RATE_LIMIT_API?: CloudflareRateLimitBinding;
  RATE_LIMIT_AI?: CloudflareRateLimitBinding;
  RATE_LIMIT_TTS?: CloudflareRateLimitBinding;
}

export interface PagesApiDeps {
  fetchImpl?: typeof fetch;
  extractArticle?: (
    response: Response,
    finalUrl: string,
    articleTitle?: string,
  ) => Promise<ExtractedArticlePayload>;
  rateLimiters?: {
    general?: RateLimiter;
    ai?: RateLimiter;
    tts?: RateLimiter;
  };
  disableRateLimit?: boolean;
}

const defaultGeneralLimiter = createSlidingWindowLimiter(RATE_LIMIT_GENERAL);
const defaultAiLimiter = createSlidingWindowLimiter(RATE_LIMIT_AI);
const defaultTtsLimiter = createSlidingWindowLimiter(RATE_LIMIT_TTS);

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function toResponse(result: ApiResult, extraHeaders?: Record<string, string>): Response {
  const headers = { ...extraHeaders, ...result.headers };
  if (result.kind === 'empty') {
    return new Response(null, { status: result.status, headers });
  }
  if (result.kind === 'text') {
    return new Response(String(result.body ?? ''), {
      status: result.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        ...headers,
      },
    });
  }
  if (result.kind === 'bytes') {
    const bytes = result.body instanceof Uint8Array ? result.body : new Uint8Array(0);
    return new Response(bytes.buffer as ArrayBuffer, {
      status: result.status,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        ...headers,
      },
    });
  }
  return jsonResponse(result.body, result.status, headers);
}

async function readJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function resolveClientKey(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) return xff;
  return 'anonymous';
}

async function enforceLimit(
  binding: CloudflareRateLimitBinding | undefined,
  fallback: RateLimiter,
  key: string,
  spec: { limit: number; windowMs: number },
  errorMessage: string,
): Promise<{ response?: Response; headers: Record<string, string> }> {
  let decision: RateLimitDecision;
  if (binding) {
    const res = await binding.limit({ key });
    decision = {
      allowed: res.success,
      limit: spec.limit,
      remaining: res.success ? Math.max(0, spec.limit - 1) : 0,
      resetSeconds: Math.ceil(spec.windowMs / 1000),
    };
  } else {
    decision = await fallback.check(key);
  }
  const headers = rateLimitHeaders(decision);
  if (!decision.allowed) {
    return {
      response: jsonResponse({ error: errorMessage }, 429, headers),
      headers,
    };
  }
  return { headers };
}

/**
 * Handles all `/api/*` requests for OpenNews on Cloudflare Pages Functions.
 */
export async function handlePagesApiRequest(
  request: Request,
  env: PagesApiEnv = {},
  deps: PagesApiDeps = {},
): Promise<Response> {
  const originError = checkApiOrigin(request.headers, request.url, env.OPENNEWS_ORIGIN);
  if (originError) {
    return jsonResponse({ error: originError.error }, 403);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === '/api/health' && method === 'GET') {
    return jsonResponse({ ok: true, service: 'OpenNews', runtime: 'cloudflare-pages' });
  }

  let limitHeaders: Record<string, string> = {};
  if (!deps.disableRateLimit) {
    const clientKey = resolveClientKey(request);
    const generalResult = await enforceLimit(
      env.RATE_LIMIT_API,
      deps.rateLimiters?.general ?? defaultGeneralLimiter,
      `api:${clientKey}`,
      RATE_LIMIT_GENERAL,
      'Zu viele Anfragen. Bitte versuche es gleich erneut.',
    );
    if (generalResult.response) return generalResult.response;
    limitHeaders = generalResult.headers;

    if (path === '/api/ai/proxy' && method === 'POST') {
      const aiResult = await enforceLimit(
        env.RATE_LIMIT_AI,
        deps.rateLimiters?.ai ?? defaultAiLimiter,
        `ai:${clientKey}`,
        RATE_LIMIT_AI,
        'Zu viele KI-Anfragen. Bitte versuche es gleich erneut.',
      );
      if (aiResult.response) return aiResult.response;
      limitHeaders = aiResult.headers;
    }

    if (path === '/api/tts/proxy' && method === 'POST') {
      const ttsResult = await enforceLimit(
        env.RATE_LIMIT_TTS,
        deps.rateLimiters?.tts ?? defaultTtsLimiter,
        `tts:${clientKey}`,
        RATE_LIMIT_TTS,
        'Zu viele Vorlese-Anfragen. Bitte versuche es gleich erneut.',
      );
      if (ttsResult.response) return ttsResult.response;
      limitHeaders = ttsResult.headers;
    }
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const runtimeDeps: ApiRuntimeDeps = {
    fetchPublic: (target, init) => fetchPublicWithRedirects(target, init, fetchImpl),
    readPublicText: (resp, maxBytes = MAX_RESPONSE_BYTES, opts) =>
      readPublicTextFromResponse(resp, maxBytes, opts),
    extractArticle: deps.extractArticle,
    diagnosticsEnabled: env.OPENNEWS_DIAGNOSTICS === '1',
    optOutDomainsCsv: env.OPENNEWS_OPTOUT_DOMAINS,
  };

  if (path === '/api/diagnostics' && method === 'GET') {
    return jsonResponse(
      { enabled: env.OPENNEWS_DIAGNOSTICS === '1' },
      200,
      { 'Cache-Control': 'no-store', ...limitHeaders },
    );
  }

  if (path === '/api/diagnostics' && method === 'POST') {
    const body = await readJsonBody(request);
    return toResponse(handleDiagnosticsPost(body, env.OPENNEWS_DIAGNOSTICS === '1'), limitHeaders);
  }

  if (path === '/api/feeds/fetch' && method === 'POST') {
    const body = await readJsonBody(request);
    return toResponse(await handleFeedsFetch(body, runtimeDeps), limitHeaders);
  }

  if (path === '/api/feeds/discover' && method === 'GET') {
    return toResponse(await handleFeedsDiscover(String(url.searchParams.get('q') || ''), runtimeDeps), limitHeaders);
  }

  if (path === '/api/media/transcript' && method === 'GET') {
    return toResponse(await handleMediaTranscript(url.searchParams.get('url') || '', runtimeDeps), limitHeaders);
  }

  if (path === '/api/article/extract' && method === 'GET') {
    const targetUrl = String(url.searchParams.get('url') || '');
    const articleTitle = String(url.searchParams.get('title') || '').trim().slice(0, 300) || undefined;
    return toResponse(await handleArticleExtract(targetUrl, articleTitle, runtimeDeps), limitHeaders);
  }

  if (path === '/api/ai/proxy' && method === 'POST') {
    const body = await readJsonBody(request);
    return toResponse(await handleAiProxy(body, runtimeDeps), limitHeaders);
  }

  if (path === '/api/tts/proxy' && method === 'POST') {
    const body = await readJsonBody(request);
    return toResponse(await handleTtsProxy(body, runtimeDeps), limitHeaders);
  }

  return jsonResponse({ error: 'Not found' }, 404, limitHeaders);
}
