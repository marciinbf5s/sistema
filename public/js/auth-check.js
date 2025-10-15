/**
 * Verifica se o usuário está autenticado
 * Redireciona para a página de login se não estiver autenticado
 */
async function checkAuth() {
    // Lista de páginas que não requerem autenticação
    const publicPages = ['/index.html', '/'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Se for uma página pública, não faz nada
    if (publicPages.includes('/' + currentPage) || publicPages.includes(currentPage)) {
        return true;
    }
    
    const token = localStorage.getItem('token');
    
    // Se não houver token, redireciona para o login
    if (!token) {
        redirectToLogin('no_token');
        return false;
    }
    
    try {
        // Verifica se o token é válido no servidor
        const response = await fetch('/api/auth/validate-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Token inválido ou expirado');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        redirectToLogin('session_expired');
        return false;
    }
}

/**
 * Redireciona para a página de login com parâmetros de erro
 */
function redirectToLogin(reason = 'session_expired') {
    // Evita redirecionamento em loop
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === 'index.html') return;
    
    // Redireciona para a página de login com o motivo
    const redirectUrl = `/index.html?redirect=${encodeURIComponent(window.location.pathname)}&reason=${reason}`;
    window.location.href = redirectUrl;
}

// Executa a verificação de autenticação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Adiciona um listener para o evento pageshow para detectar navegação pelo botão voltar
    window.addEventListener('pageshow', function(event) {
        // Se a página foi carregada do cache (back/forward), verifica a autenticação
        if (event.persisted) {
            checkAuth();
        }
    });
    
    // Verifica a autenticação ao carregar a página
    checkAuth();
});

// Torna as funções disponíveis globalmente
window.checkAuth = checkAuth;
window.redirectToLogin = redirectToLogin;
