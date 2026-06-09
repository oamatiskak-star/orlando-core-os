export interface AiRouterRequest {
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
  tier?: string;
  provider?: string;
  maxTokens?: number;
}

export interface AiRouterResponse {
  text: string;
  model: string;
  provider: string;
}

const AI_ROUTER_URL =
  process.env.AI_ROUTER_URL || 'http://localhost:8787';

const AI_ROUTER_API_KEY =
  process.env.AI_ROUTER_API_KEY || '';

export async function complete(
  request: AiRouterRequest,
): Promise<AiRouterResponse> {
  const response = await fetch(
    `${AI_ROUTER_URL}/v1/complete`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': AI_ROUTER_API_KEY,
      },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    throw new Error(
      `AI Router error ${response.status}`,
    );
  }

const data = (await response.json()) as AiRouterResponse;
return data;
}
export interface AiMemorySearchRequest {
  query: string;
  scope?: string;
  scopeRef?: string;
  limit?: number;
}

export interface AiMemoryHit {
  id: string;
  scope: string;
  scope_ref: string | null;
  kind: string | null;
  content: string;
  tags: string[];
  importance: number;
  metadata: Record<string, unknown>;
  similarity: number;
  created_at: string;
}

export interface AiMemorySearchResponse {
  hits: AiMemoryHit[];
}

export async function memorySearch(
  request: AiMemorySearchRequest,
): Promise<AiMemorySearchResponse> {
  const response = await fetch(`${AI_ROUTER_URL}/v1/memory/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': AI_ROUTER_API_KEY,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AI Router memory error ${response.status}`);
  }

  const data = (await response.json()) as AiMemorySearchResponse;
  return data;
}
