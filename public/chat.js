document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    const username = sessionStorage.getItem('username');

    if (isLoggedIn !== 'true' || !username) {
        window.location.href = 'index.html';
        return;
    }

    const usernameDisplay = document.getElementById('username-display');
    usernameDisplay.textContent = username;

    const roomList = document.getElementById('room-list');
    const currentRoomName = document.getElementById('current-room-name');
    const messageList = document.getElementById('message-list');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = messageForm.querySelector('button');
    const addRoomBtn = document.getElementById('add-room-btn');
    const rightSidebar = document.getElementById('right-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const joinableRoomList = document.getElementById('joinable-room-list');
    const logoutBtn = document.getElementById('logout-btn');

    let currentRoomId = null;
    let ws;

    function connectWebSocket() {
        ws = new WebSocket(`ws://${window.location.host}`);

        ws.onopen = () => {
            console.log('WebSocket连接成功');
            ws.send(JSON.stringify({ type: 'register', username }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'newMessage' && data.roomId === currentRoomId) {
                displayMessage(data);
            } else if (data.type === 'roomListUpdate') {
                fetchJoinedRooms();
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

    async function fetchJoinedRooms() {
        try {
            const response = await fetch(`/api/rooms/joined?username=${username}`);
            if (response.ok) {
                const rooms = await response.json();
                renderRoomList(rooms, roomList);
            } else {
                console.error('获取已加入的房间失败');
            }
        } catch (error) {
            console.error('获取已加入的房间时出错:', error);
        }
    }

    async function fetchJoinableRooms() {
        try {
            const response = await fetch(`/api/rooms/joinable?username=${username}`);
            if (response.ok) {
                const rooms = await response.json();
                renderJoinableRoomList(rooms);
            } else {
                console.error('获取可加入的房间失败');
            }
        } catch (error) {
            console.error('获取可加入的房间时出错:', error);
        }
    }

    function renderRoomList(rooms, listElement) {
        listElement.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.textContent = room.title;
            li.dataset.roomId = room.id;
            if (room.id === currentRoomId) {
                li.classList.add('active');
            }
            li.addEventListener('click', () => selectRoom(room.id, room.title));
            listElement.appendChild(li);
        });
    }

    function renderJoinableRoomList(rooms) {
        joinableRoomList.innerHTML = '';
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.textContent = room.title;
            const joinButton = document.createElement('button');
            joinButton.textContent = '加入';
            joinButton.addEventListener('click', (e) => {
                e.stopPropagation();
                joinRoom(room.id);
            });
            li.appendChild(joinButton);
            joinableRoomList.appendChild(li);
        });
    }

    async function selectRoom(roomId, roomTitle) {
        if (currentRoomId === roomId) return;

        currentRoomId = roomId;
        currentRoomName.textContent = roomTitle;
        messageList.innerHTML = '';

        document.querySelectorAll('#room-list li').forEach(li => {
            li.classList.remove('active');
            if (parseInt(li.dataset.roomId) === roomId) {
                li.classList.add('active');
            }
        });

        messageInput.disabled = false;
        sendButton.disabled = false;

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'joinRoom', roomId }));
        }

        await fetchMessages(roomId);
    }

    async function fetchMessages(roomId) {
        try {
            const response = await fetch(`/api/rooms/messages?roomId=${roomId}`);
            if (response.ok) {
                const messages = await response.json();
                messages.forEach(displayMessage);
            } else {
                console.error('获取消息失败');
            }
        } catch (error) {
            console.error('获取消息时出错:', error);
        }
    }

    function displayMessage(message) {
        const div = document.createElement('div');
        div.classList.add('message');
        div.classList.add(message.sender === username ? 'sent' : 'received');
        
        const senderSpan = document.createElement('span');
        senderSpan.classList.add('sender');
        senderSpan.textContent = message.sender;
        
        div.appendChild(senderSpan);
        div.append(message.content);
        
        messageList.appendChild(div);
        messageList.scrollTop = messageList.scrollHeight;
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

    async function joinRoom(roomId) {
        try {
            const response = await fetch('/api/rooms/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, roomId })
            });
            if (response.ok) {
                await fetchJoinedRooms();
                await fetchJoinableRooms();
                // Optionally auto-select the newly joined room
                const room = await response.json();
                selectRoom(room.id, room.title);
                rightSidebar.classList.remove('open');
            } else {
                const error = await response.json();
                alert(`加入房间失败: ${error.msg}`);
            }
        } catch (error) {
            console.error('加入房间时出错:', error);
        }
    }

    addRoomBtn.addEventListener('click', () => {
        fetchJoinableRooms();
        rightSidebar.classList.add('open');
    });

    closeSidebarBtn.addEventListener('click', () => {
        rightSidebar.classList.remove('open');
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    // Initial load
    fetchJoinedRooms();
    connectWebSocket();
});
