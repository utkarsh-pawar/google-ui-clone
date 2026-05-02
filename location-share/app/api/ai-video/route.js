export const maxDuration = 60;
export const runtime = 'nodejs';

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const FAL_KEY = process.env.FAL_API_KEY;

function addMotion(prompt) {
  return `${prompt}, smooth cinematic motion, professional video quality, 4k`;
}

// Fal.ai fast-animatediff — synchronous ~15-20s
async function generateWithFal(prompt, width, height) {
  const res = await fetch('https://fal.run/fal-ai/fast-animatediff/text-to-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({
      prompt: addMotion(prompt),
      num_inference_steps: 25,
      guidance_scale: 7.5,
      num_frames: 16,
      fps: 8,
      width,
      height,
    }),
    signal: AbortSignal.timeout(50000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fal.ai ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const url = data?.video?.url || data?.url || null;
  if (!url) throw new Error('Fal.ai returned no video URL');
  return url;
}

// Replicate AnimateDiff — start prediction, poll every 3s up to 50s
async function generateWithReplicate(prompt, width, height) {
  const createRes = await fetch('https://api.replicate.com/v1/models/lucataco/animate-diff/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REPLICATE_TOKEN}`,
      'Prefer': 'wait=5',
    },
    body: JSON.stringify({
      input: {
        prompt: addMotion(prompt),
        width,
        height,
        num_frames: 16,
        num_inference_steps: 25,
        guidance_scale: 7.5,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '');
    throw new Error(`Replicate create ${createRes.status}: ${body.slice(0, 200)}`);
  }

  let prediction = await createRes.json();
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error('Replicate returned no polling URL');

  // Poll every 3s, total budget ~50s
  const deadline = Date.now() + 50000;
  while (Date.now() < deadline) {
    if (prediction.status === 'succeeded') {
      const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      if (!url) throw new Error('Replicate succeeded but no output URL');
      return url;
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || ''}`);
    }

    await new Promise(r => setTimeout(r, 3000));

    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!pollRes.ok) throw new Error(`Replicate poll ${pollRes.status}`);
    prediction = await pollRes.json();
  }

  throw new Error('Replicate timed out after 50s');
}

export async function POST(request) {
  const { prompt, orientation = 'landscape' } = await request.json();
  if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });

  if (!FAL_KEY && !REPLICATE_TOKEN) {
    return Response.json({ error: 'No AI video API key configured' }, { status: 503 });
  }

  // Portrait: 512×896 (9:16, divisible by 64), Landscape: 768×432 (16:9, divisible by 64)
  const width  = orientation === 'portrait' ? 512 : 768;
  const height = orientation === 'portrait' ? 896 : 432;

  // Fal.ai preferred (faster, synchronous), Replicate as fallback
  if (FAL_KEY) {
    try {
      const url = await generateWithFal(prompt, width, height);
      return Response.json({ url });
    } catch (err) {
      if (!REPLICATE_TOKEN) {
        return Response.json({ error: err.message }, { status: 502 });
      }
      // fall through to Replicate
    }
  }

  try {
    const url = await generateWithReplicate(prompt, width, height);
    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
