import { NextResponse } from 'next/server';

function firstHeaderValue(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null;
}

function getRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'));
  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost || request.headers.get('host') || requestUrl.host;
  const protocol = forwardedProto || requestUrl.protocol.replace(':', '');

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const appUrl = getRequestOrigin(request);
  const endSessionUrl = process.env.OIDC_END_SESSION_URL;
  const tinyAuthUrl = process.env.TINYAUTH_URL;

  let logoutUrl: string;

  if (endSessionUrl) {
    logoutUrl = `${endSessionUrl}?post_logout_redirect_uri=${encodeURIComponent(new URL('/login', appUrl).toString())}`;
  } else if (tinyAuthUrl) {
    logoutUrl = `${tinyAuthUrl}/logout?redirect_uri=${encodeURIComponent(appUrl)}`;
  } else {
    logoutUrl = new URL('/login', appUrl).toString();
  }

  const signOutUrl = new URL('/api/auth/signout', appUrl);
  signOutUrl.searchParams.set('callbackUrl', logoutUrl);

  return NextResponse.redirect(signOutUrl);
}
