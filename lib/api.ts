// lib/api.ts — Cliente HTTP para o backend FastAPI

import { ChatRequest, ChatResponse } from '@/types/chat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/**
 * Envia uma mensagem para o tutor de IA.
 * @param session_id - ID da sessão (thread_id do LangGraph)
 * @param message   - Pergunta do estudante
 * @returns ChatResponse com a resposta do tutor e metadados CRAG
 */
export async function sendChatMessage(
  session_id: string,
  message: string
): Promise<ChatResponse> {
  const payload: ChatRequest = { session_id, message };

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Erro na API (${response.status}): ${errorText}`);
  }

  const data: ChatResponse = await response.json();
  return data;
}

/**
 * Verifica se o backend está online.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
