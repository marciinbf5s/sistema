const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/auth');

// Rota de registro
router.post('/register', authController.register);

// Rota de login
router.post('/login', authController.login);

// Rota para obter dados do usuário autenticado
router.get('/me', authenticateToken, authController.getMe);

// Rota para validar um token JWT
router.get('/validate-token', authenticateToken, authController.validateToken);

module.exports = router;
