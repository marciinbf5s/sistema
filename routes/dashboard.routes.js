const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/auth');

// Rota para obter as estatísticas do dashboard
router.get('/stats', authenticateToken, dashboardController.getDashboardStats);

module.exports = router;
