/** Kitchen display endpoint catalog + SSE realtime subscription. */
import { getStoredAccessToken } from '@/lib/authSession';
import { ApiError, apiFetch, buildApiUrl, readErrorMessage } from './client';
import type {
  KitchenOrder,
  KitchenOrderStatus,
  KitchenRealtimeEvent,
  KitchenRealtimeStatus,
  KitchenStation,
} from '@/types';

export const getKitchenOrders = (storeId: string, filters?: { status?: KitchenOrderStatus; station?: KitchenStation | 'all' }) => {
  const params = new URLSearchParams({ storeId });
  if (filters?.status) params.set('status', filters.status);
  if (filters?.station && filters.station !== 'all') params.set('station', filters.station);
  return apiFetch<{ items: KitchenOrder[] }>(`/api/kitchen/orders?${params.toString()}`);
};

export const updateKitchenOrderStatus = (
  id: string,
  payload: { store_id: string; status: KitchenOrderStatus; reason?: string | null; changed_by_name?: string | null },
) => apiFetch<KitchenOrder>(`/api/kitchen/orders/${id}/status`, { method: 'PATCH', json: payload });

export const updateKitchenItemStatus = (
  id: string,
  payload: { store_id: string; status: KitchenOrderStatus; changed_by_name?: string | null },
) => apiFetch<KitchenOrder>(`/api/kitchen/items/${id}/status`, { method: 'PATCH', json: payload });

export function subscribeKitchenEvents(options: {
  storeId: string;
  onEvent: (event: KitchenRealtimeEvent) => void;
  onStatus?: (status: KitchenRealtimeStatus) => void;
  onError?: (error: unknown) => void;
}) {
  const controller = new AbortController();
  let stopped = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;

  const connect = async () => {
    if (stopped) return;
    options.onStatus?.(retryAttempt > 0 ? 'reconnecting' : 'connecting');
    try {
      const token = await getStoredAccessToken();
      if (!token) throw new ApiError('Sesi login tidak ditemukan.', 401);

      const response = await fetch(buildApiUrl(`/api/kitchen/events?storeId=${encodeURIComponent(options.storeId)}`), {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new ApiError(await readErrorMessage(response), response.status);
      }

      retryAttempt = 0;
      options.onStatus?.('connected');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6)) as KitchenRealtimeEvent | { type: 'ping' };
            if (event.type === 'ping') continue;
            if ('id' in event) {
              options.onEvent(event as KitchenRealtimeEvent);
            }
          } catch {
            // Ignore malformed event chunks and wait for the next full SSE frame.
          }
        }
      }

      if (!stopped) throw new Error('Kitchen realtime terputus.');
    } catch (error) {
      if (stopped || controller.signal.aborted) return;
      retryAttempt += 1;
      options.onError?.(error);
      options.onStatus?.(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting');
      const delay = Math.min(20_000, 1000 * 2 ** Math.min(retryAttempt, 5));
      retryTimer = setTimeout(connect, delay);
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller.abort();
  };
}

