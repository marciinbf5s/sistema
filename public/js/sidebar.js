// Função para carregar o menu lateral
function loadSidebar() {
    // Verifica se o sidebar já foi carregado para evitar duplicação
    if (document.querySelector('.sidebar')) {
        onSidebarLoaded();
        return;
    }

    // Carrega o conteúdo do sidebar
    fetch('/includes/sidebar.html')
        .then(response => response.text())
        .then(html => {
            // Insere o menu antes do conteúdo principal
            document.body.insertAdjacentHTML('afterbegin', html);
            
            // Inicializa os eventos do menu
            initSidebarEvents();
            
            // Destaca o item de menu ativo
            highlightActiveMenu();
            
            // Configura o evento de logout
            setupLogoutButton();
            
            // Carrega as informações do usuário
            loadUserInfo();
            
            // Chama a função de carregamento completo
            onSidebarLoaded();
        })
        .catch(error => {
            console.error('Erro ao carregar o menu lateral:', error);
        });
}

// Função para carregar as informações do usuário
function loadUserInfo() {
    try {
        // Tenta obter os dados do usuário do localStorage
        let userData;
        try {
            const userDataStr = localStorage.getItem('user');
            userData = userDataStr ? JSON.parse(userDataStr) : null;
        } catch (e) {
            console.warn('Erro ao analisar dados do usuário do localStorage:', e);
            userData = null;
        }
        
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.log('Nenhum token encontrado, redirecionando para login...');
            if (!window.location.pathname.includes('index.html')) {
                window.location.href = 'index.html';
            }
            return;
        }
        
        // Atualiza a interface com os dados atuais (se disponíveis)
        if (userData) {
            updateUserInfo(userData);
        }
        
        // Sempre tenta buscar os dados mais recentes do servidor em segundo plano
        fetchUserData(token);
        
        // Configura um intervalo para verificar periodicamente se os dados do usuário estão atualizados
        if (!window.userDataCheckInterval) {
            window.userDataCheckInterval = setInterval(() => {
                const currentToken = localStorage.getItem('token');
                if (currentToken) {
                    fetchUserData(currentToken).catch(console.error);
                } else {
                    clearInterval(window.userDataCheckInterval);
                    window.userDataCheckInterval = null;
                }
            }, 300000); // Verifica a cada 5 minutos
        }
    } catch (error) {
        console.error('Erro ao carregar informações do usuário:', error);
    }
}

// Função para buscar os dados do usuário no servidor
async function fetchUserData(token) {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/auth/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        if (response.ok) {
            const userData = await response.json();
            // Atualiza o localStorage com os dados completos do usuário
            localStorage.setItem('user', JSON.stringify(userData));
            updateUserInfo(userData);
        } else {
            console.error('Erro ao buscar dados do usuário:', response.statusText);
            // Se não conseguir buscar os dados, mostra informações padrão
            updateUserInfo({ nome: 'Usuário', admin: false });
        }
    } catch (error) {
        console.error('Erro na requisição de dados do usuário:', error);
        updateUserInfo({ nome: 'Usuário', admin: false });
    }
}

// Função para atualizar as informações do usuário na interface
function updateUserInfo(userData) {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    
    if (userNameElement) {
        // Usa o nome do usuário ou o email como fallback
        const displayName = userData.nome || userData.email || 'Usuário';
        userNameElement.textContent = displayName.split('@')[0]; // Remove o domínio do email se for o caso
    }
    
    if (userRoleElement) {
        // Verifica se é admin ou outro perfil
        const isAdmin = userData.admin || userData.role === 'ADMIN' || userData.role === 'admin';
        const role = isAdmin ? 'Administrador' : 'Usuário';
        userRoleElement.textContent = role;
    }
}

// Função para configurar o botão de logout
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove qualquer evento de clique existente para evitar duplicação
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        
        // Adiciona o evento de clique
        newLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Mostra feedback visual
            const originalHtml = newLogoutBtn.innerHTML;
            newLogoutBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Saindo...';
            newLogoutBtn.disabled = true;
            
            // Limpa os dados de autenticação
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Redireciona para a página de login com um parâmetro para evitar cache
            window.location.href = 'index.html?logout=' + new Date().getTime();
        });
    }
}

// Função para inicializar os eventos do menu
function initSidebarEvents() {
    // Toggle do menu em dispositivos móveis
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarElement = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    if (sidebarToggle && sidebarElement) {
        sidebarToggle.addEventListener('click', function(e) {
            e.preventDefault();
            sidebarElement.classList.toggle('active');
            
            // Mostra/esconde o overlay quando o menu é aberto/fechado em dispositivos móveis
            if (window.innerWidth < 768) {
                if (sidebarElement.classList.contains('active')) {
                    if (sidebarOverlay) {
                        sidebarOverlay.style.display = 'block';
                    }
                    document.body.style.overflow = 'hidden';
                } else {
                    if (sidebarOverlay) {
                        sidebarOverlay.style.display = 'none';
                    }
                    document.body.style.overflow = '';
                }
            }
        });
    }
    
    // Fechar o menu ao clicar no overlay (apenas em dispositivos móveis)
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            if (sidebarElement) {
                sidebarElement.classList.remove('active');
                this.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }
    
    // Fechar o menu ao redimensionar a janela para desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth >= 768) {
            if (sidebarElement) {
                sidebarElement.classList.remove('active');
            }
            if (sidebarOverlay) {
                sidebarOverlay.style.display = 'none';
            }
            document.body.style.overflow = '';
        }
    });
    
    // Fechar o menu ao clicar em um link do menu (apenas em dispositivos móveis)
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        // Pula o botão de logout para evitar conflito
        if (link.id === 'logoutBtn') return;
        
        link.addEventListener('click', function() {
            if (window.innerWidth < 768) {
                if (sidebarElement) {
                    sidebarElement.classList.remove('active');
                }
                if (sidebarOverlay) {
                    sidebarOverlay.style.display = 'none';
                }
                document.body.style.overflow = '';
            }
        });
    });
}

// Função para destacar o item de menu ativo
function highlightActiveMenu() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    
    // Remove a classe 'active' de todos os itens do menu
    navLinks.forEach(link => {
        // Pula o botão de logout
        if (link.id === 'logoutBtn') return;
        
        link.classList.remove('active');
        
        // Verifica se o link corresponde à página atual
        const href = link.getAttribute('href');
        if (href && (currentPath === href || 
                    (currentPath === '' && href === 'index.html') ||
                    (currentPath.includes('?') && href === currentPath.split('?')[0]))) {
            link.classList.add('active');
            
            // Se o link estiver dentro de um submenu, expande o submenu
            const parentCollapse = link.closest('.collapse');
            if (parentCollapse) {
                parentCollapse.classList.add('show');
                const parentLink = document.querySelector(`[data-bs-target="#${parentCollapse.id}"]`);
                if (parentLink) {
                    parentLink.setAttribute('aria-expanded', 'true');
                    parentLink.classList.add('active');
                }
            }
        }
    });
}

// Carrega o menu quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Verifica se o usuário está autenticado antes de carregar o menu
    const token = localStorage.getItem('token');
    if (!token && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
        return;
    }
    
    // Carrega o menu
    loadSidebar();
    
    // Configura o evento de logout globalmente
    window.handleLogout = handleLogout;
    
    // Configura o botão de logout se existir
    setupLogoutButton();
    
    // Força o carregamento das informações do usuário
    loadUserInfo();
});

// Adiciona um listener para quando o conteúdo do sidebar for carregado
function onSidebarLoaded() {
    // Garante que as informações do usuário sejam carregadas após o carregamento do menu
    loadUserInfo();
    
    // Configura o botão de logout novamente para garantir que funcione
    setupLogoutButton();
}

// Torna a função de logout disponível globalmente
window.handleLogout = function(e) {
    if (e) e.preventDefault();
    
    // Encontra o botão de logout
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Mostra feedback visual
    if (logoutBtn) {
        const originalHtml = logoutBtn.innerHTML;
        logoutBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Saindo...';
        logoutBtn.disabled = true;
    }
    
    // Limpa os dados de autenticação
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redireciona para a página de login com um parâmetro para evitar cache
    window.location.href = 'index.html?logout=' + new Date().getTime();
};
