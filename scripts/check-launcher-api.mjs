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
  const game = { name: '网页展示名称', installDirectoryName: 'stable-client-dir',
    launcherRelativePath: 'Login/Launcher.exe', launchMode: 'portable',
    launcherUpdatePolicy: 'automatic', downloadUrl: 'https://example.test/game.zip', status: 'active' };
  for (const invalidName of ['../escape', 'C:escape', '\\\\server\\share', '.', '..']) {
    check((await request('/games', 'POST', { ...game, installDirectoryName: invalidName })).status, 400, '非法安装目录必须被拒绝');
  }
  check((await request('/games', 'POST', { ...game, launcherRelativePath: '../Launcher.exe' })).status, 400, '非法入口路径必须被拒绝');
  check((await request('/games', 'POST', { ...game, launchMode: 'fixed-root-junction' })).status, 400, '固定目录模式必须提供目录名');
  const created = await request('/games', 'POST', game);
  check(created.status, 201, '合法游戏必须能够创建');
  const id = created.body.id;
  check(created.body.launcherManifestUrl, `https://example.test/api/games/${id}/launcher-manifest`, '必须生成独立清单地址');
  check((await request('/games', 'POST', { ...game, name: '另一个游戏' })).status, 400, '重复安装目录必须被拒绝');
  check((await request(`/games/${id}/launcher-manifest`)).status, 404, '没有版本时清单必须返回 404');
  const renamed = await request(`/games/${id}`, 'PUT', { name: '修改后的网页名称' });
  check(renamed.body.installDirectoryName, game.installDirectoryName, '重命名必须保留安装目录');
  check(renamed.body.launcherRelativePath, game.launcherRelativePath, '重命名必须保留入口路径');

  const release = { version: '1.0.0', packageUrl: 'https://example.test/launcher-1.0.0.zip',
    packageFormat: 'zip', size: 1024, sha256: contentHash, launcherSha256: contentHash,
    launcherRelativePath: game.launcherRelativePath, launchMode: 'portable', mandatory: false,
    minBoxVersion: '1.3.0', preservePaths: ['Config/login.dat'], published: true };
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
