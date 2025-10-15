// Função para verificar se o usuário está autenticado
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.log('Nenhum token encontrado, redirecionando para login...');
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Token inválido ou expirado');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
        return false;
    }
}

// Função para fazer logout
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Função para exibir mensagens de alerta
function showAlert(container, message, type) {
    if (!container) return;
    
    container.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
        </div>
    `;
    
    // Fechar alerta automaticamente após 5 segundos
    setTimeout(() => {
        const alert = container.querySelector('.alert');
        if (alert) {
            if (typeof bootstrap !== 'undefined' && bootstrap.Alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            } else {
                alert.remove();
            }
        }
    }, 5000);
}

// Função para alternar entre formulários de login e cadastro
function toggleForms() {
    const loginContainer = document.querySelector('.login-form');
    const registerContainer = document.querySelector('.register-form');
    const loginAlert = document.getElementById('loginAlert');
    const registerAlert = document.getElementById('registerAlert');
    
    if (loginContainer && registerContainer) {
        loginContainer.classList.toggle('d-none');
        registerContainer.classList.toggle('d-none');
        
        if (loginAlert) loginAlert.innerHTML = '';
        if (registerAlert) registerAlert.innerHTML = '';
    }
}

// Função principal que será executada quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    // Elementos do DOM
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginAlert = document.getElementById('loginAlert');
    const registerAlert = document.getElementById('registerAlert');
    const logoutBtn = document.getElementById('logoutBtn');
    const toggleFormLinks = document.querySelectorAll('.toggle-form');
    
    // Adiciona evento de clique para alternar entre formulários
    toggleFormLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            toggleForms();
        });
    });
    
    // Configura o botão de logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Verificar se o usuário está logado
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    
    // Redirecionar para o dashboard se já estiver logado e na página de login/cadastro
    if (token && (currentPath.endsWith('index.html') || currentPath === '/')) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Configuração do formulário de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;
            
            if (!email || !password) {
                showAlert(loginAlert, 'Por favor, preencha todos os campos', 'danger');
                return;
            }
            
            try {
                // Limpa qualquer token antigo
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                const response = await fetch('http://127.0.0.1:3000/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                
                // Processa a resposta
                let responseData;
                try {
                    responseData = await response.json();
                } catch (error) {
                    throw new Error('Resposta inválida do servidor');
                }
                
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Credenciais inválidas. Por favor, tente novamente.');
                    }
                    throw new Error(responseData.message || 'Erro ao fazer login. Tente novamente.');
                }
                
                if (!responseData.token) {
                    throw new Error('Token não recebido na resposta do servidor');
                }
                
                // Verifica se o token foi retornado
                if (!responseData.token) {
                    throw new Error('Token não recebido na resposta do servidor');
                }

                // Prepara os dados do usuário para armazenamento
                const userData = responseData.user || {
                    email: email,
                    nome: email.split('@')[0], // Usa a parte antes do @ como nome
                    role: responseData.role || 'user',
                    admin: responseData.role === 'ADMIN' || responseData.role === 'admin' || false
                };

                // Armazena o token e os dados do usuário
                localStorage.setItem('token', responseData.token);
                localStorage.setItem('user', JSON.stringify(userData));
                
                // Adiciona um pequeno atraso para garantir que os dados sejam salvos
                setTimeout(() => {
                    // Redireciona para o dashboard
                    window.location.href = 'dashboard.html';
                }, 100);
                
            } catch (error) {
                console.error('Erro no login:', error);
                showAlert(loginAlert, error.message || 'Erro ao fazer login. Verifique suas credenciais.', 'danger');
            }
        });
    }
    
    // Configuração do formulário de cadastro
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('registerName')?.value;
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;
            
            if (!name || !email || !password || !confirmPassword) {
                showAlert(registerAlert, 'Por favor, preencha todos os campos', 'danger');
                return;
            }
            
            if (password !== confirmPassword) {
                showAlert(registerAlert, 'As senhas não coincidem', 'danger');
                return;
            }
            
            try {
                const response = await fetch('http://127.0.0.1:3000/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ name, email, password, role: 'USER' })
                });
                
                const responseData = await response.json();
                
                if (!response.ok) {
                    throw new Error(responseData.message || 'Erro ao cadastrar usuário');
                }
                
                showAlert(registerAlert, 'Cadastro realizado com sucesso! Faça login para continuar.', 'success');
                registerForm.reset();
                
                // Mostra o formulário de login
                toggleForms();
                
            } catch (error) {
                console.error('Erro no cadastro:', error);
                showAlert(registerAlert, error.message || 'Erro ao realizar cadastro. Tente novamente.', 'danger');
            }
        });
    }
    
    // Atualizar informações do usuário no dashboard
    if (token && document.getElementById('userName')) {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = user.name || 'Usuário';
            }
        } catch (error) {
            console.error('Erro ao carregar informações do usuário:', error);
        }
    }
});

// Verifica se o usuário está autenticado antes de carregar o dashboard
if (window.location.pathname.endsWith('dashboard.html')) {
    checkAuth().then(authenticated => {
        if (!authenticated) {
            window.location.href = 'index.html';
        }
    }).catch(error => {
        console.error('Erro ao verificar autenticação:', error);
        window.location.href = 'index.html';
    });
}
