import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratchRoot = path.join(root, '.scratch');
fs.mkdirSync(scratchRoot, { recursive: true });
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'frontend-api-check-'));
const records = [];
const modes = new Map();
const updateInfo = { version: '0.0.0', url: 'https://example.test/client.exe', notes: '' };
const server = http.createServer(async (request, response) => {
  const parts = [];
  for await (const part of request) parts.push(part);
  records.push({ url: request.url, method: request.method, headers: request.headers,
    body: Buffer.concat(parts).toString('utf8') });
  const mode = modes.get(request.url);
  if (mode === 'connection-closed') {
    request.socket.destroy();
    return;
  }
  if (mode === 'headers-pending') return;
  if (mode === 'write-delayed') await new Promise(resolve => setTimeout(resolve, 8500));
  response.setHeader('Content-Type', 'application/json');
  if (mode === 'invalid-json') {
    response.end('{');
    return;
  }
  if (mode === 'body-pending') {
    response.writeHead(200);
    response.write('[');
    return;
  }
  if (request.url === '/api/auth/check') {
    if (mode === 'auth-denied') {
      response.writeHead(401);
      response.end('{"success":false}');
      return;
    }
    response.end('{"success":true}');
    return;
  }
  if (request.url === '/api/client-update') {
    response.end(mode === 'invalid-update' ? '{}' : JSON.stringify(updateInfo));
    return;
  }
  if (request.method !== 'GET') {
    response.end('{"success":true,"data":null}');
    return;
  }
  response.end('[]');
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input instanceof Request ? input.url : input);
  assert.equal(url.origin, origin, '回归检查只允许访问独立本地服务');
  return originalFetch(input, options);
};
const stored = new Map();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, String(value)),
  removeItem: key => stored.delete(key),
} });
let count = 0;
async function readWithinDeadline(operation) {
  let timer;
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('读取超过 10 秒仍未结束')), 10000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
try {
  const bundle = path.join(scratch, 'api.mjs');
  await build({ entryPoints: [path.join(root, 'src/utils/api.ts')], outfile: bundle,
    bundle: true, platform: 'node', format: 'esm', target: 'node24', logLevel: 'error',
    define: { 'import.meta.env': JSON.stringify({ VITE_API_BASE: `${origin}/api` }) } });
  const { api, setAdminToken } = await import(pathToFileURL(bundle).href);
  const token = crypto.randomBytes(24).toString('hex');
  setAdminToken(token);
  const result = await api.getGames();
  assert.deepEqual(result, { success: true, data: [] }, '公开空列表应按真实接口结构读取');
  const request = records.at(-1);
  assert.equal(request.headers['content-type'], undefined, '公开 GET 不应添加 Content-Type');
  assert.equal(request.headers['x-admin-token'], undefined, '公开 GET 不应携带后台令牌');
  count += 1;
  modes.set('/api/categories', 'connection-closed');
  const disconnected = await api.getCategories();
  modes.set('/api/categories', 'invalid-json');
  const malformed = await api.getCategories();
  modes.delete('/api/categories');
  assert.deepEqual([disconnected, malformed], [
    { success: false, message: '网络连接失败，请检查网络后重试' },
    { success: false, message: '返回数据格式错误，请稍后重试' },
  ], '真实连接中断与非法 JSON 应提供固定中文错误');
  count += 2;
  const readBundle = path.join(scratch, 'read-json.mjs');
  await build({ entryPoints: [path.join(root, 'src/utils/readJson.ts')], outfile: readBundle,
    bundle: true, platform: 'node', format: 'esm', target: 'node24', logLevel: 'error' });
  const { readJson } = await import(pathToFileURL(readBundle).href);
  modes.set('/api/categories', 'headers-pending');
  const requestSeen = new Promise(resolve => server.once('request', resolve));
  const controller = new AbortController();
  const cancelled = readJson(`${origin}/api/categories`, { signal: controller.signal });
  await readWithinDeadline(requestSeen);
  controller.abort();
  await assert.rejects(readWithinDeadline(cancelled), { name: 'AbortError', message: '请求已取消' }, '调用方取消真实读取时保留取消语义与中文提示');
  modes.delete('/api/categories');
  count += 1;
  modes.set('/api/client-update', 'body-pending');
  const attempts = await readWithinDeadline(Promise.allSettled([api.getClientUpdate(), api.getClientUpdate()]));
  assert.equal(records.filter(record => record.url === '/api/client-update').length, 1, '并发读取更新清单应复用本次请求');
  assert.ok(attempts.every(result => result.status === 'rejected' && result.reason.message === '请求超时，请重试'), '清单正文等待必须向全部调用方报告中文超时');
  count += 1;
  modes.delete('/api/client-update');
  assert.deepEqual(await api.getClientUpdate(), updateInfo, '超时后必须释放清单请求，允许重新读取');
  assert.deepEqual(await api.getClientUpdate(), updateInfo, '成功清单可以重复使用');
  assert.equal(records.filter(record => record.url === '/api/client-update').length, 2, '成功后不重复请求相同清单');
  count += 1;
  modes.set('/api/categories', 'headers-pending');
  const started = performance.now();
  const timedOut = await readWithinDeadline(api.getCategories());
  assert.deepEqual(timedOut, { success: false, message: '请求超时，请重试' }, '响应头等待必须返回中文超时信息');
  assert.ok(performance.now() - started >= 7500, '普通读取应保留约 8 秒的响应窗口');
  count += 1;
  modes.set('/api/categories', 'body-pending');
  const bodyTimedOut = await readWithinDeadline(api.getCategories());
  assert.deepEqual(bodyTimedOut, { success: false, message: '请求超时，请重试' }, '收到响应头后正文等待仍受读取期限约束');
  count += 1;
  modes.delete('/api/categories');
  assert.deepEqual(await api.getCategories(), { success: true, data: [] }, '超时后可重新读取真实接口');
  count += 1;
  assert.equal(await api.checkAuth(token), true, '登录校验读取真实响应');
  modes.set('/api/auth/check', 'headers-pending');
  await assert.rejects(readWithinDeadline(api.checkAuth(token)), { message: '请求超时，请重试' }, '登录校验必须按时抛出中文网络错误');
  count += 1;
  modes.set('/api/auth/check', 'body-pending');
  await assert.rejects(readWithinDeadline(api.checkAuth(token)), { message: '请求超时，请重试' }, '登录响应正文也受读取期限约束');
  modes.set('/api/auth/check', 'auth-denied');
  assert.equal(await api.checkAuth(token), false, '登录凭证被拒绝时仍返回校验失败');
  modes.delete('/api/auth/check');
  count += 1;
  for (const operation of [() => api.getGames(), () => api.getGame(1), () => api.getGamesByCategory(''),
    () => api.searchGames(''), () => api.getHeroBanners(), () => api.getAnnouncements(), () => api.getCategories()]) {
    assert.equal((await operation()).success, true);
    const current = records.at(-1);
    assert.equal(current.headers['content-type'], undefined, '公开读取不增加 JSON 预检头');
    assert.equal(current.headers['x-admin-token'], undefined, '公开读取不携带已登录后台令牌');
  }
  count += 1;
  for (const operation of [() => api.getGames(true), () => api.getHeroBanners(true),
    () => api.getAnnouncements(true), () => api.getLauncherReleases(1)]) {
    assert.equal((await operation()).success, true);
    const current = records.at(-1);
    assert.equal(current.headers['content-type'], undefined, '后台 GET 无正文时不设置 JSON Content-Type');
    assert.ok(current.headers['x-admin-token'] === token, '后台读取必须保留鉴权');
  }
  count += 1;
  assert.equal((await api.updateAnnouncement(1, {})).success, true);
  const written = records.at(-1);
  assert.equal(written.method, 'PUT', '更新请求仍使用原 HTTP 方法');
  assert.equal(written.headers['content-type'], 'application/json', 'JSON 写入声明正文类型');
  assert.ok(written.headers['x-admin-token'] === token, 'JSON 写入保留鉴权');
  assert.equal(written.body, '{}', 'JSON 写入保留原正文');
  count += 1;
  modes.set('/api/launcher-package-inspect', 'write-delayed');
  const inspectInput = { packageUrl: 'https://example.test/package.zip', packageFormat: 'zip', launcherRelativePath: 'Login/Launcher.exe' };
  const inspectStarted = performance.now();
  assert.equal((await readWithinDeadline(api.inspectLauncherPackage(inspectInput))).success, true, '包检查可以超过普通读取期限');
  assert.ok(performance.now() - inspectStarted >= 8250, '真实 HTTP 包检查已等待超过 8 秒');
  const inspected = records.at(-1);
  assert.equal(inspected.method, 'POST');
  assert.ok(inspected.headers['x-admin-token'] === token, '包检查保留鉴权');
  assert.deepEqual(JSON.parse(inspected.body), inspectInput, '包检查保留 JSON 正文');
  count += 1;
  const { api: freshApi } = await import(`${pathToFileURL(bundle).href}?new-session`);
  modes.set('/api/client-update', 'invalid-update');
  await assert.rejects(freshApi.getClientUpdate(), { message: '客户端下载信息格式无效' }, '无效清单不能伪装成成功数据');
  modes.delete('/api/client-update');
  assert.deepEqual(await freshApi.getClientUpdate(), updateInfo, '无效清单失败后可以重新读取');
  count += 1;
  console.log(`通过 ${count} 项前端请求真实 HTTP 检查。`);
} finally {
  globalThis.fetch = originalFetch;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  const resolvedScratch = path.resolve(scratch);
  assert.ok(resolvedScratch.startsWith(`${path.resolve(scratchRoot)}${path.sep}`), '清理目录必须位于项目 .scratch');
  fs.rmSync(resolvedScratch, { recursive: true });
}
