const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// Rotas de cliente
router.post('/', clientController.createClient);

// Rota para listar os clientes do usuário logado
router.get('/my-clients', clientController.listMyClients);

// Rotas para um cliente específico
router.get('/:id', clientController.getClientById);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

// Rota apenas para administradores - lista todos os clientes do sistema
router.get('/', isAdmin, clientController.listAllClients);

module.exports = router;
