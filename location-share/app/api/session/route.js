import { NextResponse } from 'next/server';
import { createSession } from '@/lib/sessions';

export async function POST() {
  const session = createSession();
  return NextResponse.json({ id: session.id, expiresAt: session.expiresAt });
}
