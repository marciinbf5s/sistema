const express = require('express');
const router = express.Router();
const agendamentoController = require('../controllers/agendamentoController');
const { authenticateToken, isAdmin, isOwnerOrAdmin } = require('../middlewares/auth');

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Rotas de agendamento
router.post('/', agendamentoController.criarAgendamento);
router.get('/disponibilidade', agendamentoController.verificarDisponibilidade);
router.get('/meus-agendamentos', agendamentoController.listarMeusAgendamentos);
router.patch('/:id/status', isAdmin, agendamentoController.atualizarStatusAgendamento);
router.delete('/:id', isOwnerOrAdmin, agendamentoController.cancelarAgendamento);

// Rotas de busca de agendamentos
router.get('/', authenticateToken, agendamentoController.listarAgendamentos);
router.get('/por-periodo', authenticateToken, agendamentoController.buscarAgendamentosPorPeriodo);

// Rota para obter detalhes de um agendamento específico
router.get('/:id', agendamentoController.obterAgendamentoPorId);

module.exports = router;
