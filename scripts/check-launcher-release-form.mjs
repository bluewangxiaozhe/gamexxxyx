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
const legacyBanner = { title: '保留的历史 Banner', subtitle: '历史副标题', desc: '历史描述',
  image: 'https://example.test/legacy-banner.jpg', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50' };
const existingScreenshots = ['https://example.test/retained-screenshot.jpg'];
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
    installDirectoryName: 'form-check', launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable',
    banner: legacyBanner, imageUrl: 'https://example.test/retained-cover.jpg', screenshots: existingScreenshots });
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
  check(await page.getByText('首页 Banner 数据', { exact: true }).count(), 0, '编辑游戏表单不显示首页 Banner 数据区块');
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
  check(await page.getByText('封面图片', { exact: true }).count(), 1, '编辑游戏保留封面图片控件');
  const originalGameSaved = page.waitForResponse(response => response.url() === `${apiBase}/games/${game.id}`
    && response.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  const originalGameResponse = await originalGameSaved;
  check(originalGameResponse.status(), 200, '普通游戏资料保存成功');
  check(Object.hasOwn(originalGameResponse.request().postDataJSON(), 'banner'), false, '普通游戏资料保存不提交首页 Banner 字段');
  const retainedGame = await api(`/games/${game.id}`);
  check(retainedGame.banner, legacyBanner, '普通游戏资料保存保留原有 Banner 元数据');
  check(retainedGame.imageUrl, 'https://example.test/retained-cover.jpg', '普通游戏资料保存保留原有封面');
  check(retainedGame.screenshots, existingScreenshots, '普通游戏资料保存保留原有截图');

  const firstPublishGame = await api('/games', 'POST', { name: '首次发布清单同步回归游戏',
    downloadUrl: 'https://example.test/game.zip', installDirectoryName: 'first-publish-form',
    launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable' });
  check(firstPublishGame.launcherManifestUrl, '', '未发布版本的新游戏保持空清单地址');
  await page.reload();
  await page.getByRole('row').filter({ hasText: firstPublishGame.name }).locator('button').first().click();
  const manifestUrl = page.getByText('登录器清单 HTTPS 地址', { exact: true }).locator('..').locator('input');
  const gameName = page.locator('label').filter({ hasText: '游戏名称' }).locator('..').locator('input');
  const description = page.getByPlaceholder('简短描述游戏特色...');
  check(await manifestUrl.inputValue(), '', '新游戏外层表单清单地址为空');
  await gameName.fill('尚未保存的展示名称');
  await description.fill('尚未保存的游戏描述');
  await section.getByText('版本号', { exact: true }).locator('..').locator('input').fill('1.0.0');
  await url.fill('https://example.test/first-launcher.zip');
  await entry.fill('Login/Launcher.exe');
  const firstPublishRequested = new Promise(resolve => { inspectRequested = resolve; });
  await section.getByRole('button', { name: '计算校验值', exact: true }).click();
  await firstPublishRequested;
  releaseInspect();
  await page.waitForFunction(value => [...document.querySelectorAll('input')].some(input => input.readOnly && input.value === value), newHash);
  await section.getByRole('button', { name: '创建版本', exact: true }).click();
  await page.getByText('登录器版本已保存并发布', { exact: true }).waitFor();
  const generatedUrl = `https://example.test/api/games/${firstPublishGame.id}/launcher-manifest`;
  check((await api(`/games/${firstPublishGame.id}`)).launcherManifestUrl, generatedUrl, '首次发布后服务器生成内置清单地址');
  check(await manifestUrl.inputValue(), generatedUrl, '首次发布后外层表单同步服务器生成的清单地址');
  check(await gameName.inputValue(), '尚未保存的展示名称', '同步清单地址保留未保存的游戏名称');
  check(await description.inputValue(), '尚未保存的游戏描述', '同步清单地址保留未保存的游戏描述');
  const gameSaved = page.waitForResponse(response => response.url() === `${apiBase}/games/${firstPublishGame.id}`
    && response.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  check((await gameSaved).status(), 200, '发布后保存外层游戏表单成功');
  check((await api(`/games/${firstPublishGame.id}`)).launcherManifestUrl, generatedUrl, '保存游戏不会清空首次发布生成的清单地址');

  const customManifestGame = await api('/games', 'POST', { name: '手填清单保留回归游戏',
    downloadUrl: 'https://example.test/game.zip', installDirectoryName: 'custom-manifest-form',
    launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable' });
  const draft = await api(`/games/${customManifestGame.id}/launcher-releases`, 'POST', {
    version: '1.0.0', packageUrl: 'https://example.test/draft-launcher.zip', packageFormat: 'zip',
    size: 128, sha256: oldHash, launcherSha256: oldHash,
    launcherRelativePath: 'Login/Launcher.exe', published: false,
  });
  check((await api(`/games/${customManifestGame.id}`)).launcherManifestUrl, '', '保存草稿不会生成清单地址');
  await page.reload();
  await page.getByRole('row').filter({ hasText: customManifestGame.name }).locator('button').first().click();
  const customManifestUrl = 'https://example.test/custom/launcher-manifest.json';
  await manifestUrl.fill(customManifestUrl);
  await gameName.fill('尚未保存的自定义名称');
  await description.fill('尚未保存的自定义描述');
  await section.getByRole('button', { name: '编辑', exact: true }).click();
  await section.getByRole('checkbox', { name: '立即发布', exact: true }).check();
  await section.getByRole('button', { name: '保存版本', exact: true }).click();
  await page.getByText('登录器版本已保存并发布', { exact: true }).waitFor();
  check((await api(`/games/${customManifestGame.id}/launcher-releases`)).find(item => item.id === draft.id).published,
    true, '浏览器将草稿版本发布到本地真实 API');
  check((await api(`/games/${customManifestGame.id}`)).launcherManifestUrl,
    `https://example.test/api/games/${customManifestGame.id}/launcher-manifest`, '草稿首次发布后服务器生成内置地址');
  check(await manifestUrl.inputValue(), customManifestUrl, '发布后保留用户已填写但尚未保存的清单地址');
  check(await gameName.inputValue(), '尚未保存的自定义名称', '保留清单地址时不改写未保存的名称');
  check(await description.inputValue(), '尚未保存的自定义描述', '保留清单地址时不改写未保存的描述');
  const customGameSaved = page.waitForResponse(response => response.url() === `${apiBase}/games/${customManifestGame.id}`
    && response.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  check((await customGameSaved).status(), 200, '发布草稿后可以保存外层自定义地址');
  check((await api(`/games/${customManifestGame.id}`)).launcherManifestUrl, customManifestUrl,
    '保存游戏后服务器保留用户自定义清单地址');

  const inactiveGame = await api('/games', 'POST', { name: '未上架游戏清单同步回归游戏',
    downloadUrl: 'https://example.test/game.zip', installDirectoryName: 'inactive-manifest-form',
    launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable', status: 'inactive' });
  check(inactiveGame.launcherManifestUrl, '', '未上架新游戏未发布时保持空清单地址');
  check((await fetch(`${apiBase}/games/${inactiveGame.id}`)).status, 404, '未上架游戏公开详情接口返回 404');
  await page.reload();
  await page.getByRole('row').filter({ hasText: inactiveGame.name }).locator('button').first().click();
  await section.getByText('版本号', { exact: true }).locator('..').locator('input').fill('1.0.0');
  await url.fill('https://example.test/inactive-launcher.zip');
  await entry.fill('Login/Launcher.exe');
  const inactiveInspectRequested = new Promise(resolve => { inspectRequested = resolve; });
  await section.getByRole('button', { name: '计算校验值', exact: true }).click();
  await inactiveInspectRequested;
  releaseInspect();
  await page.waitForFunction(value => [...document.querySelectorAll('input')].some(input => input.readOnly && input.value === value), newHash);
  await section.getByRole('button', { name: '创建版本', exact: true }).click();
  await page.getByText('登录器版本已保存并发布', { exact: true }).waitFor();
  const inactiveGeneratedUrl = `https://example.test/api/games/${inactiveGame.id}/launcher-manifest`;
  check((await api('/games?includeInactive=true')).find(item => item.id === inactiveGame.id).launcherManifestUrl,
    inactiveGeneratedUrl, '未上架游戏发布后可从后台目录读取服务器清单地址');
  check(await manifestUrl.inputValue(), inactiveGeneratedUrl, '未上架游戏首次发布后外层表单同步清单地址');
  await page.locator('label').filter({ hasText: /^状态$/ }).locator('..').locator('select').selectOption('active');
  const activatedGameSaved = page.waitForResponse(response => response.url() === `${apiBase}/games/${inactiveGame.id}`
    && response.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  check((await activatedGameSaved).status(), 200, '发布版本后激活并保存游戏成功');
  const activatedGame = await api(`/games/${inactiveGame.id}`);
  check(activatedGame.status, 'active', '游戏保存后已经上架');
  check(activatedGame.launcherManifestUrl, inactiveGeneratedUrl, '激活并保存游戏后保留首次发布清单地址');

  await page.reload();
  await page.getByRole('button', { name: 'Banner管理', exact: true }).click();
  check(await page.getByRole('heading', { name: '首页 Banner 管理', exact: true }).isVisible(), true, '独立 Banner 管理仍可访问');
  await page.getByRole('button', { name: '返回游戏', exact: true }).click();
  await page.getByRole('button', { name: '添加游戏', exact: true }).click();
  check(await page.getByText('首页 Banner 数据', { exact: true }).count(), 0, '新增游戏表单不显示首页 Banner 数据区块');
  check(await page.getByText('封面图片', { exact: true }).count(), 1, '新增游戏保留封面图片控件');
  check(await manifestUrl.inputValue(), '', '新增游戏默认不填写登录器清单地址');
  check(await page.getByText('登录器更新策略', { exact: true }).locator('..').locator('select').inputValue(), '', '新增游戏默认不启用登录器更新策略');
  await page.locator('label').filter({ hasText: /^游戏文件/ }).locator('..').locator('input[type=file]')
    .setInputFiles({ name: 'new-game.zip', mimeType: 'application/zip', buffer: Buffer.from('新增游戏上传边界回归数据') });
  await page.getByText('文件已上传', { exact: true }).waitFor();
  await gameName.fill('新增表单精简回归游戏');
  await page.getByPlaceholder('例如：wugengji-new').fill('new-form-defaults');
  await page.locator('label').filter({ hasText: /^登录器入口相对路径/ }).locator('..').locator('input').fill('Login/Launcher.exe');
  const newGameSaved = page.waitForResponse(response => response.url() === `${apiBase}/games`
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: '添加游戏', exact: true }).click();
  const newGameResponse = await newGameSaved;
  check(newGameResponse.status(), 201, '精简后的新增游戏表单通过真实 API 保存');
  check(Object.hasOwn(newGameResponse.request().postDataJSON(), 'banner'), false, '新增游戏不提交首页 Banner 字段');
  const newGame = await newGameResponse.json();
  check(newGame.banner, null, '新增游戏使用 API 默认的空 Banner 数据');
  check(newGame.launcherManifestUrl, '', '新增游戏保存后清单地址保持为空');
  check(newGame.launcherUpdatePolicy, '', '新增游戏保存后更新策略保持未指定');
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
    const evidence = path.join(root, 'docs', 'acceptance', 'launcher-manifest-form-20261017');
    fs.mkdirSync(evidence, { recursive: true });
    fs.writeFileSync(path.join(evidence, `failed-checks-${path.basename(scratch)}.json`), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    console.error(`失败现场：${scratch}`);
  }
}
