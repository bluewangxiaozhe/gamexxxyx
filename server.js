import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import yauzl from 'yauzl';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config({ quiet: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || '/var/lib/gamexxxyx-api/app.db';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PUBLIC_API_BASE = (process.env.PUBLIC_API_BASE || 'https://api.567zm.com/api').replace(/\/$/, '');
const CLIENT_UPDATE_MANIFEST_PATH = process.env.CLIENT_UPDATE_MANIFEST_PATH ||
  path.join(process.cwd(), 'client-update.json');

if (!ADMIN_TOKEN) {
  console.warn('[警告] 未设置 ADMIN_TOKEN，所有写接口（增删改/上传）将返回 503。请在服务端环境变量中配置。');
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    version TEXT DEFAULT '',
    size TEXT DEFAULT '',
    downloadUrl TEXT DEFAULT '',
    guideUrl TEXT DEFAULT '',
    dropRateUrl TEXT DEFAULT '',
    imageUrl TEXT DEFAULT '',
    openTime TEXT DEFAULT '',
    heat INTEGER DEFAULT 0,
    banner TEXT DEFAULT '',
    rating REAL DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    tags TEXT DEFAULT '[]',
    screenshots TEXT DEFAULT '[]',
    installDirectoryName TEXT DEFAULT '',
    launcherRelativePath TEXT DEFAULT '',
    launchMode TEXT DEFAULT '',
    fixedLaunchDirectoryName TEXT DEFAULT '',
    launcherManifestUrl TEXT DEFAULT '',
    launcherUpdatePolicy TEXT DEFAULT '',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS game_launcher_releases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL,
    version TEXT NOT NULL,
    packageUrl TEXT NOT NULL,
    packageFormat TEXT DEFAULT 'zip',
    size INTEGER DEFAULT 0,
    sha256 TEXT NOT NULL,
    launcherSha256 TEXT DEFAULT '',
    signature TEXT DEFAULT '',
    signatureAlgorithm TEXT DEFAULT '',
    keyId TEXT DEFAULT '',
    launcherRelativePath TEXT DEFAULT '',
    launchMode TEXT DEFAULT '',
    fixedLaunchDirectoryName TEXT DEFAULT '',
    mandatory INTEGER DEFAULT 0,
    minBoxVersion TEXT DEFAULT '',
    preservePaths TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    published INTEGER DEFAULT 1,
    publishedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const launcherReleaseColumns = db.prepare('PRAGMA table_info(game_launcher_releases)').all().map(column => column.name);
if (!launcherReleaseColumns.includes('signatureAlgorithm')) {
  db.prepare("ALTER TABLE game_launcher_releases ADD COLUMN signatureAlgorithm TEXT DEFAULT ''").run();
}
if (!launcherReleaseColumns.includes('keyId')) {
  db.prepare("ALTER TABLE game_launcher_releases ADD COLUMN keyId TEXT DEFAULT ''").run();
}
if (!launcherReleaseColumns.includes('launcherSha256')) {
  db.prepare("ALTER TABLE game_launcher_releases ADD COLUMN launcherSha256 TEXT DEFAULT ''").run();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS hero_banners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT DEFAULT '推荐',
    title TEXT NOT NULL,
    subtitle TEXT DEFAULT '',
    desc TEXT DEFAULT '',
    image TEXT DEFAULT '',
    color TEXT DEFAULT 'from-amber-500 to-orange-600',
    bgColor TEXT DEFAULT 'bg-amber-50',
    sortOrder INTEGER DEFAULT 0,
    visible INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    link TEXT DEFAULT '',
    visible INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const gameColumns = db.prepare('PRAGMA table_info(games)').all().map(column => column.name);
if (!gameColumns.includes('dropRateUrl')) {
  db.prepare("ALTER TABLE games ADD COLUMN dropRateUrl TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('openTime')) {
  db.prepare("ALTER TABLE games ADD COLUMN openTime TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('heat')) {
  db.prepare("ALTER TABLE games ADD COLUMN heat INTEGER DEFAULT 0").run();
}
if (!gameColumns.includes('banner')) {
  db.prepare("ALTER TABLE games ADD COLUMN banner TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('installDirectoryName')) {
  db.prepare("ALTER TABLE games ADD COLUMN installDirectoryName TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('launcherRelativePath')) {
  db.prepare("ALTER TABLE games ADD COLUMN launcherRelativePath TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('launchMode')) {
  db.prepare("ALTER TABLE games ADD COLUMN launchMode TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('fixedLaunchDirectoryName')) {
  db.prepare("ALTER TABLE games ADD COLUMN fixedLaunchDirectoryName TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('launcherManifestUrl')) {
  db.prepare("ALTER TABLE games ADD COLUMN launcherManifestUrl TEXT DEFAULT ''").run();
}
if (!gameColumns.includes('launcherUpdatePolicy')) {
  db.prepare("ALTER TABLE games ADD COLUMN launcherUpdatePolicy TEXT DEFAULT ''").run();
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '2mb' }));

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(Array.isArray(parsed) ? parsed : []);
    } catch {
      return JSON.stringify(value.split(',').map(item => item.trim()).filter(Boolean));
    }
  }
  return '[]';
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
}

function parseBanner(value) {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) return normalizeBannerObject(value);

  try {
    const parsed = JSON.parse(value);
    return normalizeBannerObject(parsed);
  } catch {
    return null;
  }
}

function normalizeBannerObject(value) {
  if (!value || typeof value !== 'object') return null;

  const banner = {
    title: String(value.title || '').trim(),
    subtitle: String(value.subtitle || '').trim(),
    desc: String(value.desc || '').trim(),
    image: String(value.image || '').trim(),
    color: String(value.color || '').trim(),
    bgColor: String(value.bgColor || '').trim(),
  };

  if (!banner.title && !banner.subtitle && !banner.desc && !banner.image) {
    return null;
  }

  return banner;
}

function normalizeBannerInput(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      const normalized = normalizeBannerObject(parsed);
      return normalized ? JSON.stringify(normalized) : '';
    } catch {
      return '';
    }
  }

  const normalized = normalizeBannerObject(value);
  return normalized ? JSON.stringify(normalized) : '';
}

function serializeHeroBanner(row) {
  if (!row) return null;
  return {
    ...row,
    sortOrder: Number(row.sortOrder || 0),
    visible: Number(row.visible || 0) !== 0,
  };
}

function serializeAnnouncement(row) {
  if (!row) return null;
  return {
    ...row,
    link: String(row.link || '').trim(),
    visible: Number(row.visible || 0) !== 0,
  };
}

function getNextHeroBannerSortOrder() {
  const row = db.prepare('SELECT COALESCE(MAX(sortOrder), -1) AS maxSortOrder FROM hero_banners').get();
  return Number(row?.maxSortOrder ?? -1) + 1;
}

function normalizeHeroBannerInput(input, fallback = {}) {
  const banner = { ...fallback, ...(input || {}) };
  const parsedSortOrder = Number(banner.sortOrder);
  return {
    category: String(banner.category || '').trim() || '推荐',
    title: String(banner.title || '').trim(),
    subtitle: String(banner.subtitle || '').trim(),
    desc: String(banner.desc || '').trim(),
    image: String(banner.image || '').trim(),
    color: String(banner.color || '').trim() || 'from-amber-500 to-orange-600',
    bgColor: String(banner.bgColor || '').trim() || 'bg-amber-50',
    sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : null,
    visible: normalizeBoolean(banner.visible, true) ? 1 : 0,
  };
}

function normalizeAnnouncementInput(input, fallback = {}) {
  const announcement = { ...fallback, ...(input || {}) };
  return {
    title: String(announcement.title || '').trim(),
    content: String(announcement.content || '').trim(),
    link: String(announcement.link || '').trim(),
    visible: normalizeBoolean(announcement.visible, true) ? 1 : 0,
  };
}

const LAUNCH_MODES = new Set(['portable', 'fixed-root-junction']);
const LAUNCHER_UPDATE_POLICIES = new Set(['notify', 'automatic', 'required']);
const LAUNCHER_PACKAGE_FORMATS = new Set(['zip', 'exe']);
const WINDOWS_RESERVED_DIRECTORY_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

function normalizeOptionalString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function validateDirectoryName(value, fieldName) {
  const directoryName = normalizeOptionalString(value);
  if (!directoryName) return '';
  if (directoryName === '.' || directoryName === '..') {
    return `${fieldName} 不能使用 . 或 ..`;
  }
  if (directoryName.length > 128 || /[\\/:*?"<>|\u0000-\u001F]/.test(directoryName)) {
    return `${fieldName} 必须是单层 Windows 目录名`;
  }
  if (directoryName.endsWith('.') || directoryName.endsWith(' ')) {
    return `${fieldName} 不能以空格或句点结尾`;
  }
  const baseName = directoryName.split('.')[0].toUpperCase();
  if (WINDOWS_RESERVED_DIRECTORY_NAMES.has(baseName)) {
    return `${fieldName} 不能使用 Windows 保留名称`;
  }
  return '';
}

function validateRelativePath(value, fieldName) {
  const relativePath = normalizeOptionalString(value);
  if (!relativePath) return '';
  if (relativePath.length > 260 || /^[\\/]/.test(relativePath) || /^[A-Za-z]:/.test(relativePath)) {
    return `${fieldName} 必须是相对路径`;
  }
  if (/[\u0000-\u001F]/.test(relativePath)) {
    return `${fieldName} 包含非法字符`;
  }
  const segments = relativePath.split(/[\\/]+/);
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    return `${fieldName} 不能包含空路径段或路径穿越`;
  }
  return '';
}

function validateLauncherRelativePath(value) {
  const pathError = validateRelativePath(value, 'launcherRelativePath');
  if (pathError) return pathError;
  const relativePath = normalizeOptionalString(value);
  if (!relativePath) return '';
  if (!/\.exe$/i.test(relativePath)) {
    return 'launcherRelativePath 必须指向 .exe 文件';
  }
  const segments = relativePath.split(/[\\/]+/);
  if (segments.some(segment => /[:*?"<>|]/.test(segment))) {
    return 'launcherRelativePath 包含 Windows 非法文件名字符';
  }
  if (segments.some(segment => /^\p{White_Space}*$/u.test(segment) || segment.endsWith(' ') || segment.endsWith('.'))) {
    return 'launcherRelativePath 的目录或文件名不能仅为空白，或以空格、句点结尾';
  }
  return '';
}

function validateHttpsUrl(value, fieldName) {
  const url = normalizeOptionalString(value);
  if (!url) return '';
  try {
    if (new URL(url).protocol !== 'https:') throw new Error('protocol');
  } catch {
    return `${fieldName} 必须是 HTTPS URL`;
  }
  return '';
}

function normalizeGameContract(input, fallback = {}) {
  const game = { ...fallback, ...(input || {}) };
  return {
    installDirectoryName: normalizeOptionalString(game.installDirectoryName),
    launcherRelativePath: normalizeOptionalString(game.launcherRelativePath),
    launchMode: normalizeOptionalString(game.launchMode),
    fixedLaunchDirectoryName: normalizeOptionalString(game.fixedLaunchDirectoryName),
    launcherManifestUrl: normalizeOptionalString(game.launcherManifestUrl),
    launcherUpdatePolicy: normalizeOptionalString(game.launcherUpdatePolicy),
  };
}

function validateGameContract(contract, existingId = null, requireNewContract = false) {
  if (requireNewContract && !contract.installDirectoryName) {
    return '新游戏必须填写 installDirectoryName';
  }
  if (requireNewContract && !contract.launcherRelativePath) {
    return '新游戏必须填写 launcherRelativePath';
  }
  if (requireNewContract && !contract.launchMode) {
    return '新游戏必须填写 launchMode';
  }
  const directoryError = validateDirectoryName(contract.installDirectoryName, 'installDirectoryName');
  if (directoryError) return directoryError;

  const fixedDirectoryError = validateDirectoryName(
    contract.fixedLaunchDirectoryName,
    'fixedLaunchDirectoryName',
  );
  if (fixedDirectoryError) return fixedDirectoryError;

  const launcherPathError = validateLauncherRelativePath(contract.launcherRelativePath);
  if (launcherPathError) return launcherPathError;

  if (contract.launchMode && !LAUNCH_MODES.has(contract.launchMode)) {
    return 'launchMode 只能是 portable 或 fixed-root-junction';
  }
  if (contract.launchMode === 'fixed-root-junction' && !contract.fixedLaunchDirectoryName) {
    return 'launchMode 为 fixed-root-junction 时必须填写 fixedLaunchDirectoryName';
  }
  if (contract.launchMode !== 'fixed-root-junction' && contract.fixedLaunchDirectoryName) {
    return '只有 fixed-root-junction 模式可以填写 fixedLaunchDirectoryName';
  }

  const manifestUrlError = validateHttpsUrl(contract.launcherManifestUrl, 'launcherManifestUrl');
  if (manifestUrlError) return manifestUrlError;
  if (contract.launcherUpdatePolicy && !LAUNCHER_UPDATE_POLICIES.has(contract.launcherUpdatePolicy)) {
    return 'launcherUpdatePolicy 只能是 notify、automatic 或 required';
  }
  if (contract.launcherUpdatePolicy && !contract.launcherManifestUrl && !requireNewContract) {
    return '填写 launcherUpdatePolicy 时必须同时填写 launcherManifestUrl';
  }

  if (contract.installDirectoryName) {
    const duplicate = db.prepare(`
      SELECT id FROM games
      WHERE LOWER(installDirectoryName) = LOWER(?)
        AND installDirectoryName != ''
        AND (? IS NULL OR id != ?)
      LIMIT 1
    `).get(contract.installDirectoryName, existingId, existingId);
    if (duplicate) return 'installDirectoryName 已被其他游戏使用';
  }

  return '';
}

const heroBannerColumns = db.prepare('PRAGMA table_info(hero_banners)').all().map(column => column.name);
if (!heroBannerColumns.includes('category')) {
  db.prepare("ALTER TABLE hero_banners ADD COLUMN category TEXT DEFAULT '推荐'").run();
}

function serializeGame(row) {
  return {
    ...row,
    tags: parseJsonArray(row.tags),
    screenshots: parseJsonArray(row.screenshots),
    banner: parseBanner(row.banner),
  };
}

function normalizeGameInput(input, fallback = {}) {
  const game = { ...fallback, ...(input || {}) };
  const contract = normalizeGameContract(input, fallback);
  return {
    name: String(game.name || '').trim(),
    description: game.description || '',
    category: game.category || '',
    version: game.version || '',
    size: game.size || '',
    downloadUrl: game.downloadUrl || '',
    guideUrl: game.guideUrl || '',
    dropRateUrl: game.dropRateUrl || '',
    imageUrl: game.imageUrl || '',
    openTime: String(game.openTime || '').trim(),
    heat: Number(game.heat || 0),
    banner: normalizeBannerInput(game.banner),
    rating: Number(game.rating || 0),
    downloads: Number(game.downloads || 0),
    status: game.status || 'active',
    tags: normalizeJsonArray(game.tags),
    screenshots: normalizeJsonArray(game.screenshots),
    ...contract,
  };
}

function serializeLauncherRelease(row) {
  if (!row) return null;
  return {
    ...row,
    size: Number(row.size || 0),
    mandatory: Number(row.mandatory || 0) !== 0,
    published: Number(row.published || 0) !== 0,
    preservePaths: parseJsonArray(row.preservePaths),
  };
}

function normalizeLauncherReleaseInput(input, fallback = {}) {
  const release = { ...fallback, ...(input || {}) };
  const parsedSize = Number(release.size);
  return {
    version: normalizeOptionalString(release.version),
    packageUrl: normalizeOptionalString(release.packageUrl),
    packageFormat: normalizeOptionalString(release.packageFormat || 'zip').toLowerCase(),
    size: Number.isFinite(parsedSize) && parsedSize >= 0 ? Math.floor(parsedSize) : 0,
    sha256: normalizeOptionalString(release.sha256).toLowerCase(),
    launcherSha256: normalizeOptionalString(release.launcherSha256).toLowerCase(),
    signature: normalizeOptionalString(release.signature),
    signatureAlgorithm: normalizeOptionalString(release.signatureAlgorithm),
    keyId: normalizeOptionalString(release.keyId),
    launcherRelativePath: normalizeOptionalString(release.launcherRelativePath),
    launchMode: normalizeOptionalString(release.launchMode),
    fixedLaunchDirectoryName: normalizeOptionalString(release.fixedLaunchDirectoryName),
    mandatory: normalizeBoolean(release.mandatory, false) ? 1 : 0,
    minBoxVersion: normalizeOptionalString(release.minBoxVersion),
    preservePaths: normalizeJsonArray(release.preservePaths),
    notes: normalizeOptionalString(release.notes),
    published: normalizeBoolean(release.published, true) ? 1 : 0,
  };
}

function validatePreservePaths(value) {
  const paths = parseJsonArray(value);
  if (paths.some(item => typeof item !== 'string' || validateRelativePath(item, 'preservePaths'))) {
    return 'preservePaths 必须是安全的相对路径数组';
  }
  return '';
}

function validateLauncherRelease(release, gameId, existingId = null) {
  if (!/^\d+\.\d+\.\d+$/.test(release.version)) {
    return 'version 必须是三段数字版本号';
  }
  const packageUrlError = validateHttpsUrl(release.packageUrl, 'packageUrl');
  if (packageUrlError) return packageUrlError;
  if (!LAUNCHER_PACKAGE_FORMATS.has(release.packageFormat)) {
    return 'packageFormat 只能是 zip 或 exe';
  }
  if (!Number.isInteger(release.size) || release.size <= 0) {
    return 'size 必须是正整数';
  }
  if (!/^[a-f0-9]{64}$/.test(release.sha256)) {
    return 'sha256 必须是 64 位十六进制字符串';
  }
  if (!/^[a-f0-9]{64}$/.test(release.launcherSha256)) {
    return 'launcherSha256 必须是登录器入口文件的 64 位 SHA-256';
  }
  const game = getGameById(gameId);
  const launcherRelativePath = release.launcherRelativePath || normalizeOptionalString(game?.launcherRelativePath);
  if (release.published && !launcherRelativePath) {
    return '发布登录器版本必须填写有效入口，或在游戏中配置入口';
  }
  const launcherPathError = validateLauncherRelativePath(launcherRelativePath);
  if (launcherPathError) return launcherPathError;
  const directoryError = validateDirectoryName(
    release.fixedLaunchDirectoryName,
    'fixedLaunchDirectoryName',
  );
  if (directoryError) return directoryError;
  if (release.launchMode && !LAUNCH_MODES.has(release.launchMode)) {
    return 'launchMode 只能是 portable 或 fixed-root-junction';
  }
  if (release.launchMode === 'fixed-root-junction' && !release.fixedLaunchDirectoryName) {
    return 'launchMode 为 fixed-root-junction 时必须填写 fixedLaunchDirectoryName';
  }
  if (release.launchMode !== 'fixed-root-junction' && release.fixedLaunchDirectoryName) {
    return '只有 fixed-root-junction 模式可以填写 fixedLaunchDirectoryName';
  }
  const preservePathsError = validatePreservePaths(release.preservePaths);
  if (preservePathsError) return preservePathsError;

  const duplicate = db.prepare(`
    SELECT id FROM game_launcher_releases
    WHERE gameId = ? AND version = ? AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(gameId, release.version, existingId, existingId);
  if (duplicate) return '同一个游戏已经存在该登录器版本';
  return '';
}

function getGameById(gameId) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
}

function ensureLauncherManifestUrl(gameId) {
  db.prepare(`
    UPDATE games SET launcherManifestUrl = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND TRIM(COALESCE(launcherManifestUrl, '')) = ''
  `).run(`${PUBLIC_API_BASE}/games/${gameId}/launcher-manifest`, gameId);
}

function getLauncherReleaseById(releaseId) {
  return db.prepare('SELECT * FROM game_launcher_releases WHERE id = ?').get(releaseId);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// 鉴权中间件：保护所有写接口（增删改、上传）。
// 客户端通过 x-admin-token 头或 Authorization: Bearer <token> 传入令牌。
function requireAuth(req, res, next) {
  if (!ADMIN_TOKEN) {
    res.status(503).json({ success: false, message: '服务端未配置 ADMIN_TOKEN' });
    return;
  }

  const authHeader = req.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = bearer || req.get('x-admin-token') || '';

  if (!token || !timingSafeEqual(token, ADMIN_TOKEN)) {
    res.status(401).json({ success: false, message: '未授权，请重新登录' });
    return;
  }

  next();
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', db: 'sqlite' });
});

app.get('/api/client-update', (req, res) => {
  try {
    // Windows 工具生成的 UTF-8 文件可能带 BOM；JSON.parse 不会自动忽略它。
    const manifestText = fs.readFileSync(CLIENT_UPDATE_MANIFEST_PATH, 'utf8')
      .replace(/^\uFEFF/, '');
    const manifest = JSON.parse(manifestText);
    const validVersion = /^\d+\.\d+\.\d+$/.test(String(manifest.version || ''));
    const validUrl = typeof manifest.url === 'string' && manifest.url.startsWith('https://');
    const validHash = /^[a-fA-F0-9]{64}$/.test(String(manifest.sha256 || ''));

    if (!validVersion || !validUrl || !validHash) {
      throw new Error('更新清单缺少 version、HTTPS url 或 SHA-256');
    }

    if (manifest.fallbackUrl &&
        (typeof manifest.fallbackUrl !== 'string' || !manifest.fallbackUrl.startsWith('https://'))) {
      throw new Error('更新清单的 fallbackUrl 必须使用 HTTPS');
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      version: manifest.version,
      url: manifest.url,
      fallbackUrl: manifest.fallbackUrl || '',
      sha256: manifest.sha256,
      notes: String(manifest.notes || ''),
      mandatory: Boolean(manifest.mandatory),
    });
  } catch (error) {
    console.error('[client-update] 更新清单不可用:', error.message);
    res.status(503).json({ success: false, message: '更新服务暂未就绪' });
  }
});

// 供后台登录校验密码用
app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ success: true });
});

app.get('/api/games', (req, res) => {
  const { category, includeInactive } = req.query;
  const params = [];
  const where = [];

  if (includeInactive !== 'true') {
    where.push("status != 'inactive'");
  }

  if (category) {
    where.push('category = ?');
    params.push(String(category));
  }

  const rows = db.prepare(`
    SELECT * FROM games
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY datetime(createdAt) DESC, id DESC
  `).all(...params);

  res.json(rows.map(serializeGame));
});

app.get('/api/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT category FROM games
    WHERE status != 'inactive' AND category != ''
    ORDER BY category ASC
  `).all();

  res.json(rows.map(row => row.category));
});

app.get('/api/hero-banners', (req, res) => {
  const includeHidden = req.query.includeHidden === 'true';
  const rows = db.prepare(`
    SELECT * FROM hero_banners
    ${includeHidden ? '' : 'WHERE visible = 1'}
    ORDER BY sortOrder ASC, id ASC
  `).all();

  res.json(rows.map(serializeHeroBanner));
});

app.get('/api/announcements', (req, res) => {
  const includeHidden = req.query.includeHidden === 'true';
  const rows = db.prepare(`
    SELECT * FROM announcements
    ${includeHidden ? '' : 'WHERE visible = 1'}
    ORDER BY datetime(updatedAt) DESC, id DESC
  `).all();

  res.json(rows.map(serializeAnnouncement));
});

app.get('/api/games/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json([]);
    return;
  }

  const like = `%${q}%`;
  const rows = db.prepare(`
    SELECT * FROM games
    WHERE status != 'inactive'
      AND (name LIKE ? OR description LIKE ? OR category LIKE ? OR tags LIKE ?)
    ORDER BY datetime(createdAt) DESC, id DESC
  `).all(like, like, like, like);

  res.json(rows.map(serializeGame));
});

app.get('/api/games/:id', (req, res) => {
  const row = db.prepare("SELECT * FROM games WHERE id = ? AND status != 'inactive'").get(req.params.id);
  if (!row) {
    res.status(404).json({ success: false, message: 'Game not found' });
    return;
  }

  res.json(serializeGame(row));
});

app.post('/api/games', requireAuth, (req, res) => {
  const game = normalizeGameInput(req.body);
  if (!game.name) {
    res.status(400).json({ success: false, message: 'name is required' });
    return;
  }
  const contractError = validateGameContract(game, null, true);
  if (contractError) {
    res.status(400).json({ success: false, message: contractError });
    return;
  }

  const result = db.prepare(`
    INSERT INTO games (
      name, description, category, version, size,
      downloadUrl, guideUrl, dropRateUrl, imageUrl, openTime, heat, banner, rating, downloads,
      status, tags, screenshots, installDirectoryName, launcherRelativePath,
      launchMode, fixedLaunchDirectoryName, launcherManifestUrl, launcherUpdatePolicy
    ) VALUES (
      @name, @description, @category, @version, @size,
      @downloadUrl, @guideUrl, @dropRateUrl, @imageUrl, @openTime, @heat, @banner, @rating, @downloads,
      @status, @tags, @screenshots, @installDirectoryName, @launcherRelativePath,
      @launchMode, @fixedLaunchDirectoryName, @launcherManifestUrl, @launcherUpdatePolicy
    )
  `).run(game);

  if (game.launcherUpdatePolicy) ensureLauncherManifestUrl(result.lastInsertRowid);
  const created = db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeGame(created));
});

app.put('/api/games/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Game not found' });
    return;
  }

  const game = normalizeGameInput(req.body, serializeGame(existing));
  const contractError = validateGameContract(game, Number(req.params.id));
  if (contractError) {
    res.status(400).json({ success: false, message: contractError });
    return;
  }
  db.prepare(`
    UPDATE games SET
      name = @name,
      description = @description,
      category = @category,
      version = @version,
      size = @size,
      downloadUrl = @downloadUrl,
      guideUrl = @guideUrl,
      dropRateUrl = @dropRateUrl,
      imageUrl = @imageUrl,
      openTime = @openTime,
      heat = @heat,
      banner = @banner,
      rating = @rating,
      downloads = @downloads,
      status = @status,
      tags = @tags,
      screenshots = @screenshots,
      installDirectoryName = @installDirectoryName,
      launcherRelativePath = @launcherRelativePath,
      launchMode = @launchMode,
      fixedLaunchDirectoryName = @fixedLaunchDirectoryName,
      launcherManifestUrl = @launcherManifestUrl,
      launcherUpdatePolicy = @launcherUpdatePolicy,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id: req.params.id, ...game });

  const updated = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  res.json(serializeGame(updated));
});

app.delete('/api/games/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ success: result.changes > 0 });
});

function serializePublicLauncherManifest(game, release) {
  const gameContract = normalizeGameContract(game, game);
  const releaseData = serializeLauncherRelease(release);
  const launchMode = releaseData.launchMode || gameContract.launchMode;
  return {
    schemaVersion: 1,
    gameId: Number(game.id),
    gameName: game.name,
    installDirectoryName: gameContract.installDirectoryName,
    launcherManifestUrl: gameContract.launcherManifestUrl,
    launcherUpdatePolicy: gameContract.launcherUpdatePolicy,
    version: releaseData.version,
    packageUrl: releaseData.packageUrl,
    packageFormat: releaseData.packageFormat,
    size: releaseData.size,
    sha256: releaseData.sha256,
    launcherSha256: releaseData.launcherSha256,
    signature: releaseData.signature,
    signatureAlgorithm: releaseData.signatureAlgorithm,
    keyId: releaseData.keyId,
    launcherRelativePath: releaseData.launcherRelativePath || gameContract.launcherRelativePath,
    launchMode,
    fixedLaunchDirectoryName: launchMode === 'fixed-root-junction'
      ? releaseData.fixedLaunchDirectoryName || gameContract.fixedLaunchDirectoryName
      : '',
    mandatory: releaseData.mandatory,
    minBoxVersion: releaseData.minBoxVersion,
    preservePaths: releaseData.preservePaths,
    notes: releaseData.notes,
    publishedAt: releaseData.publishedAt,
  };
}

app.get('/api/games/:id/launcher-manifest', (req, res) => {
  const game = getGameById(req.params.id);
  if (!game || game.status === 'inactive') {
    res.status(404).json({ success: false, message: 'Game not found' });
    return;
  }

  const release = db.prepare(`
    SELECT * FROM game_launcher_releases
    WHERE gameId = ? AND published = 1
    ORDER BY datetime(publishedAt) DESC, id DESC
    LIMIT 1
  `).get(req.params.id);
  if (!release) {
    res.status(404).json({ success: false, message: 'Launcher manifest not found' });
    return;
  }

  res.set('Cache-Control', 'public, max-age=60');
  res.json(serializePublicLauncherManifest(game, release));
});

app.get('/api/games/:id/launcher-releases', requireAuth, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ success: false, message: 'Game not found' });
    return;
  }
  const rows = db.prepare(`
    SELECT * FROM game_launcher_releases
    WHERE gameId = ?
    ORDER BY datetime(publishedAt) DESC, id DESC
  `).all(req.params.id);
  res.json(rows.map(serializeLauncherRelease));
});

app.post('/api/games/:id/launcher-releases', requireAuth, (req, res) => {
  const game = getGameById(req.params.id);
  if (!game) {
    res.status(404).json({ success: false, message: 'Game not found' });
    return;
  }

  const release = normalizeLauncherReleaseInput(req.body);
  const validationError = validateLauncherRelease(release, Number(req.params.id));
  if (validationError) {
    res.status(400).json({ success: false, message: validationError });
    return;
  }

  const result = db.prepare(`
    INSERT INTO game_launcher_releases (
      gameId, version, packageUrl, packageFormat, size, sha256, launcherSha256, signature,
      signatureAlgorithm, keyId,
      launcherRelativePath, launchMode, fixedLaunchDirectoryName, mandatory,
      minBoxVersion, preservePaths, notes, published
    ) VALUES (
      @gameId, @version, @packageUrl, @packageFormat, @size, @sha256, @launcherSha256, @signature,
      @signatureAlgorithm, @keyId,
      @launcherRelativePath, @launchMode, @fixedLaunchDirectoryName, @mandatory,
      @minBoxVersion, @preservePaths, @notes, @published
    )
  `).run({ gameId: Number(req.params.id), ...release });

  if (release.published) ensureLauncherManifestUrl(Number(req.params.id));
  const created = getLauncherReleaseById(result.lastInsertRowid);
  res.status(201).json(serializeLauncherRelease(created));
});

app.put('/api/launcher-releases/:id', requireAuth, (req, res) => {
  const existing = getLauncherReleaseById(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Launcher release not found' });
    return;
  }

  const release = normalizeLauncherReleaseInput(req.body, serializeLauncherRelease(existing));
  const validationError = validateLauncherRelease(release, Number(existing.gameId), Number(req.params.id));
  if (validationError) {
    res.status(400).json({ success: false, message: validationError });
    return;
  }

  db.prepare(`
    UPDATE game_launcher_releases SET
      version = @version,
      packageUrl = @packageUrl,
      packageFormat = @packageFormat,
      size = @size,
      sha256 = @sha256,
      launcherSha256 = @launcherSha256,
      signature = @signature,
      signatureAlgorithm = @signatureAlgorithm,
      keyId = @keyId,
      launcherRelativePath = @launcherRelativePath,
      launchMode = @launchMode,
      fixedLaunchDirectoryName = @fixedLaunchDirectoryName,
      mandatory = @mandatory,
      minBoxVersion = @minBoxVersion,
      preservePaths = @preservePaths,
      notes = @notes,
      published = @published,
      publishedAt = CASE WHEN @published = 1 THEN CURRENT_TIMESTAMP ELSE publishedAt END,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id: Number(req.params.id), ...release });

  if (release.published && !existing.published) ensureLauncherManifestUrl(Number(existing.gameId));
  res.json(serializeLauncherRelease(getLauncherReleaseById(req.params.id)));
});

app.delete('/api/launcher-releases/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM game_launcher_releases WHERE id = ?').run(req.params.id);
  res.json({ success: result.changes > 0 });
});

app.post('/api/hero-banners', requireAuth, (req, res) => {
  const banner = normalizeHeroBannerInput(req.body);
  if (!banner.title || !banner.image) {
    res.status(400).json({ success: false, message: 'title and image are required' });
    return;
  }

  const sortOrder = banner.sortOrder ?? getNextHeroBannerSortOrder();
  const result = db.prepare(`
    INSERT INTO hero_banners (
      category, title, subtitle, desc, image, color, bgColor, sortOrder, visible
    ) VALUES (
      @category, @title, @subtitle, @desc, @image, @color, @bgColor, @sortOrder, @visible
    )
  `).run({ ...banner, sortOrder });

  const created = db.prepare('SELECT * FROM hero_banners WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeHeroBanner(created));
});

app.put('/api/hero-banners/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM hero_banners WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Banner not found' });
    return;
  }

  const banner = normalizeHeroBannerInput(req.body, serializeHeroBanner(existing));
  if (!banner.title || !banner.image) {
    res.status(400).json({ success: false, message: 'title and image are required' });
    return;
  }

  db.prepare(`
    UPDATE hero_banners SET
      category = @category,
      title = @title,
      subtitle = @subtitle,
      desc = @desc,
      image = @image,
      color = @color,
      bgColor = @bgColor,
      sortOrder = @sortOrder,
      visible = @visible,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id: req.params.id, ...banner });

  const updated = db.prepare('SELECT * FROM hero_banners WHERE id = ?').get(req.params.id);
  res.json(serializeHeroBanner(updated));
});

app.delete('/api/hero-banners/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM hero_banners WHERE id = ?').run(req.params.id);
  res.json({ success: result.changes > 0 });
});

app.post('/api/announcements', requireAuth, (req, res) => {
  const announcement = normalizeAnnouncementInput(req.body);
  if (!announcement.title || !announcement.content) {
    res.status(400).json({ success: false, message: 'title and content are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO announcements (
      title, content, link, visible
    ) VALUES (
      @title, @content, @link, @visible
    )
  `).run(announcement);

  const created = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeAnnouncement(created));
});

app.put('/api/announcements/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ success: false, message: 'Announcement not found' });
    return;
  }

  const announcement = normalizeAnnouncementInput(req.body, serializeAnnouncement(existing));
  if (!announcement.title || !announcement.content) {
    res.status(400).json({ success: false, message: 'title and content are required' });
    return;
  }

  db.prepare(`
    UPDATE announcements SET
      title = @title,
      content = @content,
      link = @link,
      visible = @visible,
      updatedAt = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({ id: req.params.id, ...announcement });

  const updated = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  res.json(serializeAnnouncement(updated));
});

app.delete('/api/announcements/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: result.changes > 0 });
});

const uploadConfigs = {
  game: {
    folder: 'games',
    fileSize: 1024 * 1024 * 1024,
    allowedExtensions: ['apk', 'ipa', 'exe', 'msi', 'dmg', 'zip', 'rar', '7z', 'tar.gz', 'tar'],
    emptyMessage: '请选择要上传的游戏文件',
  },
  cover: {
    folder: 'covers',
    fileSize: 50 * 1024 * 1024,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
    emptyMessage: '请选择要上传的封面图片',
  },
  screenshot: {
    folder: 'screenshots',
    fileSize: 20 * 1024 * 1024,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
    emptyMessage: '请选择要上传的截图',
  },
};

function getExtension(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  return path.extname(lower).slice(1);
}

function createMulterUpload(config) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.fileSize },
    fileFilter(req, file, cb) {
      const ext = getExtension(file.originalname);
      if (!config.allowedExtensions.includes(ext)) {
        cb(new Error(`不支持的文件格式: .${ext}`));
        return;
      }
      cb(null, true);
    },
  });
}

function getR2Client() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing R2 config: ${missing.join(', ')}`);
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function checkFileExists(client, key) {
  try {
    await client.send(new HeadObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false;
    return false;
  }
}

function decodeMultipartFilename(originalName) {
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');

  if (decoded && !decoded.includes('\uFFFD') && /[\u4e00-\u9fff]/.test(decoded)) {
    return decoded;
  }

  return originalName;
}

async function generateUniqueFilename(client, originalName, folder) {
  let filename = decodeMultipartFilename(originalName)
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  if (!filename || filename === '.' || filename === '..') {
    filename = `upload-${Date.now()}`;
  }

  let key = `${folder}/${filename}`;
  let counter = 1;

  while (await checkFileExists(client, key)) {
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    filename = `${nameWithoutExt}(${counter})${ext}`;
    key = `${folder}/${filename}`;
    counter += 1;
  }

  return filename;
}

function buildPublicUrl(key) {
  const encodedKey = key.split('/').map(part => encodeURIComponent(part)).join('/');
  return `${process.env.R2_PUBLIC_URL}/${encodedKey}`;
}

async function uploadToR2(file, folder) {
  const client = getR2Client();
  const filename = await generateUniqueFilename(client, file.originalname, folder);
  const key = `${folder}/${filename}`;

  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return {
    url: buildPublicUrl(key),
    filename,
    size: file.size,
    sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    path: key,
  };
}

function normalizePackageEntryPath(value) {
  const normalized = normalizeOptionalString(value).replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('launcherRelativePath 必须是安装包内的相对路径');
  }
  const segments = normalized.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('launcherRelativePath 包含非法目录跳转');
  }
  return segments.join('/');
}

async function hashZipEntry(buffer, relativePath) {
  const target = normalizePackageEntryPath(relativePath).toLowerCase();
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true }, (openError, zipFile) => {
      if (openError) {
        reject(openError);
        return;
      }

      let found = false;
      zipFile.readEntry();
      zipFile.on('entry', entry => {
        const entryPath = String(entry.fileName || '').replace(/\\/g, '/').replace(/\/$/, '');
        if (entryPath.toLowerCase() !== target) {
          zipFile.readEntry();
          return;
        }
        found = true;
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            zipFile.close();
            reject(streamError);
            return;
          }
          const hash = crypto.createHash('sha256');
          stream.on('data', chunk => hash.update(chunk));
          stream.on('error', error => {
            zipFile.close();
            reject(error);
          });
          stream.on('end', () => {
            zipFile.close();
            resolve(hash.digest('hex'));
          });
        });
      });
      zipFile.on('end', () => {
        if (!found) reject(new Error('压缩包中没有找到指定的登录器入口文件'));
      });
      zipFile.on('error', reject);
    });
  });
}

async function inspectLauncherPackage(packageUrl, packageFormat, launcherRelativePath) {
  const urlError = validateHttpsUrl(packageUrl, 'packageUrl');
  if (urlError) throw new Error(urlError);
  const format = normalizeOptionalString(packageFormat).toLowerCase();
  if (!LAUNCHER_PACKAGE_FORMATS.has(format)) throw new Error('packageFormat 只能是 zip 或 exe');
  const response = await fetch(packageUrl, { redirect: 'follow' });
  if (!response.ok) throw new Error(`读取登录器安装包失败：HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const launcherSha256 = format === 'exe'
    ? sha256
    : await hashZipEntry(buffer, launcherRelativePath);
  return { size: buffer.length, sha256, launcherSha256 };
}

async function createPresignedUploadUrl(filename, folder, contentType, expiresIn = 3600) {
  const client = getR2Client();
  const uniqueFilename = await generateUniqueFilename(client, filename, folder);
  const key = `${folder}/${uniqueFilename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return {
    uploadUrl: await getSignedUrl(client, command, { expiresIn }),
    filename: uniqueFilename,
    key,
    publicUrl: buildPublicUrl(key),
  };
}

function registerUploadRoute(type) {
  const config = uploadConfigs[type];
  const upload = createMulterUpload(config);

  app.post(`/api/upload/${type}`, requireAuth, (req, res) => {
    upload.single('file')(req, res, async err => {
      if (err) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }

      if (!req.file) {
        res.status(400).json({ success: false, error: config.emptyMessage });
        return;
      }

      try {
        const result = await uploadToR2(req.file, config.folder);
        res.json({ success: true, data: result });
      } catch (uploadError) {
        res.status(500).json({ success: false, error: uploadError.message });
      }
    });
  });
}

registerUploadRoute('game');
registerUploadRoute('cover');
registerUploadRoute('screenshot');

app.post('/api/launcher-package-inspect', requireAuth, async (req, res) => {
  try {
    const { packageUrl, packageFormat, launcherRelativePath } = req.body || {};
    const result = await inspectLauncherPackage(packageUrl, packageFormat, launcherRelativePath);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || '无法读取登录器安装包' });
  }
});

app.post('/api/upload/presign', requireAuth, async (req, res) => {
  try {
    const { filename, type, folder } = req.body || {};
    if (!filename || !type) {
      res.status(400).json({ success: false, error: '缺少 filename 或 type 参数' });
      return;
    }

    const targetFolder = folder || (String(type).startsWith('image/') ? 'covers' : 'games');
    const result = await createPresignedUploadUrl(filename, targetFolder, type);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Gamexxxyx API running on http://127.0.0.1:${PORT}`);
});
