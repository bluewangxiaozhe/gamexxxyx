import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDirectory = process.argv[2] ? path.resolve(process.argv[2]) : root;
assert.ok(fs.existsSync(path.join(serverDirectory, 'server.js')), '待验收目录必须包含 server.js');
const scratchRoot = path.join(root, '.scratch');
fs.mkdirSync(scratchRoot, { recursive: true });
const scratch = fs.mkdtempSync(path.join(scratchRoot, 'launcher-api-check-'));
const databasePath = path.join(scratch, 'app.db');
const database = new Database(databasePath);
database.exec(`
  CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    description TEXT DEFAULT '', category TEXT DEFAULT '', version TEXT DEFAULT '',
    size TEXT DEFAULT '', downloadUrl TEXT DEFAULT '', guideUrl TEXT DEFAULT '',
    dropRateUrl TEXT DEFAULT '', imageUrl TEXT DEFAULT '', openTime TEXT DEFAULT '',
    heat INTEGER DEFAULT 0, banner TEXT DEFAULT '', rating REAL DEFAULT 0,
    downloads INTEGER DEFAULT 0, status TEXT DEFAULT 'active', tags TEXT DEFAULT '[]',
    screenshots TEXT DEFAULT '[]', createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO games (name, downloadUrl) VALUES ('历史游戏', 'https://example.test/old.zip');
`);
database.close();
const contentHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'server.js'))).digest('hex');
fs.writeFileSync(path.join(scratch, 'client-update.json'), JSON.stringify({
  version: '1.3.0', url: 'https://example.test/XxxyxSetup-1.3.0.exe', sha256: contentHash,
  notes: '本地接口回归', mandatory: false,
}), 'utf8');

const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const assignedPort = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(assignedPort));
  });
});
const token = crypto.randomBytes(32).toString('hex');
const environment = { ...process.env, PORT: String(port), DB_PATH: databasePath,
  ADMIN_TOKEN: token, PUBLIC_API_BASE: 'https://example.test/api', CORS_ORIGIN: '',
  CLIENT_UPDATE_MANIFEST_PATH: path.join(scratch, 'client-update.json') };
for (const key of Object.keys(environment)) {
  if (key.startsWith('R2_') || key.startsWith('DOTENV_CONFIG_')) delete environment[key];
}
const child = spawn(process.execPath, [path.join(serverDirectory, 'server.js')], {
  cwd: scratch, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
child.stdout.on('data', data => { serverOutput += data.toString(); });
child.stderr.on('data', data => { serverOutput += data.toString(); });
const exited = new Promise(resolve => child.once('exit', resolve));
const base = `http://127.0.0.1:${port}/api`;
let checkCount = 0;
let success = false;
async function request(endpoint, method = 'GET', payload, authenticated = true) {
  const response = await fetch(`${base}${endpoint}`, {
    method, headers: { 'content-type': 'application/json', ...(authenticated ? { 'x-admin-token': token } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checkCount += 1;
}

try {
  const deadline = Date.now() + 15000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`API 提前退出：${serverOutput}`);
    try {
      if ((await request('/health')).status === 200) break;
    } catch (error) {
      if (Date.now() >= deadline) throw new Error(`API 未能启动：${serverOutput}`, { cause: error });
    }
    if (Date.now() >= deadline) throw new Error(`API 未能就绪：${serverOutput}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const migrated = await request('/games/1');
  check(migrated.body.name, '历史游戏', '迁移必须保留历史名称');
  check(migrated.body.downloadUrl, 'https://example.test/old.zip', '迁移必须保留历史下载地址');
  check(migrated.body.installDirectoryName, '', '迁移不得自动改写历史安装目录');
  check((await request('/auth/check', 'GET', undefined, false)).status, 401, '未授权请求必须被拒绝');
  check((await request('/games', 'POST', { name: '缺少目录' })).status, 400, '新游戏缺少目录必须被拒绝');
  const legacyBanner = { title: '历史游戏 Banner', subtitle: '保留原记录', desc: '普通资料保存不得清除',
    image: 'https://example.test/legacy-banner.png', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50' };
  const game = { name: '网页展示名称', installDirectoryName: 'stable-client-dir',
    launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable',
    launcherUpdatePolicy: 'automatic', downloadUrl: 'https://example.test/game.zip', status: 'active', banner: legacyBanner };
  for (const invalidName of ['../escape', 'C:escape', '\\\\server\\share', '.', '..']) {
    check((await request('/games', 'POST', { ...game, installDirectoryName: invalidName })).status, 400, '非法安装目录必须被拒绝');
  }
  check((await request('/games', 'POST', { ...game, launcherRelativePath: '../Launcher.exe' })).status, 400, '非法入口路径必须被拒绝');
  const invalidLaunchers = ['Login/Launcher.txt', 'Login/Bad:name.exe', 'Login/Bad?.exe',
    'Login/<bad>.exe', 'Login/Bad|name.exe', 'Login/"bad".exe', 'Login/Bad*.exe'];
  for (const launcherRelativePath of invalidLaunchers) {
    check((await request('/games', 'POST', { ...game, launcherRelativePath })).status, 400,
      `创建游戏必须拒绝无效入口 ${launcherRelativePath}`);
  }
  const upperCaseEntry = await request('/games', 'POST', { ...game, installDirectoryName: 'uppercase-exe-client',
    launcherRelativePath: '正常目录/LAUNCHER.EXE', launcherUpdatePolicy: '' });
  check(upperCaseEntry.status, 201, '中文目录与大写 EXE 后缀必须能够创建游戏');
  const legacyEdited = await request('/games/1', 'PUT', { name: '历史游戏资料修改' });
  check(legacyEdited.status, 200, '历史游戏空入口必须兼容普通资料保存');
  check(legacyEdited.body.launcherRelativePath, '', '历史游戏普通资料保存不得填入伪造入口');
  check((await request('/games', 'POST', { ...game, launchMode: 'fixed-root-junction' })).status, 400, '固定目录模式必须提供目录名');
  const defaultCreated = await request('/games', 'POST', { ...game,
    name: '默认不启用登录器更新', installDirectoryName: 'default-new-client', launcherUpdatePolicy: '' });
  check(defaultCreated.status, 201, '默认新游戏必须能够创建');
  check(defaultCreated.body.launcherManifestUrl, '', '默认新游戏未选择策略时不得自动启用清单');
  check(defaultCreated.body.launcherUpdatePolicy, '', '默认新游戏必须保留空更新策略');
  const created = await request('/games', 'POST', game);
  check(created.status, 201, '合法游戏必须能够创建');
  check(created.body.banner, legacyBanner, '游戏必须能够保存有效的历史 Banner 元数据');
  const id = created.body.id;
  check(created.body.launcherManifestUrl, `https://example.test/api/games/${id}/launcher-manifest`, '必须生成独立清单地址');
  check((await request('/games', 'POST', { ...game, name: '另一个游戏' })).status, 400, '重复安装目录必须被拒绝');
  check((await request(`/games/${id}/launcher-manifest`)).status, 404, '没有版本时清单必须返回 404');
  const renamed = await request(`/games/${id}`, 'PUT', { name: '修改后的网页名称' });
  check(renamed.body.installDirectoryName, game.installDirectoryName, '重命名必须保留安装目录');
  check(renamed.body.launcherRelativePath, game.launcherRelativePath, '重命名必须保留入口路径');
  check(renamed.body.banner, legacyBanner, '普通资料保存省略 Banner 时必须保留原值');
  check((await request(`/games/${id}`)).body.banner, legacyBanner, '省略 Banner 后数据库记录必须保留原值');
  check(renamed.body.launchMode, game.launchMode, '普通资料保存必须保留启动模式');
  check(renamed.body.launcherManifestUrl, created.body.launcherManifestUrl, '普通资料保存必须保留更新源地址');
  check(renamed.body.launcherUpdatePolicy, game.launcherUpdatePolicy, '普通资料保存必须保留更新策略');

  const release = { version: '1.0.0', packageUrl: 'https://example.test/launcher-1.0.0.zip',
    packageFormat: 'zip', size: 1024, sha256: contentHash, launcherSha256: contentHash,
    launcherRelativePath: game.launcherRelativePath, launchMode: 'portable', mandatory: false,
    minBoxVersion: '1.3.0', preservePaths: ['Config/login.dat'], published: true };
  const invalidSegmentResults = [];
  const invalidSegmentLaunchers = ['目录./game.exe', '目录 /game.exe', '目录/\u3000/game.exe', '目录/\u0085/game.exe'];
  for (const [index, launcherRelativePath] of invalidSegmentLaunchers.entries()) {
    const invalidGame = await request('/games', 'POST', { ...game,
      installDirectoryName: `invalid-segment-${index}`, launcherRelativePath });
    const invalidRelease = await request(`/games/${id}/launcher-releases`, 'POST', {
      ...release, version: `9.0.${index}`, launcherRelativePath });
    invalidSegmentResults.push({ launcherRelativePath, gameStatus: invalidGame.status, releaseStatus: invalidRelease.status });
  }
  if (invalidSegmentResults.some(result => result.gameStatus !== 400 || result.releaseStatus !== 400)) {
    console.error(JSON.stringify(invalidSegmentResults));
  }
  for (const result of invalidSegmentResults) {
    check(result.gameStatus, 400, `创建游戏必须拒绝无效路径段 ${result.launcherRelativePath}`);
    check(result.releaseStatus, 400, `发布版本必须拒绝无效路径段 ${result.launcherRelativePath}`);
  }
  for (const launcherRelativePath of invalidLaunchers) {
    check((await request(`/games/${id}/launcher-releases`, 'POST', { ...release, launcherRelativePath })).status, 400,
      `发布版本必须拒绝无效入口 ${launcherRelativePath}`);
  }
  check((await request('/games/1/launcher-releases', 'POST', { ...release, launcherRelativePath: '' })).status, 400,
    '发布版本不得继承旧游戏的空入口');
  const emptyEntryDraft = await request('/games/1/launcher-releases', 'POST', {
    ...release, launcherRelativePath: '', published: false });
  check(emptyEntryDraft.status, 201, '旧游戏空入口可以暂存为未发布草稿');
  check((await request(`/launcher-releases/${emptyEntryDraft.body.id}`, 'PUT', { published: true })).status, 400,
    '草稿转发布时必须校验实际继承入口');
  const upperCaseRelease = await request(`/games/${upperCaseEntry.body.id}/launcher-releases`, 'POST', {
    ...release, launcherRelativePath: upperCaseEntry.body.launcherRelativePath });
  check(upperCaseRelease.status, 201, '中文目录、大写 EXE 入口和非 EXE 保留路径必须能够发布');

  const fixedGame = await request('/games', 'POST', { ...game, installDirectoryName: 'fixed-mode-client',
    launchMode: 'fixed-root-junction', fixedLaunchDirectoryName: 'GameRoot', launcherUpdatePolicy: '' });
  check(fixedGame.status, 201, '固定目录游戏必须能够创建');
  const fixedId = fixedGame.body.id;
  const inheritedRelease = await request(`/games/${fixedId}/launcher-releases`, 'POST', {
    ...release, launchMode: '', launcherRelativePath: '' });
  check(inheritedRelease.status, 201, '版本可以继承游戏的有效入口与启动模式');
  const inheritedManifest = await request(`/games/${fixedId}/launcher-manifest`);
  check(inheritedManifest.body.launchMode, 'fixed-root-junction', '清单必须继承游戏的固定启动模式');
  check(inheritedManifest.body.fixedLaunchDirectoryName, 'GameRoot', '继承固定模式必须保留游戏固定目录');
  check(inheritedManifest.body.launcherRelativePath, game.launcherRelativePath, '清单必须继承游戏的有效入口');
  const portableRelease = await request(`/games/${fixedId}/launcher-releases`, 'POST', {
    ...release, version: '1.0.1', launchMode: 'portable', fixedLaunchDirectoryName: '' });
  check(portableRelease.status, 201, '版本必须能够显式改为 portable');
  const portableManifest = await request(`/games/${fixedId}/launcher-manifest`);
  check(portableManifest.body.launchMode, 'portable', '版本的 portable 模式必须覆盖游戏设置');
  check(portableManifest.body.fixedLaunchDirectoryName, '', 'portable 覆盖固定模式时不得继承旧固定目录');
  const explicitFixedRelease = await request(`/games/${fixedId}/launcher-releases`, 'POST', {
    ...release, version: '1.0.2', launchMode: 'fixed-root-junction', fixedLaunchDirectoryName: 'VersionGameRoot' });
  check(explicitFixedRelease.status, 201, '版本必须能够指定独立固定目录');
  const explicitFixedManifest = await request(`/games/${fixedId}/launcher-manifest`);
  check(explicitFixedManifest.body.launchMode, 'fixed-root-junction', '显式固定模式必须保留');
  check(explicitFixedManifest.body.fixedLaunchDirectoryName, 'VersionGameRoot', '显式版本固定目录必须覆盖游戏目录');
  const defaultId = defaultCreated.body.id;
  const defaultDraft = await request(`/games/${defaultId}/launcher-releases`, 'POST', { ...release, published: false });
  check(defaultDraft.status, 201, '默认新游戏必须能够保存版本草稿');
  check((await request(`/games/${defaultId}`)).body.launcherManifestUrl, '', '保存草稿不得启用更新源');
  check((await request(`/games/${defaultId}/launcher-manifest`)).status, 404, '只有草稿时不得提供已发布清单');
  const defaultPublished = await request(`/games/${defaultId}/launcher-releases`, 'POST', { ...release, version: '1.0.1' });
  check(defaultPublished.status, 201, '默认新游戏必须能够首次直接发布版本');
  check((await request(`/games/${defaultId}`)).body.launcherManifestUrl,
    `https://example.test/api/games/${defaultId}/launcher-manifest`, '首次直接发布版本必须启用内置更新源');
  check((await request(`/games/${defaultId}/launcher-manifest`)).body.version, '1.0.1', '首次发布后必须提供真实版本清单');
  check((await request(`/games/${defaultId}`)).body.launcherUpdatePolicy, '', '发布版本不得擅自改写空更新策略');

  const draftGame = await request('/games', 'POST', { ...game,
    installDirectoryName: 'draft-publish-client', launcherUpdatePolicy: '' });
  check(draftGame.status, 201, '草稿转发布场景必须能够创建游戏');
  const draftId = draftGame.body.id;
  const draft = await request(`/games/${draftId}/launcher-releases`, 'POST', { ...release, published: false });
  check((await request(`/games/${draftId}`)).body.launcherManifestUrl, '', '未发布草稿必须保持更新源关闭');
  check((await request(`/launcher-releases/${draft.body.id}`, 'PUT', { published: true })).status, 200, '草稿必须能够转为发布');
  check((await request(`/games/${draftId}`)).body.launcherManifestUrl,
    `https://example.test/api/games/${draftId}/launcher-manifest`, '草稿转发布必须启用内置更新源');
  check((await request(`/games/${draftId}/launcher-manifest`)).status, 200, '草稿转发布后清单必须可读');

  for (const policy of ['automatic', 'notify', 'required']) {
    const explicit = await request('/games', 'POST', { ...game,
      installDirectoryName: `explicit-${policy}`, launcherUpdatePolicy: policy });
    check(explicit.status, 201, `显式 ${policy} 策略必须能够创建游戏`);
    check(explicit.body.launcherManifestUrl,
      `https://example.test/api/games/${explicit.body.id}/launcher-manifest`, `显式 ${policy} 策略必须保留自动生成地址行为`);
    check(explicit.body.launcherUpdatePolicy, policy, `必须保留显式 ${policy} 策略`);
    check((await request(`/games/${explicit.body.id}/launcher-manifest`)).status, 404,
      `显式 ${policy} 缺少已发布版本时必须保持 404`);
  }

  const externalUrl = 'https://updates.example.test/game/launcher-manifest.json';
  const external = await request('/games', 'POST', { ...game,
    installDirectoryName: 'external-manifest-client', launcherManifestUrl: externalUrl });
  check(external.status, 201, '外部更新源游戏必须能够创建');
  check(external.body.launcherManifestUrl, externalUrl, '创建游戏不得覆盖外部更新源');
  const externalPublished = await request(`/games/${external.body.id}/launcher-releases`, 'POST', release);
  check(externalPublished.status, 201, '外部更新源游戏必须能够保存已发布版本');
  check((await request(`/games/${external.body.id}`)).body.launcherManifestUrl, externalUrl, '直接发布版本不得覆盖外部更新源');
  const externalDraft = await request(`/games/${external.body.id}/launcher-releases`, 'POST', {
    ...release, version: '1.0.1', published: false });
  check((await request(`/launcher-releases/${externalDraft.body.id}`, 'PUT', { published: true })).status, 200,
    '外部更新源游戏必须能够将草稿转为发布');
  check((await request(`/games/${external.body.id}`)).body.launcherManifestUrl, externalUrl, '草稿转发布不得覆盖外部更新源');

  check((await request(`/games/${id}/launcher-releases`, 'POST', release, false)).status, 401, '版本发布必须鉴权');
  check((await request(`/games/${id}/launcher-releases`, 'POST', { ...release, sha256: 'invalid' })).status, 400, '非法包哈希必须被拒绝');
  check((await request(`/games/${id}/launcher-releases`, 'POST', { ...release, preservePaths: ['../escape'] })).status, 400, '非法保留路径必须被拒绝');
  const published = await request(`/games/${id}/launcher-releases`, 'POST', release);
  check(published.status, 201, '合法版本必须能够发布');
  check((await request(`/games/${id}/launcher-releases`, 'POST', release)).status, 400, '同游戏同版本必须被拒绝');
  const manifest = await request(`/games/${id}/launcher-manifest`);
  check(manifest.status, 200, '已发布清单必须能够读取');
  check(manifest.body.launcherRelativePath, game.launcherRelativePath, '清单必须保留真实入口路径');
  check(manifest.body.preservePaths, release.preservePaths, '清单必须保留用户数据路径');
  check(manifest.body.minBoxVersion, '1.3.0', '清单必须保留最低盒子版本');
  check(manifest.headers.get('cache-control'), 'public, max-age=60', '清单缓存时间必须与运维说明一致');
  check((await request(`/launcher-releases/${published.body.id}`, 'PUT', { published: false })).status, 200, '版本必须能够暂停发布');
  check((await request(`/games/${id}/launcher-manifest`)).status, 404, '全部暂停发布后必须没有清单');
  await request(`/launcher-releases/${published.body.id}`, 'PUT', { published: true });
  await request(`/games/${id}`, 'PUT', { status: 'inactive' });
  check((await request(`/games/${id}/launcher-manifest`)).status, 404, '停用游戏的清单必须不可公开读取');
  const clientUpdate = await request('/client-update');
  check(clientUpdate.status, 200, '盒子更新清单必须能够读取');
  check(clientUpdate.headers.get('cache-control'), 'no-store', '盒子更新清单必须禁用缓存');
  fs.writeFileSync(path.join(scratch, 'client-update.json'), '{}', 'utf8');
  check((await request('/client-update')).status, 503, '无效盒子更新清单必须返回 503');
  success = true;
  console.log(`通过 ${checkCount} 项本地接口与历史数据库迁移检查。`);
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
  if (success) {
    const resolvedScratch = path.resolve(scratch);
    assert.ok(resolvedScratch.startsWith(`${path.resolve(scratchRoot)}${path.sep}`), '清理路径必须位于项目 .scratch 内');
    fs.rmSync(resolvedScratch, { recursive: true });
  } else {
    console.error(`失败现场保留在：${scratch}`);
  }
}
