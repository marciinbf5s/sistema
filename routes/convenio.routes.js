const express = require('express');
const router = express.Router();
const convenioController = require('../controllers/convenioController');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// Rotas de convênio (leitura disponível para todos os usuários autenticados)
router.get('/', convenioController.listConvenios);
router.get('/:id', convenioController.getConvenioById);
router.get('/:id/procedimentos', convenioController.listProcedimentosPorConvenio);

// Rotas apenas para administradores
router.post('/', isAdmin, convenioController.createConvenio);
router.put('/:id', isAdmin, convenioController.updateConvenio);
router.delete('/:id', isAdmin, convenioController.deleteConvenio);

module.exports = router;
