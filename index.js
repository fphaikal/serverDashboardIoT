const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const port = 4000;

// Secret key for JWT
const jwtSecret = '1601200716122006'; // Gantilah dengan kunci rahasia yang lebih aman

app.use(express.json());
app.use(cors()); // Enable CORS

// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
  host: 'sql12.freesqldatabase.com', 
  user: 'sql12709506',
  password: 'dHFTkzcL65',
  database: 'sql12709506'
});

// Koneksi ke MySQL
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('MySQL Connected...');
});

// Endpoint untuk registrasi pengguna
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log('Hashed Password:', hashedPassword); // Log hashed password for debugging

  // Simpan pengguna baru ke database
  const sql = 'INSERT INTO tb_user (username, password) VALUES (?, ?)';
  db.query(sql, [username, hashedPassword], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'User registered successfully', id: results.insertId });
  });
});

// Endpoint untuk login pengguna
app.post('/api/login', (req, res) => {
  console.log('Request Body:', req.body); // Log request body untuk debugging
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Cari pengguna di database
  const sql = 'SELECT * FROM tb_user WHERE username = ?';
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('No user found with username:', username);
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const user = results[0];
    console.log('User found:', user);
    console.log('Password:', user.password);

    // Verifikasi password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Password does not match');
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username }, jwtSecret, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token: token });
  });
});


// Endpoint untuk mendapatkan data
app.get('/api/data', (req, res) => {
  const sql = 'SELECT * FROM tb_dht11';
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.get('/api/control', (req, res) => {
  const sql = 'SELECT * FROM tb_control';
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Endpoint untuk menerima data dari ESP32
app.post('/api/data', (req, res) => {
  const suhu = parseFloat(req.query.suhu);
  const kelembapan = parseFloat(req.query.kelembapan);

  if (isNaN(suhu) || isNaN(kelembapan)) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const sql = 'INSERT INTO tb_dht11 (suhu, kelembapan) VALUES (?, ?)';
  db.query(sql, [suhu, kelembapan], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Data inserted successfully', id: results.insertId });
  });
});

// Endpoint untuk memperbarui status lamp
app.put('/api/update-lamp-status', (req, res) => {
  const lamps = req.body; // Asumsikan data dikirimkan dalam body sebagai JSON

  // Validasi data
  if (!Array.isArray(lamps)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  // Buat query update untuk setiap lamp
  const queries = lamps.map(lamp => {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE tb_control SET status = ? WHERE id = ?';
      db.query(sql, [lamp.status, lamp.id], (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  });

  // Eksekusi semua query
  Promise.all(queries)
    .then(results => {
      res.json({ message: 'Status updated successfully' });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
