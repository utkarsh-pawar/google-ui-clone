export async function GET() {
  return Response.json({
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY ? `set (${process.env.CEREBRAS_API_KEY.slice(0, 8)}...)` : 'NOT SET',
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ? 'set' : 'NOT SET',
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ? 'set' : 'NOT SET',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  });
}
