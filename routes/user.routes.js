const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Rotas para gerenciamento de usuários (apenas admin)
router.get('/', authenticateToken, authorizeRoles(['ADMIN']), userController.listUsers);
router.get('/:id', authenticateToken, authorizeRoles(['ADMIN']), userController.getUserById);
router.post('/', authenticateToken, authorizeRoles(['ADMIN']), userController.createUser);
router.put('/:id', authenticateToken, authorizeRoles(['ADMIN']), userController.updateUser);
router.delete('/:id', authenticateToken, authorizeRoles(['ADMIN']), userController.deleteUser);

// Rotas para gerenciamento de permissões
router.get('/:id/permissions', authenticateToken, authorizeRoles(['ADMIN']), userController.getUserPermissions);
router.put('/:id/permissions', authenticateToken, authorizeRoles(['ADMIN']), userController.updateUserPermissions);

module.exports = router;
