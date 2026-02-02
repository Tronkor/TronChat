const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './chatroom.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create Rooms table
    db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE
      )
    `, (err) => {
      if (err) console.error("Error creating rooms table", err);
      else {
        db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
          if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO rooms (title) VALUES (?)");
            stmt.run("聊天室1");
            stmt.run("聊天室2");
            stmt.run("聊天室3");
            stmt.finalize();
            console.log("Default rooms created.");
          }
        });
      }
    });

    // Create Users table with password
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT
      )
    `, (err) => {
        if (err) console.error("Error creating users table", err);
        else {
            // Add admin user with initial password
            // In a real app, use a hashed password!
            const adminPassword = '123456'; 
            db.run("INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)", ['admin', adminPassword]);
        }
    });

    // Create Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        room_id INTEGER,
        user_id INTEGER,
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Create room_members table
    db.run(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INTEGER,
        user_id INTEGER,
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
  });
}

module.exports = db;
