import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const writeJsonFile = (filePath: string, value: unknown): void => {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
};
