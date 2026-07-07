import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config({ quiet: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || '/var/lib/gamexxxyx-api/app.db';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

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
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

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
  };
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

// 供后台登录校验密码用
app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ success: true });
});

app.get('/api/games', (req, res) => {
  const { category, includeInactive } = req.query;
  const params = [];
  const where = [];

  if (includeInactive !== 'true') {
    where.push('status = ?');
    params.push('active');
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
    WHERE status = 'active' AND category != ''
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
    WHERE status = 'active'
      AND (name LIKE ? OR description LIKE ? OR category LIKE ? OR tags LIKE ?)
    ORDER BY downloads DESC, id DESC
  `).all(like, like, like, like);

  res.json(rows.map(serializeGame));
});

app.get('/api/games/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
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

  const result = db.prepare(`
    INSERT INTO games (
      name, description, category, version, size,
      downloadUrl, guideUrl, dropRateUrl, imageUrl, openTime, heat, banner, rating, downloads,
      status, tags, screenshots
    ) VALUES (
      @name, @description, @category, @version, @size,
      @downloadUrl, @guideUrl, @dropRateUrl, @imageUrl, @openTime, @heat, @banner, @rating, @downloads,
      @status, @tags, @screenshots
    )
  `).run(game);

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
    path: key,
  };
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
