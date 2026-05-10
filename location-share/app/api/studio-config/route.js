export const runtime = 'nodejs';

export async function GET() {
  const { getStudioConfig } = await import('@/lib/serverPipeline.js');
  return Response.json(await getStudioConfig());
}

export async function POST(request) {
  const body = await request.json();
  const { setStudioConfig } = await import('@/lib/serverPipeline.js');
  await setStudioConfig(body);
  return Response.json({ ok: true });
}
