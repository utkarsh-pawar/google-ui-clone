import { NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/sessions';

export async function GET(request, { params }) {
  const session = getSession(params.id);
  if (!session) {
    return NextResponse.json({ error: 'Session expired or not found' }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PUT(request, { params }) {
  const { lat, lng, accuracy } = await request.json();
  const session = updateSession(params.id, lat, lng, accuracy);
  if (!session) {
    return NextResponse.json({ error: 'Session expired or not found' }, { status: 404 });
  }
  return NextResponse.json(session);
}
