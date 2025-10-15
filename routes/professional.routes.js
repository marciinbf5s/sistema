const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const { authenticateToken, isAdmin } = require('../middlewares/auth');

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Rotas de profissional
router.post('/', professionalController.createProfessional);

// Rota para listar os profissionais do usuário logado
router.get('/my-professionals', professionalController.listMyProfessionals);

// Rota para atualização de status
router.patch('/:id/status', professionalController.updateStatus);

// Rotas para um profissional específico
router.route('/:id')
    .get(professionalController.getProfessionalById)
    .put(professionalController.updateProfessional)  // Atualização completa
    .patch(professionalController.partialUpdateProfessional)  // Atualização parcial
    .delete(professionalController.deleteProfessional);

// Rota apenas para administradores - lista todos os profissionais do sistema
router.get('/', isAdmin, professionalController.listAllProfessionals);

module.exports = router;
