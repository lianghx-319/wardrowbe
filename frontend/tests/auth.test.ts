import { describe, expect, it } from 'vitest';
import { resolveAuthRedirectUrl } from '@/lib/auth';

describe('auth redirects', () => {
  it('keeps relative callback URLs relative', () => {
    expect(resolveAuthRedirectUrl('/dashboard', 'http://localhost:3000')).toBe('/dashboard');
  });

  it('converts same-origin absolute callback URLs to relative paths', () => {
    expect(
      resolveAuthRedirectUrl(
        'http://192.168.2.9:3000/invite?token=abc#details',
        'http://192.168.2.9:3000'
      )
    ).toBe('/invite?token=abc#details');
  });

  it('rejects external callback URLs', () => {
    expect(resolveAuthRedirectUrl('https://example.com/dashboard', 'http://localhost:3000')).toBe(
      '/dashboard'
    );
  });
});
