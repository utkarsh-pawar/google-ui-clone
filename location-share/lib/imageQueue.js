// Smart rate-limited queue for AI image generation requests.
// Singleton shared across all generation calls so rate limits are
// respected globally even when multiple videos are queued.

const DEFAULT_CONFIG = {
  concurrency:          1,      // 1 in-flight request at a time
  minDelay:          2000,      // minimum ms between requests
  maxDelay:          4000,      // maximum ms between requests (random jitter)
  burstSize:            5,      // after N requests: burst cooldown
  burstCooldownMin: 20000,      // 20s min burst cooldown
  burstCooldownMax: 30000,      // 30s max burst cooldown
  rateLimitCooldownMin: 60000,  // 60s on HTTP 429
  rateLimitCooldownMax: 120000, // 120s on HTTP 429
  maxRetries:           3,      // exponential backoff: 2s 4s 8s 16s
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export class ImageQueue {
  constructor(config = {}) {
    this._cfg = { ...DEFAULT_CONFIG, ...config };
    this._queue       = [];
    this._running     = 0;
    this._burstCount  = 0;
    this._cooldownUntil = 0;
    this._lastFired   = 0;
    this._listeners   = new Set();
    this._tickScheduled = false;
  }

  // Subscribe to queue-level status events for UI badges / cooldown displays.
  // Returns an unsubscribe function.
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(event) {
    const status = this.status;
    for (const fn of this._listeners) fn({ ...event, status });
  }

  get status() {
    const now = Date.now();
    return {
      pending:           this._queue.length,
      running:           this._running,
      cooldownRemaining: Math.max(0, Math.ceil((this._cooldownUntil - now) / 1000)),
      isCoolingDown:     this._cooldownUntil > now,
    };
  }

  // Add an async job to the queue.
  // onStatus(state, extra) is called with:
  //   'queued'   { position }
  //   'running'
  //   'retry'    { attempt, backoffMs }
  //   'done'
  //   'error'    { message }
  add(fn, onStatus = null) {
    return new Promise((resolve, reject) => {
      const job = { fn, resolve, reject, retries: 0, onStatus };
      onStatus?.('queued', { position: this._queue.length });
      this._queue.push(job);
      this._emit({ type: 'enqueue' });
      this._scheduleTick();
    });
  }

  _scheduleTick() {
    if (this._tickScheduled) return;
    this._tickScheduled = true;
    // Use setTimeout(0) so callers can batch-add before the queue starts draining
    setTimeout(() => { this._tickScheduled = false; this._drain(); }, 0);
  }

  async _drain() {
    while (this._queue.length > 0) {
      if (this._running >= this._cfg.concurrency) return; // another drain call is running

      const now = Date.now();

      // ── Cooldown (burst or rate-limit) ──────────────────────────────────────
      if (this._cooldownUntil > now) {
        const wait = this._cooldownUntil - now;
        this._emit({ type: 'cooldown', seconds: Math.ceil(wait / 1000) });
        await sleep(wait);
        continue;
      }

      // ── Per-request delay ───────────────────────────────────────────────────
      const elapsed = Date.now() - this._lastFired;
      const delay   = this._cfg.minDelay + Math.random() * (this._cfg.maxDelay - this._cfg.minDelay);
      if (this._lastFired > 0 && elapsed < delay) {
        await sleep(delay - elapsed);
        continue;
      }

      const job = this._queue.shift();
      if (!job) break;

      this._running++;
      this._lastFired = Date.now();
      this._burstCount++;

      // ── Burst cooldown trigger ──────────────────────────────────────────────
      if (this._burstCount >= this._cfg.burstSize) {
        this._burstCount = 0;
        const cd = this._cfg.burstCooldownMin +
          Math.random() * (this._cfg.burstCooldownMax - this._cfg.burstCooldownMin);
        this._cooldownUntil = Date.now() + cd;
        this._emit({ type: 'burst-cooldown', seconds: Math.ceil(cd / 1000) });
      }

      job.onStatus?.('running');
      this._emit({ type: 'start' });

      // Fire and forget — _drain continues for next slot
      this._runJob(job).finally(() => {
        this._running--;
        this._emit({ type: 'finish' });
        this._scheduleTick();
      });
    }
  }

  async _runJob(job) {
    for (let attempt = 0; attempt <= this._cfg.maxRetries; attempt++) {
      try {
        const result = await job.fn();
        job.onStatus?.('done');
        job.resolve(result);
        return;
      } catch (err) {
        const is429 = err?.status === 429 ||
          String(err?.message || '').includes('429') ||
          String(err?.message || '').includes('rate') ||
          String(err?.message || '').toLowerCase().includes('too many');

        if (is429) {
          const cd = this._cfg.rateLimitCooldownMin +
            Math.random() * (this._cfg.rateLimitCooldownMax - this._cfg.rateLimitCooldownMin);
          this._cooldownUntil = Date.now() + cd;
          this._emit({ type: 'rate-limit', seconds: Math.ceil(cd / 1000) });
          await sleep(cd); // wait the full cooldown before retrying
          attempt--;       // don't consume a retry slot for rate limits
          continue;
        }

        if (attempt < this._cfg.maxRetries) {
          const backoffMs = 2000 * Math.pow(2, attempt); // 2s 4s 8s 16s
          job.onStatus?.('retry', { attempt: attempt + 1, backoffMs });
          await sleep(backoffMs);
        } else {
          job.onStatus?.('error', { message: err?.message || 'Failed' });
          job.reject(err);
        }
      }
    }
  }
}

// Singleton — one queue for the entire app
let _instance = null;
export function getImageQueue() {
  if (!_instance) _instance = new ImageQueue();
  return _instance;
}
