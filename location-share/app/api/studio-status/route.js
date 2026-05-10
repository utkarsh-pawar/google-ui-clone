export const runtime = 'nodejs';

export async function GET() {
  const { getRecentJobs, getStudioConfig, getYouTubeRefreshToken } = await import('@/lib/serverPipeline.js');
  const [jobs, config] = await Promise.all([getRecentJobs(), getStudioConfig()]);
  const channelId = config.channelId || 'chants';
  const ytToken = await getYouTubeRefreshToken(channelId);
  return Response.json({ jobs, config: { ...config, ytTokenStored: !!ytToken } });
}
