const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = './chatroom.db';
const dbExists = fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    if (!dbExists) {
      console.log('Database file not found, initializing...');
      initializeDatabase();
    }
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT
      )
    `);

    // Insert admin user
    db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, ['admin', '123456'], (err) => {
      if (err) {
        console.error('Error initializing admin user:', err.message);
      } else {
        console.log('Admin user initialized.');
      }
    });

    // Create rooms table
    db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT UNIQUE NOT NULL
      )
    `);

    // Create messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create room_members table
    db.run(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Insert initial rooms
    const rooms = ['General', 'Technology', 'Random'];
    const stmt = db.prepare('INSERT INTO rooms (title) VALUES (?)');
    rooms.forEach(room => stmt.run(room));
    stmt.finalize((err) => {
        if (!err) {
            console.log('Initial rooms created successfully.');
        }
    });

    console.log('Database initialized successfully.');
  });
}

module.exports = db;
