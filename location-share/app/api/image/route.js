export const maxDuration = 60;

const COLAB_URL = process.env.COLAB_IMAGE_URL;
const HF_TOKEN  = process.env.HF_TOKEN;

const AI_SIZE = {
  portrait:  { w: 768,  h: 1344 },
  landscape: { w: 1344, h: 768  },
};

function aiSize(width, height) {
  return height > width ? AI_SIZE.portrait : AI_SIZE.landscape;
}

async function fetchColab(prompt, width, height) {
  if (!COLAB_URL) throw new Error('No Colab URL');
  const res = await fetch(`${COLAB_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width, height, steps: 6 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Colab ${res.status}`);
  return await res.arrayBuffer();
}

async function fetchHuggingFace(prompt, width, height) {
  if (!HF_TOKEN) throw new Error('No HF_TOKEN');
  const { w, h } = aiSize(width, height);
  const res = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width: w, height: h, num_inference_steps: 4 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HF ${res.status}: ${body.slice(0, 120)}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('image')) throw new Error(`HF non-image: ${ct}`);
  return await res.arrayBuffer();
}

async function fetchPollinations(prompt, width, height, seed) {
  const { w, h } = aiSize(width, height);
  const negative = 'deformed face, distorted eyes, extra limbs, blurry, low quality, watermark, text, logo, ugly, bad anatomy, mutated hands';
  const params = new URLSearchParams({
    width: w, height: h, nologo: 'true', seed,
    model: 'flux', negative_prompt: negative,
    // enhance: removed — our prompts are already detailed; enhance adds 10-15s LLM overhead
  });
  const res = await fetch(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`,
    { signal: AbortSignal.timeout(30000) }
  );
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  return await res.arrayBuffer();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt') || '';
  const width  = parseInt(searchParams.get('width')  || '1280', 10);
  const height = parseInt(searchParams.get('height') || '720',  10);
  const idx    = parseInt(searchParams.get('idx')    || '0',    10);
  const seed   = parseInt(searchParams.get('seed')   || String(Math.floor(Math.random() * 99999)), 10);

  if (!prompt) return new Response('Missing prompt', { status: 400 });

  // Race all sources simultaneously — return whichever responds first
  const racers = [
    COLAB_URL && fetchColab(prompt, width, height),
    HF_TOKEN  && fetchHuggingFace(prompt, width, height),
    fetchPollinations(prompt, width, height, seed + idx),
  ].filter(Boolean);

  try {
    const buffer = await Promise.any(racers);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Image-Source': 'ai',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'All AI image sources failed' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

