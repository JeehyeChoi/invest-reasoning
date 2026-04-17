type QueueJob = {
  key: string;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TwelveDataRequestQueue {
  private queue: QueueJob[] = [];
  private running = false;
  private sentTimestamps: number[] = [];

  private readonly requestsPerMinute: number;
  private readonly windowMs: number;

  constructor(options?: { requestsPerMinute?: number }) {
    this.requestsPerMinute = options?.requestsPerMinute ?? 8;
    this.windowMs = 60_000;
  }

  async enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        key,
        run: async () => run(),
        resolve: (value) => resolve(value as T),
        reject,
      });

      void this.process();
    });
  }

  private prune(now: number): void {
    while (
      this.sentTimestamps.length > 0 &&
      now - this.sentTimestamps[0] >= this.windowMs
    ) {
      this.sentTimestamps.shift();
    }
  }

  private getAvailableSlots(now: number): number {
    this.prune(now);
    return Math.max(0, this.requestsPerMinute - this.sentTimestamps.length);
  }

  private getWaitMs(now: number): number {
    this.prune(now);

    if (this.sentTimestamps.length < this.requestsPerMinute) {
      return 0;
    }

    const oldest = this.sentTimestamps[0];
    return Math.max(0, this.windowMs - (now - oldest));
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      while (this.queue.length > 0) {
        const now = Date.now();
        const available = this.getAvailableSlots(now);

        if (available <= 0) {
          const waitMs = this.getWaitMs(now);
          await sleep(waitMs);
          continue;
        }

        const batch = this.queue.splice(0, available);
        const executedAt = Date.now();

        const results = await Promise.allSettled(
          batch.map((job) => job.run())
        );

        for (let i = 0; i < batch.length; i += 1) {
          this.sentTimestamps.push(executedAt);
        }

        for (let i = 0; i < batch.length; i += 1) {
          const job = batch[i];
          const result = results[i];

          if (result.status === "fulfilled") {
            job.resolve(result.value);
          } else {
            job.reject(result.reason);
          }
        }
      }
    } finally {
      this.running = false;

      if (this.queue.length > 0) {
        void this.process();
      }
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __twelveDataRequestQueue__: TwelveDataRequestQueue | undefined;
}

export function getTwelveDataRequestQueue(): TwelveDataRequestQueue {
  if (!globalThis.__twelveDataRequestQueue__) {
    globalThis.__twelveDataRequestQueue__ = new TwelveDataRequestQueue({
      requestsPerMinute: 8,
    });
  }

  return globalThis.__twelveDataRequestQueue__;
}
