import OpenAI from 'openai';

/**
 * One place that decides which AI vendor answers a request.
 *
 * OpenRouter is preferred whenever OPENROUTER_API_KEY is present, because it
 * speaks the OpenAI chat-completions protocol — same SDK, different base URL —
 * so every route can keep calling `chat.completions.create` unchanged.
 *
 * Precedence:
 *   1. AI_PROVIDER=openai            -> OpenAI, even if an OpenRouter key exists
 *   2. OPENROUTER_API_KEY present    -> OpenRouter
 *   3. OPENAI_API_KEY present        -> OpenAI
 *   4. neither                       -> null (routes return 503)
 */

export type AIProviderName = 'openrouter' | 'openai';

export interface AIProvider {
  name: AIProviderName;
  client: OpenAI;
  /** model id to send, already translated to this provider's naming */
  model: string;
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** OpenRouter ids are vendor-prefixed; the app was written against bare OpenAI ids. */
function translateModel(model: string, provider: AIProviderName): string {
  if (provider === 'openai') return model;
  if (model.includes('/')) return model;
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return `openai/${model}`;
  if (model.startsWith('claude-')) return `anthropic/${model}`;
  return model;
}

export function getAIProvider(requestedModel?: string): AIProvider | null {
  const preferred = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAIKey = process.env.OPENAI_API_KEY?.trim();

  const useOpenRouter = preferred === 'openrouter' || (preferred !== 'openai' && Boolean(openRouterKey));

  if (useOpenRouter && openRouterKey) {
    const model =
      process.env.OPENROUTER_MODEL?.trim() ||
      translateModel(requestedModel || 'gpt-4o-mini', 'openrouter');

    return {
      name: 'openrouter',
      client: new OpenAI({
        apiKey: openRouterKey,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          // OpenRouter uses these for attribution on their dashboard
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://www.smartatsresume.com',
          'X-Title': 'SmartATS Resume',
        },
      }),
      model,
    };
  }

  if (openAIKey) {
    return {
      name: 'openai',
      client: new OpenAI({ apiKey: openAIKey }),
      model: process.env.OPENAI_MODEL?.trim() || requestedModel || 'gpt-4o-mini',
    };
  }

  return null;
}

/** For cache keys and logs: identifies the vendor+model actually used. */
export function aiModelKey(provider: AIProvider): string {
  return `${provider.name}:${provider.model}`;
}
