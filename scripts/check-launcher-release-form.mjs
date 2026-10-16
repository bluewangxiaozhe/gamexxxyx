import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

assert.ok(process.argv[2] && process.argv[3], '参数：Playwright 模块绝对路径、Chrome EXE 绝对路径');
const { chromium } = createRequire(import.meta.url)(path.resolve(process.argv[2]));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratchRoot = path.join(root, '.scratch');
fs.mkdirSync(scratchRoot, { recursive: true });
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'launcher-form-'));
const token = crypto.randomBytes(32).toString('hex');
const oldHash = crypto.createHash('sha256').update('已发布入口').digest('hex');
const newHash = crypto.createHash('sha256').update('新版入口').digest('hex');
async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}
const apiPort = await freePort();
const webPort = await freePort();
const apiBase = `http://127.0.0.1:${apiPort}/api`;
const child = spawn(process.execPath, [path.join(root, 'server.js')], {
  cwd: scratch, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(apiPort), DB_PATH: path.join(scratch, 'app.db'),
    ADMIN_TOKEN: token, CORS_ORIGIN: '', PUBLIC_API_BASE: 'https://example.test/api' },
});
let output = '';
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });
const exited = new Promise(resolve => child.once('exit', resolve));
let vite;
let browser;
let success = false;
let count = 0;
const records = [];
async function api(endpoint, method = 'GET', body) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    method, headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  assert.ok(response.ok, `本地 API 返回 ${response.status}：${endpoint}`);
  return response.json();
}
function check(actual, expected, message) {
  records.push({ message, actual, expected });
  assert.deepEqual(actual, expected, message);
  count += 1;
}

try {
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`本地 API 提前退出：${output}`);
    try { await api('/health'); break; } catch (error) {
      if (Date.now() > deadline) throw new Error(`本地 API 无法启动：${output}`, { cause: error });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  const game = await api('/games', 'POST', { name: '登录器表单回归游戏', downloadUrl: 'https://example.test/game.zip',
    installDirectoryName: 'form-check', launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable' });
  const release = await api(`/games/${game.id}/launcher-releases`, 'POST', {
    version: '1.0.0', packageUrl: 'https://example.test/launcher.zip', packageFormat: 'zip',
    size: 128, sha256: oldHash, launcherSha256: oldHash,
    launcherRelativePath: 'Login/Launcher.exe', published: true,
  });
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  vite = await createServer({ root, configFile: path.join(root, 'vite.config.ts'), envDir: scratch,
    define: { 'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase) },
    cacheDir: path.join(scratch, 'vite-cache'), server: { host: '127.0.0.1', port: webPort, strictPort: true },
    logLevel: 'error' });
  await vite.listen();
  browser = await chromium.launchPersistentContext(path.join(scratch, 'browser'), {
    executablePath: path.resolve(process.argv[3]), headless: true,
    downloadsPath: path.join(scratch, 'downloads'), viewport: { width: 1440, height: 1100 },
  });
  await browser.addInitScript(value => sessionStorage.setItem('admin_token', value), token);
  const page = await browser.newPage();
  let inspectRequested;
  let releaseInspect;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'api.567zm.com' && url.pathname === '/api/upload/game') {
      await route.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-admin-token', 'access-control-allow-methods': 'POST,OPTIONS' }, body: JSON.stringify({
        success: true, data: { url: 'https://example.test/new.zip', filename: 'new.zip', size: 256, sha256: newHash },
      }) });
      return;
    }
    if (url.hostname === '127.0.0.1' && url.pathname === '/api/launcher-package-inspect') {
      inspectRequested?.();
      await new Promise(resolve => { releaseInspect = resolve; });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, data: { size: 256, sha256: newHash, launcherSha256: newHash },
      }) });
      return;
    }
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:') await route.continue();
    else await route.abort();
  });
  await page.goto(`http://127.0.0.1:${webPort}/#/admin`);
  await page.getByRole('row').filter({ hasText: '登录器表单回归游戏' }).locator('button').first().click();
  const section = page.getByText('登录器版本发布', { exact: true }).locator('xpath=../../..');
  const entry = section.getByText('登录器入口相对路径', { exact: true }).locator('..').locator('input');
  const url = section.getByPlaceholder('也可以直接填写 HTTPS 安装包地址');
  const entryHash = section.getByText('入口 EXE SHA-256', { exact: true }).locator('..').locator('input');
  const packageHash = section.getByText('SHA-256', { exact: true }).locator('..').locator('input');
  const size = section.getByText('安装包大小（字节）', { exact: true }).locator('..').locator('input');
  async function edit() {
    await section.getByRole('button', { name: '编辑', exact: true }).click();
    await entryHash.waitFor();
    check(await entryHash.inputValue(), oldHash, '已保存版本加载原始入口哈希');
  }
  async function assertNotSaved(message) {
    await section.getByRole('button', { name: '保存版本', exact: true }).click();
    await page.waitForTimeout(100);
    const current = (await api(`/games/${game.id}/launcher-releases`)).find(item => item.id === release.id);
    check(current.launcherRelativePath, 'Login/Launcher.exe', message);
    check(current.packageUrl, 'https://example.test/launcher.zip', '未重新校验不得改变已发布包地址');
  }
  await edit();
  await entry.fill('Login/NewLauncher.exe');
  check(await entryHash.inputValue(), '', '入口变化必须清除旧入口哈希');
  check(await packageHash.inputValue(), oldHash, '入口变化保留相同包的包哈希');
  await assertNotSaved('入口变化后未经重新校验不得保存');

  await edit();
  await url.fill('https://example.test/another.zip');
  check(await entryHash.inputValue(), '', 'URL 变化必须清除入口哈希');
  check(await packageHash.inputValue(), '', 'URL 变化必须清除包哈希');
  check(await size.inputValue(), '', 'URL 变化必须清除包大小');
  await assertNotSaved('URL 变化后未经重新校验不得保存');

  await edit();
  await section.getByText('安装包格式', { exact: true }).locator('..').locator('select').selectOption('exe');
  check(await entryHash.inputValue(), '', '包格式变化必须清除入口哈希');
  await assertNotSaved('包格式变化后未经重新校验不得保存');

  await edit();
  await section.getByRole('button', { name: '移除', exact: true }).click();
  await section.locator('input[type=file]').setInputFiles({ name: 'new.zip', mimeType: 'application/zip', buffer: Buffer.from('上传边界回归数据') });
  await page.waitForFunction(() => document.querySelector('input[placeholder="也可以直接填写 HTTPS 安装包地址"]')?.value === 'https://example.test/new.zip');
  check(await entryHash.inputValue(), '', '上传新包不得继承旧入口哈希');
  check(await packageHash.inputValue(), newHash, '上传响应保留新包的真实包哈希');
  await assertNotSaved('上传新包未经入口校验不得保存');

  await edit();
  const requested = new Promise(resolve => { inspectRequested = resolve; });
  await section.getByRole('button', { name: '计算校验值', exact: true }).click();
  await requested;
  await entry.fill('Login/ChangedDuringInspect.exe');
  releaseInspect();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '计算校验值' && !button.disabled));
  check(await entryHash.inputValue(), '', '过期校验响应不得填入已变化的入口');
  await assertNotSaved('过期校验响应不得允许发布新配置');

  await edit();
  const validRequested = new Promise(resolve => { inspectRequested = resolve; });
  await section.getByRole('button', { name: '计算校验值', exact: true }).click();
  await validRequested;
  releaseInspect();
  await page.waitForFunction(value => [...document.querySelectorAll('input')].some(input => input.readOnly && input.value === value), newHash);
  check(await entryHash.inputValue(), newHash, '配置未变时接受当前校验响应');
  await section.getByRole('button', { name: '保存版本', exact: true }).click();
  await page.getByText('登录器版本已保存并发布', { exact: true }).waitFor();
  check((await api(`/games/${game.id}/launcher-releases`))[0].launcherSha256, newHash, '重新校验后可以保存当前哈希');
  success = true;
  console.log(`通过 ${count} 项真实浏览器表单回归检查。上传和计算接口使用受控边界响应，保存与读取使用本地真实 API/SQLite，未访问生产。`);
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (child.exitCode === null) child.kill();
  await exited;
  if (success) {
    assert.ok(path.resolve(scratch).startsWith(`${path.resolve(scratchRoot)}${path.sep}`), '清理目录必须位于项目 .scratch');
    fs.rmSync(scratch, { recursive: true });
  } else {
    fs.writeFileSync(path.join(scratch, 'checks.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    console.error(`失败现场：${scratch}`);
  }
}
