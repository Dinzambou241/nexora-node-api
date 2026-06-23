import { NextResponse } from 'next/server';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

function withCorsHeaders(headers?: HeadersInit) {
  const merged = new Headers(headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    merged.set(key, value);
  });
  return merged;
}

export function corsJson(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: withCorsHeaders(init.headers),
  });
}

export function corsOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: withCorsHeaders(),
  });
}
