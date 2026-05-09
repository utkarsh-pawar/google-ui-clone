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

// ── AI sources only — no stock fallbacks ─────────────────────────────────────

async function fetchColab(prompt, width, height) {
  if (!COLAB_URL) throw new Error('No Colab URL');
  const res = await fetch(`${COLAB_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width, height, steps: 25 }),
    signal: AbortSignal.timeout(55000),
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
      signal: AbortSignal.timeout(60000),
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
  // flux model: far better face anatomy and deity detail than default SDXL
  const negative = 'deformed face, distorted eyes, extra limbs, blurry, low quality, watermark, text, logo, ugly, bad anatomy, mutated hands';
  const params = new URLSearchParams({
    width: w, height: h, nologo: 'true', seed, enhance: 'true',
    model: 'flux', negative_prompt: negative,
  });
  const res = await fetch(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`,
    { signal: AbortSignal.timeout(55000) }
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

  const sources = [
    () => fetchColab(prompt, width, height),
    () => fetchHuggingFace(prompt, width, height),
    () => fetchPollinations(prompt, width, height, seed + idx),
  ];

  for (const source of sources) {
    try {
      const buffer = await source();
      return new Response(buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-Image-Source': 'ai',
        },
      });
    } catch {
      // try next source
    }
  }

  // All AI sources failed — return error so client can show retry button
  return new Response(JSON.stringify({ error: 'All AI image sources failed' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}
