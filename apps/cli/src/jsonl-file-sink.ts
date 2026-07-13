import * as fs from 'node:fs';
import * as path from 'node:path';

export interface JsonlFileSink {
  write: (line: string) => void;
  filePath: string;
}

export function createJsonlFileSink(logsDir: string): JsonlFileSink {
  fs.mkdirSync(logsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(logsDir, `${timestamp}.jsonl`);
  fs.writeFileSync(filePath, '');

  return {
    filePath,
    write: (line: string) => {
      fs.appendFileSync(filePath, `${line}\n`);
    },
  };
}
