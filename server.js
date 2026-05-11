const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3000;

// Cloudflare R2 配置
const r2Config = {
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID || '14e1786491875d77c4748072f222204e'}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'd846a04a9f5bdbffa32aba4fcc2e69c7',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '76cddb200c25774ed466562a6a70680a2278e42f00e443bd60e2470b293930eb'
  }
};

const r2Client = new S3Client(r2Config);
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'wang';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://oss.wangzhe.me';

// 中间件
app.use(cors());
app.use(express.json());

// 数据库连接池 - 新配置
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'gamexxxyx',
  password: 'Gamexxxyx@2026',
  database: 'gamexxxyx',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// 获取所有游戏
app.get('/api/games', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM games WHERE status = "active" ORDER BY createdAt DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个游戏
app.get('/api/games/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM games WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建游戏
app.post('/api/games', async (req, res) => {
  try {
    const { name, description, downloadUrl, imageUrl, version, size, rating, downloads, tags, screenshots } = req.body;
    const [result] = await pool.query(
      'INSERT INTO games (name, description, downloadUrl, imageUrl, version, size, rating, downloads, tags, screenshots) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description, downloadUrl, imageUrl, version, size, rating || 0, downloads || 0, JSON.stringify(tags || []), JSON.stringify(screenshots || [])]
    );
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新游戏
app.put('/api/games/:id', async (req, res) => {
  try {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (['tags', 'screenshots'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    values.push(req.params.id);
    await pool.query(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除游戏
app.delete('/api/games/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM games WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ success: true, user: { id: rows[0].id, username: rows[0].username, role: rows[0].role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取所有游戏（管理员）
app.get('/api/admin/games', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM games ORDER BY createdAt DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 文件上传配置
const createMulterUpload = (fieldName, limits) => {
  const storage = multer.memoryStorage();
  return multer({
    storage,
    limits,
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      const allowedExts = limits.allowedExtensions || [];
      
      if (limits.allowedExtensions && !allowedExts.includes(ext)) {
        return cb(new Error(`不支持的文件格式: .${ext}`));
      }
      cb(null, true);
    }
  });
};

const gameUpload = createMulterUpload('game', {
  fileSize: 1024 * 1024 * 1024, // 1GB
  allowedExtensions: ['apk', 'ipa', 'exe', 'msi', 'dmg', 'zip', 'rar', '7z', 'tar.gz', 'tar']
});

const coverUpload = createMulterUpload('cover', {
  fileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
});

const screenshotUpload = createMulterUpload('screenshot', {
  fileSize: 20 * 1024 * 1024, // 20MB
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']
});

const checkFileExists = async (key) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });
    await r2Client.send(command);
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    return false;
  }
};

const generateUniqueFilename = async (originalName, folder) => {
  let filename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  let key = `${folder}/${filename}`;
  let counter = 1;
  
  while (await checkFileExists(key)) {
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    filename = `${nameWithoutExt}(${counter})${ext}`;
    key = `${folder}/${filename}`;
    counter++;
  }
  
  return filename;
};

const uploadToR2 = async (file, folder) => {
  const filename = await generateUniqueFilename(file.originalname, folder);
  const key = `${folder}/${filename}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  });
  
  await r2Client.send(command);
  
  const url = `${R2_PUBLIC_URL}/${key}`;
  
  return {
    url,
    filename,
    size: file.size,
    path: key
  };
};

const createPresignedUploadUrl = async (filename, folder, contentType, expiresIn = 3600) => {
  const uniqueFilename = await generateUniqueFilename(filename, folder);
  const key = `${folder}/${uniqueFilename}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType
  });
  
  const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
  
  return {
    uploadUrl: signedUrl,
    filename: uniqueFilename,
    key,
    publicUrl: `${R2_PUBLIC_URL}/${key}`
  };
};

// 游戏安装包上传
app.post('/api/upload/game', (req, res) => {
  gameUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择要上传的游戏文件' });
    }
    
    try {
      const result = await uploadToR2(req.file, 'games');
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

// 封面图片上传
app.post('/api/upload/cover', (req, res) => {
  coverUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择要上传的封面图片' });
    }
    
    try {
      const result = await uploadToR2(req.file, 'covers');
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

// 截图上传
app.post('/api/upload/screenshot', (req, res) => {
  screenshotUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择要上传的截图' });
    }
    
    try {
      const result = await uploadToR2(req.file, 'screenshots');
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
});

// 获取预签名上传URL（用于Uppy等组件直接上传到R2）
app.post('/api/upload/presign', async (req, res) => {
  try {
    const { filename, type, folder } = req.body;
    
    if (!filename || !type) {
      return res.status(400).json({ success: false, error: '缺少 filename 或 type 参数' });
    }
    
    let targetFolder = folder;
    let contentType = type;
    
    if (!targetFolder) {
      if (type.startsWith('image/')) {
        targetFolder = 'covers';
      } else {
        targetFolder = 'games';
      }
    }
    
    const result = await createPresignedUploadUrl(filename, targetFolder, contentType);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🎮 Games: http://localhost:${PORT}/api/games`);
  console.log(`☁️ R2 Storage: ${R2_PUBLIC_URL}`);
});
