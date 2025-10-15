const express = require('express');
const router = express.Router();
const procedimentoController = require('../controllers/procedimentoController');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

// Todas as rotas exigem autenticação
router.use(authenticateToken);

// Rotas de procedimento (leitura disponível para todos os usuários autenticados)
router.get('/', procedimentoController.listProcedimentos);
router.get('/:id', procedimentoController.getProcedimentoById);

// Rotas apenas para administradores
router.post('/', isAdmin, procedimentoController.createProcedimento);
router.put('/:id', isAdmin, procedimentoController.updateProcedimento);
router.delete('/:id', isAdmin, procedimentoController.deleteProcedimento);

// Rotas para gerenciar valores de convênios
router.post('/:procedimentoId/convenios/:convenioId', isAdmin, procedimentoController.atualizarValorConvenio);
router.delete('/:procedimentoId/convenios/:convenioId', isAdmin, procedimentoController.removerValorConvenio);

module.exports = router;
