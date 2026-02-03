document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const username = sessionStorage.getItem('username');

    if (isLoggedIn !== 'true' || !username) {
        window.location.href = 'login.html';
        return;
    }

    // --- DOM Element References ---
    const roomList = document.getElementById('room-list');
    const currentRoomName = document.getElementById('current-room-name');
    const messageList = document.getElementById('message-list');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const addRoomBtn = document.getElementById('add-room-btn');
    const joinableRoomsPopup = document.getElementById('joinable-rooms-popup');
    const joinableRoomList = document.getElementById('joinable-room-list');
    const welcomeMessage = document.getElementById('welcome-message');
    const logoutBtn = document.getElementById('logout-btn');

    // --- Initial Setup ---
    welcomeMessage.textContent = `欢迎你，${username}`;

    let currentRoomId = null;
    let ws;

    // --- WebSocket Connection ---
    function connectWebSocket() {
        ws = new WebSocket(`ws://${window.location.host}`);

        ws.onopen = () => {
            console.log('WebSocket连接成功');
            ws.send(JSON.stringify({ type: 'register', username }));
            fetchInitialData();
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'messageHistory':
                    messageList.innerHTML = '';
                    data.messages.forEach(msg => {
                        displayMessage({
                            sender: msg.userName,
                            content: msg.content,
                            timestamp: msg.sendTime
                        });
                    });
                    break;
                case 'newMessage':
                    if (data.roomId === currentRoomId) {
                        displayMessage(data);
                    }
                    break;
                case 'roomListUpdate':
                    fetchInitialData();
                    break;
                case 'initialData':
                    renderRoomList(data.joinedRooms);
                    renderJoinableRoomList(data.joinableRooms);
                    if (data.joinedRooms.length > 0) {
                        const generalRoom = data.joinedRooms.find(r => r.title === 'General') || data.joinedRooms[0];
                        selectRoom(generalRoom.id, generalRoom.title);
                    }
                    break;
            }
        };

        ws.onclose = () => {
            console.log('WebSocket连接关闭，尝试重新连接...');
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
        };
    }

    // --- Data Fetching ---
    function fetchInitialData() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'getInitialData', username }));
        }
    }
    
    async function fetchJoinedRooms() {
        // This can be replaced by WebSocket updates if the backend sends them
    }

    async function fetchJoinableRooms() {
        // This can be replaced by WebSocket updates if the backend sends them
    }

    async function fetchMessages(roomId) {
        try {
            const response = await fetch(`/api/rooms/messages?roomId=${roomId}`);
            if (response.ok) {
                const messages = await response.json();
                messageList.innerHTML = '';
                messages.forEach(displayMessage);
            } else {
                console.error('获取消息失败');
            }
        } catch (error) {
            console.error('获取消息时出错:', error);
        }
    }

    // --- UI Rendering ---
    function renderRoomList(rooms) {
        roomList.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.textContent = room.title;
            li.dataset.roomId = room.id;
            if (room.id === currentRoomId) {
                li.classList.add('active');
            }
            li.addEventListener('click', () => selectRoom(room.id, room.title));
            roomList.appendChild(li);
        });
    }

    function renderJoinableRoomList(rooms) {
        joinableRoomList.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = room.title;
            const joinButton = document.createElement('button');
            joinButton.textContent = '加入';
            joinButton.className = 'join-btn';
            joinButton.addEventListener('click', (e) => {
                e.stopPropagation();
                joinRoom(room.id);
            });
            li.appendChild(span);
            li.appendChild(joinButton);
            joinableRoomList.appendChild(li);
        });
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}年${month}月${day}日 ${hours}:${minutes}`;
    }

    function displayMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', message.sender === username ? 'sent' : 'received');

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');
        // 将发送者和消息内容拼接
        contentDiv.textContent = `${message.sender}: ${message.content}`;
        
        const metaSpan = document.createElement('span');
        metaSpan.classList.add('meta');
        // 格式化时间戳
        metaSpan.textContent = formatTimestamp(message.timestamp);

        msgDiv.appendChild(contentDiv);
        msgDiv.appendChild(metaSpan); // 将时间戳附加到消息div

        messageList.appendChild(msgDiv);
        messageList.scrollTop = messageList.scrollHeight;
    }

    // --- Actions & Event Handlers ---
    function selectRoom(roomId, roomTitle) {
        if (currentRoomId === roomId) return;

        currentRoomId = roomId;
        currentRoomName.textContent = roomTitle;
        
        document.querySelectorAll('#room-list li').forEach(li => {
            li.classList.remove('active');
            if (parseInt(li.dataset.roomId) === roomId) {
                li.classList.add('active');
            }
        });

        messageInput.disabled = false;
        messageForm.querySelector('button').disabled = false;

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'joinRoom', roomId }));
        }
    }

    function joinRoom(roomId) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'userJoinRoom', username, roomId }));
            joinableRoomsPopup.classList.add('hidden'); // Hide after joining
        }
    }

    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content && currentRoomId && ws && ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'newMessage',
                roomId: currentRoomId,
                sender: username,
                content: content
            };
            ws.send(JSON.stringify(message));
            messageInput.value = '';
        }
    });

    addRoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        joinableRoomsPopup.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!joinableRoomsPopup.contains(e.target) && e.target !== addRoomBtn) {
            joinableRoomsPopup.classList.add('hidden');
        }
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('username');
        window.location.href = 'login.html';
    });

    // --- Initial Load ---
    connectWebSocket();
});
