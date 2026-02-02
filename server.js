const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const db = require('./database.js');

function handleHttpRequest(request, response) {
  const { pathname, query } = url.parse(request.url, true);
  const method = request.method;
  console.log(`Request for ${pathname} with method ${method} received.`);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  // --- API Routing ---
  const apiRoutes = [
    // User routes
    { method: 'POST', path: '/login', handler: handleLogin },
    // Room routes
    { method: 'GET', path: '/api/rooms/all', handler: handleGetAllRooms },
    { method: 'POST', path: '/api/rooms/add', handler: handleAddRoom },
    { method: 'GET', path: '/api/rooms/joined', handler: handleGetJoinedRooms },
    { method: 'GET', path: '/api/rooms/joinable', handler: handleGetJoinableRooms },
    { method: 'POST', path: '/api/rooms/join', handler: handleJoinRoom },
    { method: 'GET', path: '/api/rooms/messages', handler: handleGetMessages },
    // Routes with path parameters
    { method: 'DELETE', path: '/api/rooms/:id', handler: handleDeleteRoom },
    { method: 'PUT', path: '/api/rooms/:id', handler: handleUpdateRoom },
  ];

  for (const route of apiRoutes) {
    const routeParts = route.path.split('/');
    const pathParts = pathname.split('/');
    
    if (routeParts.length !== pathParts.length) {
      continue;
    }

    const params = {};
    let isMatch = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].substring(1);
        params[paramName] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        isMatch = false;
        break;
      }
    }

    if (isMatch && method === route.method) {
      return route.handler(request, response, query, params);
    }
  }

  // --- Static File Serving ---
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, 'public', filePath);
  const extname = String(path.extname(fullPath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
  };
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
      fs.readFile(fullPath, (error, content) => {
          if (error) {
              response.writeHead(500);
              response.end('Server Error: ' + error.code);
          } else {
              response.writeHead(200, { 'Content-Type': contentType });
              response.end(content, 'utf-8');
          }
      });
      return;
  }
  
  // Fallback for not found
  sendError(response, 404, 'Not Found');
};

function handleLogin(request, response) {
  let body = '';
  request.on('data', chunk => { body += chunk.toString(); });
  request.on('end', () => {
    const { username, password } = JSON.parse(body);

    if (username === 'admin') {
      db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return sendError(response, 500, '数据库错误', err);
        if (user) return sendJSON(response, 200, { msg: '登录成功', role: 'admin' });
        sendError(response, 401, '管理员用户名或密码错误');
      });
    } else {
      getOrCreateUser(username, (err, userId) => {
        if (err) return sendError(response, 500, '数据库错误', err);
        sendJSON(response, 200, { msg: '登录成功', role: 'user', userId: userId });
      });
    }
  });
}

function handleAddRoom(request, response, query, params) {
  let requestBody = '';
  request.on('data', chunk => { requestBody += chunk.toString(); });
  request.on('end', () => {
    const { roomTitle } = JSON.parse(requestBody);
    if (!roomTitle) {
      return sendError(response, 400, 'Room title is required.');
    }

    const sql = "INSERT INTO rooms (title) VALUES (?)";
    db.run(sql, [roomTitle], function(err) {
      if (err) {
        return sendError(response, 409, `【${roomTitle}】已存在！`);
      }
      sendJSON(response, 201, { msg: `【${roomTitle}】创建成功！`, roomId: this.lastID });
      broadcastRoomList();
    });
  });
}

function handleDeleteRoom(request, response, query, params) {
  const { id: roomId } = params;
  if (!roomId) {
    return sendError(response, 400, 'Room ID is required.');
  }

  const sql = "DELETE FROM rooms WHERE id = ?";
  db.run(sql, [roomId], function(err) {
    if (err) {
      return sendError(response, 500, 'Database error while deleting room.', err);
    }
    if (this.changes === 0) {
      return sendError(response, 404, 'Room not found.');
    }
    sendJSON(response, 200, { msg: `房间 (ID: ${roomId}) 已成功删除。` });
    broadcastRoomList();
  });
}

function handleUpdateRoom(request, response, query, params) {
    const { id: roomId } = params;
    if (!roomId) {
        return sendError(response, 400, 'Room ID is required.');
    }

    let body = '';
    request.on('data', chunk => body += chunk.toString());
    request.on('end', () => {
        const { title } = JSON.parse(body);
        if (!title) {
            return sendError(response, 400, 'New room title is required.');
        }

        const sql = "UPDATE rooms SET title = ? WHERE id = ?";
        db.run(sql, [title, roomId], function(err) {
            if (err) {
                return sendError(response, 500, 'Database error while updating room.', err);
            }
            if (this.changes === 0) {
                return sendError(response, 404, 'Room not found.');
            }
            sendJSON(response, 200, { msg: `房间 (ID: ${roomId}) 已成功更新。` });
            broadcastRoomList();
        });
    });
}

function handleGetAllRooms(request, response, query, params) {
  const sql = `
    SELECT r.id, r.title, COUNT(rm.user_id) as online_person
    FROM rooms r
    LEFT JOIN room_members rm ON r.id = rm.room_id
    GROUP BY r.id
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return sendError(response, 500, 'Database error', err);
    }
    sendJSON(response, 200, rows);
  });
}

function handleGetJoinedRooms(request, response, query) {
    const userId = query.userId;
    if (!userId) return sendError(response, 400, 'User ID is required.');

    const sql = `
        SELECT r.id, r.title FROM rooms r
        JOIN room_members rm ON r.id = rm.room_id
        WHERE rm.user_id = ?
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return sendError(response, 500, 'Database error.', err);
        sendJSON(response, 200, rows);
    });
}

function handleGetJoinableRooms(request, response, query) {
    const userId = query.userId;
    if (!userId) return sendError(response, 400, 'User ID is required.');

    const sql = `
        SELECT r.id, r.title FROM rooms r
        WHERE r.id NOT IN (SELECT rm.room_id FROM room_members rm WHERE rm.user_id = ?)
    `;
    db.all(sql, [userId], (err, rows) => {
        if (err) return sendError(response, 500, 'Database error.', err);
        sendJSON(response, 200, rows);
    });
}

function handleJoinRoom(request, response, query, params) {
    let body = '';
    request.on('data', chunk => body += chunk.toString());
    request.on('end', () => {
        const { userId, roomId } = JSON.parse(body);
        if (!userId || !roomId) return sendError(response, 400, 'User ID and Room ID are required.');

        const sql = "INSERT INTO room_members (user_id, room_id) VALUES (?, ?)";
        db.run(sql, [userId, roomId], function(err) {
            if (err) return sendError(response, 500, 'Database error.', err);
            broadcastRoomList(); // Notify all clients about the change in online members
            sendJSON(response, 200, { msg: '成功加入房间' });
        });
    });
}

function handleGetMessages(request, response, query) {
  const roomId = query.roomId;
  if (!roomId) {
      return sendError(response, 400, 'Room ID is required.');
  }
  
  const sql = `
    SELECT m.content, m.timestamp as sendTime, u.username as userName
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.room_id = ?
    ORDER BY m.timestamp ASC
  `;
  db.all(sql, [roomId], (err, rows) => {
      if (err) return sendError(response, 500, 'Database error.', err);
      sendJSON(response, 200, {messages: rows});
  });
}

function sendError(response, code, msg, err) {
    response.writeHead(code, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ code, msg, error: err ? err.message : undefined }));
}

function sendJSON(response, code, data) {
    response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(data));
}

const httpServer = http.createServer(handleHttpRequest);
const webSocketServer = new WebSocket.Server({ server: httpServer });

function getOrCreateUser(username, callback) {
  db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
    if (err) return callback(err);
    if (row) return callback(null, row.id);
    
    db.run("INSERT INTO users (username) VALUES (?)", [username], function(err) {
      if (err) return callback(err);
      callback(null, this.lastID);
    });
  });
}

function broadcastRoomList() {
    const sql = `
      SELECT r.id, r.title, COUNT(rm.user_id) as online_person
      FROM rooms r
      LEFT JOIN room_members rm ON r.id = rm.room_id
      GROUP BY r.id
    `;
    db.all(sql, [], (err, rows) => {
        if (!err) {
            webSocketServer.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'roomListUpdate', rooms: rows }));
                }
            });
        }
    });
}

webSocketServer.on('connection', function (ws) {
    console.log('Client connected');
    ws.userId = null;
    ws.currentRoomId = null;

    ws.on('message', async function (message) {
        try {
            const msg = JSON.parse(message.toString());
            console.log('Received message:', msg);

            if (msg.type === 'joinRoom') {
                getOrCreateUser(msg.user, (err, userId) => {
                    if (err) return console.error(err);
                    ws.userId = userId;

                    db.get("SELECT id FROM rooms WHERE title = ?", [msg.roomTitle], (err, room) => {
                        if (err || !room) return console.error("Room not found");
                        
                        const oldRoomId = ws.currentRoomId;
                        if (oldRoomId) {
                            db.run("DELETE FROM room_members WHERE room_id = ? AND user_id = ?", [oldRoomId, ws.userId]);
                        }

                        ws.currentRoomId = room.id;
                        db.run("INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)", [ws.currentRoomId, ws.userId], () => {
                            broadcastRoomList();
                        });
                        
                        ws.send(JSON.stringify({ type: 'joinRoomResponse', result: `Joined ${msg.roomTitle}` }));
                    });
                });
            } else if (msg.type === 'sendMessage') {
                if (!ws.userId || !ws.currentRoomId || ws.currentRoomId.toString() !== msg.roomId.toString()) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Not in a valid room to send message.' }));
                }

                const { content } = msg;
                const timestamp = new Date().toISOString();

                db.run("INSERT INTO messages (content, timestamp, room_id, user_id) VALUES (?, ?, ?, ?)", 
                    [content, timestamp, ws.currentRoomId, ws.userId], 
                    function(err) {
                        if (err) return console.error(err);

                        const newMessage = {
                            userName: msg.user,
                            sendTime: timestamp,
                            content: content
                        };

                        webSocketServer.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN && client.currentRoomId === ws.currentRoomId) {
                                client.send(JSON.stringify({ type: 'newMessage', message: newMessage }));
                            }
                        });
                    }
                );
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (ws.userId && ws.currentRoomId) {
            db.run("DELETE FROM room_members WHERE room_id = ? AND user_id = ?", [ws.currentRoomId, ws.userId], () => {
                broadcastRoomList();
            });
        }
    });
});

httpServer.listen(8080, () => {
    console.log('Server running at http://127.0.0.1:8080/');
    console.log('WebSocket server also running on port 8080');
});
