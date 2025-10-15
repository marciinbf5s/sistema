const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Cria um novo agendamento
 */
const criarAgendamento = async (req, res) => {
    try {
        const { 
            clienteId, 
            profissionalId, 
            procedimentoId, 
            convenioId, 
            valorCobrado, 
            startTime, 
            endTime, 
            observacoes 
        } = req.body;

        const agendamento = await prisma.agendamentos.create({
            data: {
                clienteId: parseInt(clienteId),
                profissionalId: profissionalId ? parseInt(profissionalId) : null,
                procedimentoId: parseInt(procedimentoId),
                convenioId: convenioId ? parseInt(convenioId) : null,
                valorCobrado: parseFloat(valorCobrado),
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                observacoes,
                status: 'AGENDADO', // Status padrão - deve corresponder ao enum no schema
                updatedAt: new Date() // Garante que o updatedAt seja definido
            },
            include: {
                clientes: true,
                profissionais: true,
                procedimentos: true,
                convenios: true
            }
        });

        res.status(201).json(agendamento);
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        res.status(400).json({ error: 'Não foi possível criar o agendamento', details: error.message });
    }
};

/**
 * Verifica a disponibilidade de horário
 */
const verificarDisponibilidade = async (req, res) => {
    try {
        const { profissionalId, dataInicio, dataFim } = req.query;
        
        // Verifica se já existe algum agendamento no mesmo horário
        const agendamentosExistentes = await prisma.agendamentos.findMany({
            where: {
                profissionalId: profissionalId ? parseInt(profissionalId) : undefined,
                OR: [
                    {
                        startTime: {
                            lt: new Date(dataFim)
                        },
                        endTime: {
                            gt: new Date(dataInicio)
                        }
                    }
                ],
                NOT: {
                    status: 'CANCELADO' // Não considerar agendamentos cancelados
                }
            },
            include: {
                clientes: {
                    select: { nome: true }
                }
            }
        });

        res.json({ disponivel: agendamentosExistentes.length === 0, conflitos: agendamentosExistentes });
    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        res.status(400).json({ error: 'Erro ao verificar disponibilidade', details: error.message });
    }
};

/**
 * Lista os agendamentos do usuário logado
 */
const listarMeusAgendamentos = async (req, res) => {
    try {
        const userId = req.user.id; // ID do usuário logado
        
        const agendamentos = await prisma.agendamentos.findMany({
            where: {
                OR: [
                    { cliente: { usuarioId: userId } },
                    { profissional: { usuarioId: userId } }
                ],
                NOT: {
                    status: 'CANCELADO' // Não mostrar agendamentos cancelados
                }
            },
            include: {
                clientes: {
                    select: { nome: true, telefone: true, email: true }
                },
                profissionais: {
                    select: { nome: true }
                },
                procedimentos: {
                    select: { nome: true, duracaoMinutos: true }
                },
                convenios: {
                    select: { nome: true }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        res.json(agendamentos);
    } catch (error) {
        console.error('Erro ao listar agendamentos:', error);
        res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
};

/**
 * Atualiza o status de um agendamento
 */
const atualizarStatusAgendamento = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Verifica se o status é válido
        const statusValidos = ['AGENDADO', 'CONFIRMADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO', 'FALTOU'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }

        const agendamento = await prisma.agendamentos.update({
            where: { id: parseInt(id) },
            data: { 
                status: status,
                updatedAt: new Date()
            },
            include: {
                clientes: {
                    select: { nome: true, telefone: true, email: true }
                },
                profissionais: {
                    select: { nome: true }
                }
            }
        });

        res.json(agendamento);
    } catch (error) {
        console.error('Erro ao atualizar status do agendamento:', error);
        res.status(400).json({ error: 'Erro ao atualizar status do agendamento' });
    }
};

/**
 * Cancela um agendamento
 */
const cancelarAgendamento = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verifica se o agendamento existe e se o usuário tem permissão
        const agendamento = await prisma.agendamentos.findUnique({
            where: { id: parseInt(id) },
            include: {
                clientes: {
                    select: { 
                        usuarioId: true,
                        nome: true
                    }
                }
            }
        });

        if (!agendamento) {
            return res.status(404).json({ error: 'Agendamento não encontrado' });
        }

        // Verifica se o usuário é o dono do agendamento ou um administrador
        if (agendamento.clientes.usuarioId !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Sem permissão para cancelar este agendamento' });
        }

        // Atualiza o status para CANCELADO em vez de deletar
        await prisma.agendamentos.update({
            where: { id: parseInt(id) },
            data: { 
                status: 'CANCELADO',
                updatedAt: new Date()
            }
        });

        res.status(204).send();
    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        res.status(400).json({ error: 'Erro ao cancelar agendamento', details: error.message });
    }
};

/**
 * Lista todos os agendamentos (apenas para administradores)
 */
const listarAgendamentos = async (req, res) => {
    try {
        const { data } = req.query;
        
        if (!data) {
            return res.status(400).json({ 
                success: false,
                error: 'Parâmetro "data" é obrigatório' 
            });
        }

        const startOfDay = new Date(data);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(data);
        endOfDay.setHours(23, 59, 59, 999);
        
        const agendamentos = await prisma.agendamentos.findMany({
            where: {
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay
                },
                NOT: [
                    { status: 'CANCELADO' },
                    { status: 'FINALIZADO' }
                ]
            },
            include: {
                clientes: {
                    select: { 
                        nome: true, 
                        telefone: true 
                    }
                },
                profissionais: {
                    select: { 
                        nome: true 
                    }
                },
                procedimentos: {
                    select: { 
                        name: true 
                    }
                },
                convenios: {
                    select: {
                        nome: true
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        res.json({
            success: true,
            data: agendamentos
        });
    } catch (error) {
        console.error('Erro ao listar agendamentos:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar agendamentos',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
/**
 * Busca agendamentos por período
 */
const buscarAgendamentosPorPeriodo = async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: 'Data de início e data de fim são obrigatórias' });
        }
        
        const agendamentos = await prisma.agendamentos.findMany({
            where: {
                startTime: {
                    gte: new Date(dataInicio),
                    lte: new Date(dataFim)
                },
                NOT: {
                    status: 'CANCELADO' // Não incluir agendamentos cancelados
                }
            },
            include: {
                clientes: {
                    select: { 
                        nome: true, 
                        telefone: true,
                        email: true
                    }
                },
                profissionais: {
                    select: { 
                        nome: true 
                    }
                },
                procedimentos: {
                    select: { 
                        nome: true,
                        duracaoMinutos: true
                    }
                },
                convenios: {
                    select: {
                        nome: true
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        res.json({
            success: true,
            data: agendamentos
        });
    } catch (error) {
        console.error('Erro ao buscar agendamentos por período:', error);
        res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
};
/**
 * Obtém um agendamento por ID
 */
const obterAgendamentoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        
        const agendamento = await prisma.agendamentos.findUnique({
            where: { id: parseInt(id) },
            include: {
                clientes: {
                    select: { 
                        id: true,
                        nome: true, 
                        telefone: true, 
                        email: true,
                        dataNascimento: true
                    }
                },
                profissionais: {
                    select: { 
                        id: true,
                        nome: true,
                        especialidade: true,
                        email: true,
                        telefone: true
                    }
                },
                procedimentos: {
                    select: { 
                        id: true,
                        nome: true,
                        duracaoMinutos: true,
                        valor: true,
                        descricao: true
                    }
                },
                convenios: {
                    select: {
                        id: true,
                        nome: true,
                        desconto: true,
                        telefone: true
                    }
                }
            }
        });

        if (!agendamento) {
            return res.status(404).json({ 
                success: false,
                error: 'Agendamento não encontrado' 
            });
        }

        res.json({
            success: true,
            data: agendamento
        });
    } catch (error) {
        console.error('Erro ao buscar agendamento:', error);
        res.status(500).json({ error: 'Erro ao buscar agendamento' });
    }
};

module.exports = {
    criarAgendamento,
    verificarDisponibilidade,
    listarMeusAgendamentos,
    atualizarStatusAgendamento,
    cancelarAgendamento,
    listarAgendamentos,
    buscarAgendamentosPorPeriodo,
    obterAgendamentoPorId
};
