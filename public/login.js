document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok) {
                // On successful login, store a token or flag in sessionStorage
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('username', username);

                if (result.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'chat.html';
                }
            } else {
                errorMessage.textContent = result.msg || '登录失败';
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = '网络错误，请稍后再试。';
            errorMessage.style.display = 'block';
        }
    });
});
