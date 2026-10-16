import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestDirectory = path.join(root, 'docs', 'deployment', 'api');
const manifest = JSON.parse(fs.readFileSync(path.join(manifestDirectory, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(manifestDirectory, 'package-lock.json'), 'utf8'));
assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies, 'API 依赖清单与锁定文件不一致');
for (const [name, version] of Object.entries(manifest.dependencies)) {
  assert.equal(lock.packages[`node_modules/${name}`]?.version, version, `API 依赖版本未锁定：${name}`);
}

const outputDirectory = path.join(root, 'output', `api-release-${manifest.version}`);
fs.mkdirSync(outputDirectory, { recursive: true });
const files = [
  [path.join(root, 'server.js'), 'server.js'],
  [path.join(manifestDirectory, 'package.json'), 'package.json'],
  [path.join(manifestDirectory, 'package-lock.json'), 'package-lock.json'],
];
const expectedNames = new Set([...files.map(([, name]) => name), 'release-files.json']);
for (const name of fs.readdirSync(outputDirectory)) {
  assert.ok(expectedNames.has(name), `发布目录包含未审查文件：${name}`);
}
const records = files.map(([source, name]) => {
  const buffer = fs.readFileSync(source);
  fs.writeFileSync(path.join(outputDirectory, name), buffer);
  return { name, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
});
fs.writeFileSync(path.join(outputDirectory, 'release-files.json'), `${JSON.stringify({ version: manifest.version, files: records }, null, 2)}\n`, 'utf8');
console.log(`API 发布目录：${outputDirectory}`);
console.log(JSON.stringify(records, null, 2));
