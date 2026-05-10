export const runtime = 'nodejs';

export async function GET() {
  const { getRecentJobs, getStudioConfig } = await import('@/lib/serverPipeline.js');
  const [jobs, config] = await Promise.all([getRecentJobs(), getStudioConfig()]);
  return Response.json({ jobs, config });
}
