const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// Rotas de serviço (leitura disponível para todos os usuários autenticados)
router.get('/', serviceController.listServices);
router.get('/:id', serviceController.getServiceById);

// Rotas apenas para administradores
router.post('/', isAdmin, serviceController.createService);
router.put('/:id', isAdmin, serviceController.updateService);
router.delete('/:id', isAdmin, serviceController.deleteService);

module.exports = router;
