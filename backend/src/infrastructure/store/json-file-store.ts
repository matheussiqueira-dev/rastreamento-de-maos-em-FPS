import fs from 'node:fs/promises';
import path from 'node:path';
import { StoreState } from '../../domain/types.js';

const defaultState = (): StoreState => ({
  users: [],
  matches: [],
  calibrations: [],
  metrics: {
    apiRequests: 0,
    authFailures: 0,
    matchesSubmitted: 0,
  },
});

const normalizeStoreState = (raw: unknown): StoreState => {
  const fallback = defaultState();
  if (!raw || typeof raw !== 'object') return fallback;

  const data = raw as Partial<StoreState>;
  return {
    users: Array.isArray(data.users) ? data.users : [],
    matches: Array.isArray(data.matches) ? data.matches : [],
    calibrations: Array.isArray(data.calibrations) ? data.calibrations : [],
    metrics: {
      apiRequests: data.metrics?.apiRequests ?? 0,
      authFailures: data.metrics?.authFailures ?? 0,
      matchesSubmitted: data.metrics?.matchesSubmitted ?? 0,
    },
  };
};

export class JsonFileStore {
  private state: StoreState = defaultState();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.state = normalizeStoreState(JSON.parse(raw));
    } catch {
      this.state = defaultState();
      await this.persist();
    }
  }

  getSnapshot() {
    return structuredClone(this.state);
  }

  async read<T>(selector: (state: StoreState) => T): Promise<T> {
    return selector(this.state);
  }

  async write<T>(mutator: (state: StoreState) => T | Promise<T>): Promise<T> {
    const result = await mutator(this.state);
    this.writeQueue = this.writeQueue.then(() => this.persist());
    await this.writeQueue;
    return result;
  }

  private async persist() {
    const payload = `${JSON.stringify(this.state, null, 2)}\n`;
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, payload, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }
}
