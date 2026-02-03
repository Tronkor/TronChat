document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('login-error');
    const registerButton = document.getElementById('register-button');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        handleLogin();
    });

    registerButton.addEventListener('click', async (e) => {
        e.preventDefault();
        handleRegister();
    });

    async function handleLogin() {
        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok) {
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('username', username);
                sessionStorage.setItem('userId', result.userId);

                if (result.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'chat.html';
                }
            } else {
                showError(result.msg || '登录失败');
            }
        } catch (error) {
            showError('网络错误，请稍后再试。');
        }
    }

    async function handleRegister() {
        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok) {
                alert('注册成功！现在您可以使用新账户登录。');
                errorMessage.style.display = 'none';
            } else {
                showError(result.msg || '注册失败');
            }
        } catch (error) {
            showError('网络错误，请稍后再试。');
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
});
