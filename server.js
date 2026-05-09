const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`🎮 Games: http://localhost:${PORT}/api/games`);
});
