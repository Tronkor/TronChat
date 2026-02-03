document.addEventListener('DOMContentLoaded', () => {
    // --- Initialization ---
    function init() {
        if (sessionStorage.getItem('isLoggedIn') !== 'true') {
            window.location.href = 'index.html';
            return;
        }

        const addRoomForm = document.getElementById('add-room-form');
        const roomNameInput = document.getElementById('room-name-input');
        const logoutBtn = document.getElementById('logout-btn');

        connectWebSocket();
        fetchRooms();

        addRoomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addRoom();
        });
        roomNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addRoom();
            }
        });

        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('username');
            window.location.href = 'index.html';
        });

        document.getElementById('room-grid').addEventListener('click', function(event) {
            const target = event.target;
            const roomId = target.dataset.id;

            if (target.classList.contains('delete-btn')) {
                if (confirm(`确定要删除这个聊天室吗？`)) {
                    deleteRoom(roomId);
                }
            }

            if (target.classList.contains('edit-btn')) {
                const currentTitle = target.dataset.title;
                const newTitle = prompt('请输入新的聊天室名称：', currentTitle);
                if (newTitle && newTitle.trim() !== '' && newTitle.trim() !== currentTitle) {
                    editRoom(roomId, newTitle.trim());
                }
            }
        });
    }

    const API_BASE_URL = 'http://localhost:8080';
    const WS_URL = 'ws://localhost:8080';
    let ws = null;

    // --- WebSocket Handling ---
    function connectWebSocket() {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => console.log('WebSocket connection established.');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            if (data.type === 'roomListUpdate') {
                renderRooms(data.rooms);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed. Reconnecting...');
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => console.error('WebSocket error:', error);
    }

    // --- Room Management ---
    async function fetchRooms() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/all`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rooms = await response.json();
            renderRooms(rooms);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            document.getElementById('room-grid').innerHTML = '<p>加载聊天室列表失败。</p>';
        }
    }

    function renderRooms(rooms) {
        const roomGrid = document.getElementById('room-grid');
        roomGrid.innerHTML = '';
        if (!rooms || rooms.length === 0) {
            roomGrid.innerHTML = '<p>当前没有聊天室，快去创建一个吧！</p>';
            return;
        }

        rooms.forEach(room => {
            const card = document.createElement('div');
            card.className = 'room-card';
            card.dataset.roomId = room.id;
            card.innerHTML = `
                <div class="room-card-header">
                    <h3>${room.title}</h3>
                    <span class="online-count">在线: ${room.online_person || 0}</span>
                </div>
                <div class="room-card-body">
                    <div class="room-actions">
                        <button class="edit-btn" data-id="${room.id}" data-title="${room.title}">编辑</button>
                        <button class="delete-btn" data-id="${room.id}">删除</button>
                    </div>
                </div>
            `;
            roomGrid.appendChild(card);
        });
    }

    async function addRoom() {
        const roomNameInput = document.getElementById('room-name-input');
        const roomName = roomNameInput.value.trim();
        if (!roomName) {
            showError('请输入聊天室名称');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomTitle: roomName }),
            });
            const result = await response.json();
            if (response.ok) {
                roomNameInput.value = '';
                // The room list will be updated via WebSocket broadcast
            } else {
                showError(result.msg || '创建失败');
            }
        } catch (error) {
            console.error('Error adding room:', error);
            showError('网络错误，请稍后再试');
        }
    }

    async function deleteRoom(roomId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.msg || '删除失败');
            }
            // 列表将通过WebSocket自动更新
        } catch (error) {
            console.error('Error deleting room:', error);
            showError(error.message);
        }
    }

    async function editRoom(roomId, newTitle) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.msg || '更新失败');
            }
            // 列表将通过WebSocket自动更新
        } catch (error) {
            console.error('Error updating room:', error);
            showError(error.message);
        }
    }

    // --- Utility ---
    function showError(message) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 3000);
        }
    }

    // Start the application
    init();
});
