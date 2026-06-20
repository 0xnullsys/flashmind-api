// API client
const BASE_URL = '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, config);

  if (response.status === 429) {
    throw new ApiError('Terlalu banyak permintaan', 429);
  }

  if (response.status === 401) {
    throw new ApiError('Tidak diizinkan', 401);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || 'Terjadi kesalahan server', response.status);
  }

  return response.json();
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Auth
export function guestSession() {
  return apiFetch<{ ok: boolean; role: string }>('/auth/guest', { method: 'POST' });
}

export function register(data: {
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  password: string;
}) {
  return apiFetch<{ ok: boolean; user: UserData }>('/auth/register', {
    method: 'POST',
    body: data,
  });
}

export function login(data: { email: string; password: string }) {
  return apiFetch<{ ok: boolean; user: UserData }>('/auth/login', {
    method: 'POST',
    body: data,
  });
}

export function logout() {
  return apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

// User
export function getProfile() {
  return apiFetch<{ user: UserData }>('/users');
}

export function updateProfile(data: { firstName?: string; lastName?: string; notes?: string }) {
  return apiFetch<{ ok: boolean }>('/users', {
    method: 'PATCH',
    body: data,
  });
}

// Flashcards
export function getFlashcards() {
  return apiFetch<{ cards: FlashCardData[] }>('/flashcards');
}

export function createFlashcard(data: {
  title: string;
  notes: string;
  attachments?: string[];
  source?: string;
  category?: string;
}) {
  return apiFetch<{ card: FlashCardData }>('/flashcards', {
    method: 'POST',
    body: data,
  });
}

export function deleteFlashcard(id: string) {
  return apiFetch<{ ok: boolean }>(`/flashcards/${id}`, { method: 'DELETE' });
}

// AI Test
export function testAI(notes: string, files?: File[]) {
  // ponytail: support optional file upload (multipart when files present, JSON otherwise)
  if (files && files.length > 0) {
    const form = new FormData();
    if (notes) form.append('catatan', notes);
    for (const f of files) form.append('files', f);
    return fetch('/api/test', {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data.error || 'Gagal menghasilkan kartu', res.status);
      return data;
    });
  }
  return apiFetch<{ cards: Array<{ judul: string; catatan: string }> }>('/test', {
    method: 'POST',
    body: { catatan: notes },
  });
}

// Admin
export function getAdminStats(apiKey: string) {
  return apiFetch<AdminStatsData>('/v0/stats', {
    headers: { 'X-Api-Key': apiKey },
  });
}

export function getAdminUsers(apiKey: string) {
  return apiFetch<{ users: UserData[] }>('/v0/users', {
    headers: { 'X-Api-Key': apiKey },
  });
}

export function getAdminGuests(apiKey: string) {
  return apiFetch<{ guests: Array<{ id: string; ip: string; createdAt: string }> }>('/v0/guests', {
    headers: { 'X-Api-Key': apiKey },
  });
}

export function getAdminFlashcards(apiKey: string) {
  return apiFetch<{ cards: FlashCardData[] }>('/v0/flashcards', {
    headers: { 'X-Api-Key': apiKey },
  });
}

// Types
export interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  notes?: string;
  createdAt?: string;
}

export interface FlashCardData {
  id: string;
  userId: string;
  title: string;
  notes: string;
  attachments?: string[];
  source: string;
  category?: string | null;
  createdAt: string;
}

export interface AdminStatsData {
  stats: {
    totalUsers: number;
    totalGuests: number;
    totalCards: number;
  };
  latestTraces: Array<{
    tabel: string;
    acara: string;
    rute: string;
    pada: string;
    meta: Record<string, unknown>;
  }>;
}