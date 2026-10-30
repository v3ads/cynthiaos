import Anthropic from '@anthropic-ai/sdk';

export const SONNET_FALLBACK = 'claude-sonnet-5-5';
export const SONNET_OUTPUT_TOKENS = 8192;
const CATALOG_VERSION = '2026-10-21';
const TTL = 5 * 60_000;

type Model = {
  id: string;
  line: string | null;
  lifecycle: string;
  created_at: string;
  max_tokens: number | null;
  capabilities?: {
    effort?: { medium?: { supported?: boolean } };
    thinking?: { types?: { adaptive?: { supported?: boolean } } };
  } | null;
};
type Page = { data: Model[]; has_more: boolean; last_id: string | null };

export function compatibleSonnet(model: Model): boolean {
  return model.line === 'sonnet' && model.lifecycle === 'active' &&
    !!model.id && Number.isFinite(Date.parse(model.created_at)) &&
    (model.max_tokens ?? 0) >= SONNET_OUTPUT_TOKENS &&
    model.capabilities?.effort?.medium?.supported === true &&
    model.capabilities?.thinking?.types?.adaptive?.supported === true;
}

// Version the metadata contract explicitly. Keep discovery independent of the
// Messages API version and fail closed when required capabilities are absent.
export function createSonnetResolver(client: Anthropic, now = Date.now) {
  let cache: { models: Model[]; expires: number } | undefined;
  let pending: Promise<Model[]> | undefined;
  async function discover(): Promise<Model[]> {
    if (cache && cache.expires > now()) return cache.models;
    if (pending) return pending;
    pending = (async () => {
      const models: Model[] = [];
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
        const page = await client.get<Page>('/v1/models', {
          headers: { 'anthropic-version': CATALOG_VERSION },
          query: { limit: 1000, ...(cursor ? { after_id: cursor } : {}) },
          timeout: 10_000, maxRetries: 0,
        });
        if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean') {
          throw new Error('Invalid Sonnet catalog');
        }
        models.push(...page.data);
        if (!page.has_more) {
          models.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id));
          cache = { models, expires: now() + TTL };
          return models;
        }
        if (!page.last_id || cursors.has(page.last_id)) throw new Error('Invalid Sonnet pagination');
        cursors.add(page.last_id);
        cursor = page.last_id;
      }
      throw new Error('Sonnet catalog page limit exceeded');
    })().catch(() => {
      // A short negative cache prevents an outage stampede. The documented,
      // tested fallback is still validated by an actual response before tools.
      cache = { models: [], expires: now() + 30_000 };
      return [];
    }).finally(() => { pending = undefined; });
    return pending;
  }
  return async (pinned?: string): Promise<string> => {
    const models = await discover();
    const compatible = models.filter(compatibleSonnet);
    const fallbackInfo = models.find(model => model.id === SONNET_FALLBACK);
    const fallbackAvailable = !fallbackInfo || compatibleSonnet(fallbackInfo);
    if (pinned) {
      if ((pinned === SONNET_FALLBACK && fallbackAvailable) || compatible.some(model => model.id === pinned)) return pinned;
      throw new Error('Conversation model unavailable; start a new conversation.');
    }
    if (compatible[0]) return compatible[0].id;
    if (fallbackAvailable) return SONNET_FALLBACK;
    throw new Error('No compatible Sonnet is available.');
  };
}

// Runtime checks apply to the entire response before the first tool executes.
// All 24 tools remain available; do not mark all strict (API limit: 20).
export function validateToolResponse(
  response: Anthropic.Message,
  tools: Anthropic.Tool[],
  usedIds: Set<string>,
): void {
  if (!Array.isArray(response.content) || !response.content.length ||
      !['end_turn', 'tool_use'].includes(response.stop_reason ?? '')) {
    throw new Error('Incomplete or refused model response');
  }
  const ids = new Set<string>();
  let calls = 0;
  for (const block of response.content) {
    if (!['text', 'thinking', 'redacted_thinking', 'tool_use'].includes(block.type)) {
      throw new Error('Unsupported model response block');
    }
    if ((block.type === 'text' && typeof block.text !== 'string') ||
        (block.type === 'thinking' && (typeof block.thinking !== 'string' || typeof block.signature !== 'string' || !block.signature)) ||
        (block.type === 'redacted_thinking' && (typeof block.data !== 'string' || !block.data))) throw new Error('Malformed model block');
    if (block.type !== 'tool_use') continue;
    calls++;
    const tool = tools.find(tool => tool.name === block.name);
    if (!tool || typeof block.id !== 'string' || !block.id || usedIds.has(block.id) || ids.has(block.id) ||
        !block.input || typeof block.input !== 'object' || Array.isArray(block.input)) {
      throw new Error('Invalid or repeated tool call');
    }
    ids.add(block.id);
    const input = block.input as Record<string, unknown>;
    const schema = tool.input_schema;
    const properties = (schema.properties ?? {}) as Record<string, { type?: string; enum?: unknown[] }>;
    if ((schema.required ?? []).some(key => !(key in input))) throw new Error('Missing tool argument');
    for (const [key, value] of Object.entries(input)) {
      const property = properties[key];
      if (!property || !['string', 'number', 'boolean'].includes(property.type ?? '') ||
          typeof value !== property.type || (typeof value === 'number' && !Number.isFinite(value)) ||
          (property.enum && !property.enum.includes(value))) throw new Error('Invalid tool argument');
    }
  }
  if ((response.stop_reason === 'tool_use') !== (calls > 0)) throw new Error('Invalid tool stop reason');
  if (response.stop_reason === 'end_turn' && !response.content.some(block => block.type === 'text' && block.text.trim())) {
    throw new Error('Missing final answer');
  }
}
