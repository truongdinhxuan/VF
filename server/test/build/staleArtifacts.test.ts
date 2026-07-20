import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const distRoot = resolve(process.cwd(), 'dist');

const readJavaScriptFiles = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readJavaScriptFiles(path);
    return entry.name.endsWith('.js') ? [readFileSync(path, 'utf8')] : [];
  });
};

describe('clean TypeScript build output', () => {
  it('does not retain removed admin or example routes', () => {
    assert.equal(existsSync(resolve(distRoot, 'routes/admin')), false);
    assert.equal(existsSync(resolve(distRoot, 'routes/example')), false);
    assert.equal(existsSync(resolve(distRoot, 'controllers/admin')), false);
    assert.equal(existsSync(resolve(distRoot, 'controllers/auth/register.js')), false);
  });

  it('does not contain the removed user deletion field', () => {
    const legacyField = ['is', 'deleted'].join('');
    const output = readJavaScriptFiles(distRoot).join('\n');
    assert.equal(output.toLowerCase().includes(legacyField), false);
  });
});
