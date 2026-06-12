import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

dotenv.config({ quiet: true });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || '/var/lib/gamexxxyx-api/app.db';

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
    imageUrl TEXT DEFAULT '',
    rating REAL DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    tags TEXT DEFAULT '[]',
    screenshots TEXT DEFAULT '[]',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

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

function serializeGame(row) {
  return {
    ...row,
    tags: parseJsonArray(row.tags),
    screenshots: parseJsonArray(row.screenshots),
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
    imageUrl: game.imageUrl || '',
    rating: Number(game.rating || 0),
    downloads: Number(game.downloads || 0),
    status: game.status || 'active',
    tags: normalizeJsonArray(game.tags),
    screenshots: normalizeJsonArray(game.screenshots),
  };
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', db: 'sqlite' });
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

app.post('/api/games', (req, res) => {
  const game = normalizeGameInput(req.body);
  if (!game.name) {
    res.status(400).json({ success: false, message: 'name is required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO games (
      name, description, category, version, size,
      downloadUrl, guideUrl, imageUrl, rating, downloads,
      status, tags, screenshots
    ) VALUES (
      @name, @description, @category, @version, @size,
      @downloadUrl, @guideUrl, @imageUrl, @rating, @downloads,
      @status, @tags, @screenshots
    )
  `).run(game);

  const created = db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeGame(created));
});

app.put('/api/games/:id', (req, res) => {
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
      imageUrl = @imageUrl,
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

app.delete('/api/games/:id', (req, res) => {
  const result = db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
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

async function generateUniqueFilename(client, originalName, folder) {
  let filename = originalName
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

  app.post(`/api/upload/${type}`, (req, res) => {
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

app.post('/api/upload/presign', async (req, res) => {
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
