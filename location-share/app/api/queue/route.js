// In-memory queue for pre-generated scripts.
// Survives across requests within the same Vercel function instance.
// Browser polls this on load; cron pushes jobs here.

export const runtime = 'nodejs';

const pendingJobs = [];

export async function GET() {
  return Response.json({ jobs: pendingJobs.splice(0) }); // drain and return
}

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('x-cron-secret') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const job = await request.json();
  pendingJobs.push({ ...job, queuedAt: new Date().toISOString() });
  return Response.json({ ok: true, total: pendingJobs.length });
}
