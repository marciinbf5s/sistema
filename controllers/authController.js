const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../database/connect');
const { AUTH, USER } = require('../constants/messages');

const authController = {
    /**
     * Registra um novo usuário
     */
    async register(req, res) {
        try {
            const { name, email, password, role = 'USER' } = req.body;

            // Verifica se o usuário já existe
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return res.status(400).json({ error: AUTH.USER_EXISTS });
            }

            // Hash da senha
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Cria o usuário
            const user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: role.toUpperCase()
                }
            });

            // Remove a senha do retorno
            const { password: _, ...userWithoutPassword } = user;

            res.status(201).json({
                message: AUTH.REGISTRATION_SUCCESS,
                user: userWithoutPassword
            });
        } catch (error) {
            console.error('Erro no registro:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Realiza o login do usuário
     */
    async login(req, res) {
        try {
            console.log('Login attempt with data:', req.body);
            const { email, password } = req.body;

            if (!email || !password) {
                console.log('Missing email or password');
                return res.status(400).json({ error: 'Email e senha são obrigatórios' });
            }

            // Encontra o usuário pelo email
            const user = await prisma.user.findUnique({ 
                where: { email },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    password: true,
                    role: true
                }
            });
            
            console.log('User found in database:', user ? 'Yes' : 'No');
            
            if (!user) {
                console.log('User not found with email:', email);
                return res.status(400).json({ error: AUTH.INVALID_CREDENTIALS });
            }

            // Verifica a senha
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ error: AUTH.INVALID_CREDENTIALS });
            }

            // Cria o token JWT
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            // Remove a senha do retorno
            const { password: _, ...userWithoutPassword } = user;

            res.json({
                message: AUTH.LOGIN_SUCCESS,
                token,
                user: userWithoutPassword
            });
        } catch (error) {
            console.error('Erro no login:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Retorna os dados do usuário autenticado
     */
    async getMe(req, res) {
        try {
            // O middleware authenticateToken já adicionou o usuário ao objeto req
            const user = req.user;
            
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            // Busca os dados completos do usuário (sem a senha)
            const userData = await prisma.user.findUnique({
                where: { id: user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            
            res.json(userData);
        } catch (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
        }
    },
    
    /**
     * Valida um token JWT
     */
    async validateToken(req, res) {
        try {
            // Se o middleware authenticateToken chegou até aqui, o token é válido
            res.json({ 
                valid: true,
                user: req.user
            });
        } catch (error) {
            console.error('Erro ao validar token:', error);
            res.status(500).json({ 
                valid: false,
                error: 'Erro ao validar token'
            });
        }
    }
};

module.exports = authController;
