const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './chatroom.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase(); // <--- 在连接成功后调用初始化函数    
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 使用 IF NOT EXISTS 确保表不存在时才创建
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT UNIQUE NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      room_id INTEGER,
      user_id INTEGER,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS room_members (
      user_id INTEGER,
      room_id INTEGER,
      PRIMARY KEY (user_id, room_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )`);

    // --- 填充初始数据 ---
    const initialRooms = ['技术交流', '霸天虎', '聊天室1'];
    const stmt = db.prepare("INSERT OR IGNORE INTO rooms (title) VALUES (?)");
    initialRooms.forEach(room => {
      stmt.run(room);
    });
    stmt.finalize();

    console.log('Database schema and initial data are ready.');
  });
}

module.exports = db;
