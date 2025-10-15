const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AUTH } = require('../constants/messages');

/**
 * Middleware para verificar o token JWT
 */
const authenticateToken = async (req, res, next) => {
    // Verifica o cabeçalho de autorização
    const authHeader = req.headers['authorization'] || '';
    
    // Tenta obter o token do cabeçalho Authorization
    let token = null;
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        // Tenta obter o token dos cookies
        token = req.cookies.token;
    } else if (req.query.token) {
        // Tenta obter o token da query string (apenas para desenvolvimento)
        token = req.query.token;
    }
    
    if (!token) {
        console.log('Nenhum token encontrado na requisição');
        return res.status(401).json({ 
            success: false,
            error: AUTH.UNAUTHORIZED,
            message: 'Token de autenticação não fornecido',
            details: 'Nenhum token JWT foi encontrado na requisição. Por favor, faça login novamente.'
        });
    }
    
    // Verifica o token
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decodificado com sucesso:', JSON.stringify(decoded, null, 2));
    } catch (jwtError) {
        console.error('Erro ao verificar o token JWT:', jwtError);
        
        if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: AUTH.TOKEN_EXPIRED,
                message: 'Sessão expirada. Por favor, faça login novamente.'
            });
        }
        
        return res.status(401).json({
            success: false,
            error: AUTH.INVALID_TOKEN,
            message: 'Token inválido ou malformado',
            details: jwtError.message
        });
    }
    
    try {
        // Verifica se o usuário ainda existe no banco de dados
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        });
        
        if (!user) {
            console.log('Usuário não encontrado no banco de dados para o ID:', decoded.id);
            return res.status(401).json({ 
                success: false,
                error: AUTH.INVALID_TOKEN,
                message: 'Usuário não encontrado',
                details: 'O usuário associado a este token não existe mais no sistema.'
            });
        }
        
        // Adiciona o usuário ao objeto de requisição
        req.user = {
            id: user.id,
            role: user.role
        };
        
        console.log('Autenticação bem-sucedida para o usuário:', user.email, 'ID:', user.id, 'Role:', user.role);
        
        // Continua para a próxima função de middleware
        next();
        
    } catch (error) {
        console.error('Erro ao processar a autenticação:', error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                error: AUTH.TOKEN_EXPIRED,
                message: 'Sessão expirada. Por favor, faça login novamente.'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                error: AUTH.INVALID_TOKEN,
                message: 'Token inválido ou malformado',
                details: error.message
            });
        }
        
        // Outros erros
        console.error('Erro inesperado na autenticação:', error);
        return res.status(500).json({ 
            success: false,
            error: 'AUTH_ERROR',
            message: 'Erro ao processar a autenticação'
        });
    }
};

/**
 * Middleware para verificar se o usuário é administrador
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ error: AUTH.FORBIDDEN });
    }
};

/**
 * Middleware para verificar se o usuário é o dono do recurso ou admin
 */
const isOwnerOrAdmin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const appointment = await prisma.agendamento.findUnique({
            where: { id: parseInt(id) },
            include: { cliente: true }
        });

        if (!appointment) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        if (req.user.role === 'ADMIN' || appointment.cliente.userId === req.user.id) {
            req.appointment = appointment;
            next();
        } else {
            res.status(403).json({ error: AUTH.FORBIDDEN });
        }
    } catch (error) {
        console.error('Erro na verificação de permissão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * Middleware para verificar se o usuário tem as funções necessárias
 * @param {Array} roles - Array de funções permitidas
 * @returns {Function} Middleware function
 */
const authorizeRoles = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: AUTH.UNAUTHORIZED,
                message: 'Usuário não autenticado'
            });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: AUTH.FORBIDDEN,
                message: 'Você não tem permissão para acessar este recurso'
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    isAdmin,
    isOwnerOrAdmin
};
