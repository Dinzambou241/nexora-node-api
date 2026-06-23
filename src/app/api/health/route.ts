import { corsJson, corsOptions } from '@/lib/cors';

export function OPTIONS() {
  return corsOptions();
}

export function GET() {
  return corsJson({
    ok: true,
    service: 'nexora-node-api',
    time: new Date().toISOString(),
  });
}
