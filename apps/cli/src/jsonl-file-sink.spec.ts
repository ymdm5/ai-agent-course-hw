import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createJsonlFileSink } from './jsonl-file-sink.js';

const tempDirs: string[] = [];

function makeTempLogsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledgerbase-logs-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('createJsonlFileSink', () => {
  it('creates a .jsonl file under the given logs directory', () => {
    const logsDir = makeTempLogsDir();

    const sink = createJsonlFileSink(logsDir);

    expect(sink.filePath.startsWith(logsDir)).toBe(true);
    expect(sink.filePath.endsWith('.jsonl')).toBe(true);
    expect(fs.existsSync(sink.filePath)).toBe(true);
  });

  it('appends one line per write call, each terminated by a newline', () => {
    const logsDir = makeTempLogsDir();
    const sink = createJsonlFileSink(logsDir);

    sink.write('{"a":1}');
    sink.write('{"b":2}');

    const content = fs.readFileSync(sink.filePath, 'utf8');
    expect(content).toBe('{"a":1}\n{"b":2}\n');
  });

  it('creates the logs directory if it does not already exist', () => {
    const parent = makeTempLogsDir();
    const nested = path.join(parent, 'nested', 'logs');

    const sink = createJsonlFileSink(nested);
    sink.write('{"ok":true}');

    expect(fs.existsSync(sink.filePath)).toBe(true);
  });
});
