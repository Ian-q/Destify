import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieStore.set(name, value); },
    delete: (name: string) => { cookieStore.delete(name); },
  }),
}));

import { getSessionUserId, requireSession, SESSION_COOKIE } from '@/lib/session';

describe('session module', () => {
  beforeEach(() => cookieStore.clear());

  it('getSessionUserId returns null when cookie absent', async () => {
    expect(await getSessionUserId()).toBeNull();
  });

  it('getSessionUserId returns the cookie value when present', async () => {
    cookieStore.set(SESSION_COOKIE, 'user-uuid-123');
    expect(await getSessionUserId()).toBe('user-uuid-123');
  });

  it('requireSession throws when cookie absent', async () => {
    await expect(requireSession()).rejects.toThrow(/no session/i);
  });

  it('requireSession returns userId when present', async () => {
    cookieStore.set(SESSION_COOKIE, 'user-uuid-123');
    expect(await requireSession()).toBe('user-uuid-123');
  });
});
