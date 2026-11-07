/**
 * Transport core for the KaffePOS backend API: base-URL resolution, the
 * authenticated fetch wrapper, and error shaping. Endpoint catalogs live in
 * src/lib/backendApi.ts and src/lib/api/* and build on this module only.
 */
import { Capacitor } from '@capacitor/core';
import { getStoredAccessToken } from '@/lib/authSession';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { resolveRuntimeApiBaseUrl } from '@/lib/releaseConfig';

const EXPLICIT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

export type RequestInitWithJson = RequestInit & {
  auth?: boolean;
  body?: BodyInit | null;
  json?: Record<string, unknown> | null;
};

export type ApiListResponse<T> = { items: T[] };
export type ApiRecord = Record<string, unknown>;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function resolveApiBaseUrl() {
  return resolveRuntimeApiBaseUrl({
    explicitApiBaseUrl: EXPLICIT_API_BASE_URL,
    hostname: typeof window === 'undefined' ? null : window.location.hostname,
    isNativePlatform: Capacitor.isNativePlatform(),
  });
}

export function buildApiUrl(path: string) {
  const apiBaseUrl = resolveApiBaseUrl();
  if (!apiBaseUrl) return path;
  return `${apiBaseUrl}${path}`;
}

async function getAccessToken() {
  return getStoredAccessToken();
}

export async function readErrorMessage(response: Response) {
  try {
    // Accept both the flat `{ message }` shape and the structured `{ error: { code, message } }`
    // shape so the reader is robust to either backend error-handler format.
    const data = await readJsonResponse<{ message?: string; error?: { message?: string }; errors?: Array<{ message?: string }> }>(response);
    return normalizeUserFacingError({
      message: data.message || data.error?.message || data.errors?.[0]?.message || `Request gagal (${response.status})`,
      status: response.status,
    });
  } catch {
    return normalizeUserFacingError({ message: `Request gagal (${response.status})`, status: response.status });
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentLength = response.headers.get('content-length');
  if (response.status === 204 || contentLength === '0') {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFetch<T>(path: string, init: RequestInitWithJson = {}): Promise<T> {
  const { auth = true, json = null, ...requestInit } = init;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (json) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = await getAccessToken();
    if (!token) {
      throw new ApiError('Sesi login tidak ditemukan.', 401);
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  const body = json ? JSON.stringify(json) : (requestInit.body ?? null);

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...requestInit,
      headers,
      body,
    });
  } catch (error) {
    throw new ApiError(normalizeUserFacingError(error, 'Tidak bisa terhubung ke server. Pastikan internet aktif atau coba lagi beberapa saat.'), 0);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  return readJsonResponse<T>(response);
}

