const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Função auxiliar para obter estatísticas de agendamentos do mês
async function getMonthlyAppointmentStats() {
    try {
        console.log('Iniciando getMonthlyAppointmentStats');
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        
        console.log('Período do mês:', { firstDayOfMonth, lastDayOfMonth });
        
        // Primeiro, verifica se existem agendamentos no período
        const totalAgendamentos = await prisma.agendamentos.count({
            where: {
                startTime: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                }
            }
        });
        console.log(`Total de agendamentos no período: ${totalAgendamentos}`);
        
        if (totalAgendamentos === 0) {
            console.log('Nenhum agendamento encontrado no período');
            return {
                labels: ['Cancelados', 'Finalizados'],
                data: [0, 0],
                backgroundColor: ['#ff4d4d', '#4CAF50']
            };
        }
        
        // Busca os agendamentos agrupados por status
        const agendamentos = await prisma.agendamentos.groupBy({
            by: ['status'],
            where: {
                startTime: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                },
                status: {
                    in: ['CANCELADO', 'FINALIZADO', 'CONCLUIDO']
                }
            },
            _count: {
                _all: true
            }
        });
        
        console.log('Resultado da consulta agrupada:', JSON.stringify(agendamentos, null, 2));
        
        // Inicializa contadores
        let canceled = 0;
        let completed = 0;
        
        // Processa os resultados agrupados
        if (Array.isArray(agendamentos)) {
            agendamentos.forEach(item => {
                const status = item.status?.toUpperCase();
                const count = item._count?._all || 0;
                
                console.log(`Status: ${status}, Contagem: ${count}`);
                
                if (status === 'CANCELADO') {
                    canceled += count;
                } else if (status === 'FINALIZADO' || status === 'CONCLUIDO') {
                    completed += count;
                }
            });
        }
        
        console.log('Estatísticas mensais processadas:', { canceled, completed });
        
        return {
            labels: ['Cancelados', 'Finalizados'],
            data: [canceled, completed],
            backgroundColor: ['#ff4d4d', '#4CAF50']
        };
    } catch (error) {
        console.error('Erro em getMonthlyAppointmentStats:', error);
        return {
            labels: ['Cancelados', 'Finalizados'],
            data: [0, 0],
            backgroundColor: ['#ff4d4d', '#4CAF50']
        };
    }
}

// Função auxiliar para obter status de pagamento
async function getPaymentStatus() {
    try {
        console.log('Buscando status de pagamento...');
        
        // Obtém contagem de agendamentos por status
        const statusCounts = await prisma.agendamento.groupBy({
            by: ['status'],
            _count: true
        }).catch(error => {
            console.error('Erro ao buscar contagem de status:', error);
            return [];
        });
        
        console.log('Status encontrados:', statusCounts);
        
        // Mapeia os status para nomes mais amigáveis
        const statusMap = {
            'PENDING': 'Pendente',
            'CONFIRMED': 'Confirmado',
            'CANCELLED': 'Cancelado',
            'COMPLETED': 'Concluído'
        };
        
        // Inicializa um objeto com todos os status possíveis
        const result = {
            'Pendente': 0,
            'Confirmado': 0,
            'Cancelado': 0,
            'Concluído': 0
        };
        
        // Atualiza as contagens com os dados do banco
        if (Array.isArray(statusCounts)) {
            statusCounts.forEach(item => {
                try {
                    if (item && item.status) {
                        const statusName = statusMap[item.status] || item.status;
                        result[statusName] = item._count || 0;
                    }
                } catch (e) {
                    console.error('Erro ao processar status:', e);
                }
            });
        }
        
        // Converte para o formato esperado pelo frontend
        const formattedResult = Object.entries(result).map(([status, count]) => ({
            status,
            count
        }));
        
        console.log('Status de pagamento formatados:', formattedResult);
        return formattedResult;
        
    } catch (error) {
        console.error('Erro em getPaymentStatus:', error);
        return [];
    }
}

const dashboardController = {
    /**
     * Obtém as estatísticas do dashboard
     */
    async getDashboardStats(req, res) {
        console.log('Iniciando getDashboardStats');
        try {
            // Obtém a data de hoje para os cálculos
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Obtém o primeiro e último dia do mês atual
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
            
            console.log('Datas calculadas:', { today, firstDayOfMonth, lastDayOfMonth });
            
            // Inicializa os dados padrão
            const defaultStats = {
                success: true,
                data: {
                    totalClients: 0,
                    todayAgendamentos: 0,
                    monthlyRevenue: 0,
                    pendingAgendamentos: 0,
                    weeklyAgendamentos: {
                        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                        data: [0, 0, 0, 0, 0, 0, 0]
                    },
                    paymentStatus: [],
                    upcomingAgendamentos: []
                }
            };
            
            try {
                console.log('Iniciando consultas ao banco de dados');
                
                // Consultas em paralelo para melhor desempenho
                const [
                    totalClients,
                    todayAgendamentos,
                    monthlyRevenue,
                    pendingAgendamentos,
                    monthlyAppointmentStats,
                    paymentStatus,
                    upcomingAgendamentos
                ] = await Promise.all([
                    // Total de clientes ativos
                    prisma.cliente.count({ 
                        where: { status: 'ATIVO' } 
                    }).catch(e => {
                        console.error('Erro ao buscar total de clientes:', e);
                        return 0;
                    }),
                    
                    // Consultas de hoje
                    prisma.agendamentos.count({
                        where: {
                            startTime: {
                                gte: today,
                                lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                            }
                        }
                    }).then(count => {
                        console.log(`Encontrados ${count} agendamentos para hoje`);
                        return count;
                    }).catch(e => {
                        console.error('Erro ao buscar agendamentos de hoje:', e);
                        return 0;
                    }),
                    
                    // Faturamento mensal
                    prisma.agendamentos.aggregate({
                        where: {
                            status: 'COMPLETED',
                            startTime: {
                                gte: firstDayOfMonth,
                                lte: lastDayOfMonth
                            }
                        },
                        _sum: {
                            valor: true
                        }
                    }).then(result => {
                        const total = result._sum?.valor || 0;
                        console.log(`Faturamento mensal: R$ ${total.toFixed(2)}`);
                        return total;
                    }).catch(e => {
                        console.error('Erro ao calcular faturamento mensal:', e);
                        return 0;
                    }),
                    
                    // Agendamentos pendentes
                    prisma.agendamentos.count({
                        where: {
                            status: 'PENDING'
                        }
                    }).then(count => {
                        console.log(`Encontrados ${count} agendamentos pendentes`);
                        return count;
                    }).catch(e => {
                        console.error('Erro ao buscar agendamentos pendentes:', e);
                        return 0;
                    }),
                    
                    // Estatísticas mensais de agendamentos (cancelados e finalizados)
                    getMonthlyAppointmentStats(),
                    
                    // Status de pagamento
                    getPaymentStatus(),
                    
                    // Próximos agendamentos
                    prisma.agendamentos.findMany({
                        where: {
                            startTime: {
                                gte: today
                            }
                        },
                        orderBy: {
                            startTime: 'asc'
                        },
                        take: 5,
                        include: {
                            cliente: {
                                select: {
                                    nome: true,
                                    telefone: true
                                }
                            },
                            procedimento: {
                                select: {
                                    nome: true
                                }
                            }
                        }
                    }).then(appointments => {
                        console.log(`Encontrados ${appointments.length} próximos agendamentos`);
                        return appointments.map(apt => ({
                            id: apt.id,
                            title: apt.titulo || 'Consulta',
                            start: apt.startTime.toISOString(),
                            end: apt.endTime ? apt.endTime.toISOString() : null,
                            status: apt.status,
                            cliente: apt.cliente,
                            procedimento: apt.procedimento,
                            valor: apt.valor
                        }));
                    }).catch(e => {
                        console.error('Erro ao buscar próximos agendamentos:', e);
                        return [];
                    })
                ]);
                
                // Log dos dados para debug
                console.log('Dados do dashboard preparados:', {
                    totalClients: Number(totalClients) || 0,
                    todayAgendamentos: Number(todayAgendamentos) || 0,
                    monthlyRevenue: Number(monthlyRevenue) || 0,
                    pendingAgendamentos: Number(pendingAgendamentos) || 0,
                    monthlyAppointmentStats: monthlyAppointmentStats || {
                        labels: ['Cancelados', 'Finalizados'],
                        data: [0, 0],
                        backgroundColor: ['#ff4d4d', '#4CAF50']
                    },
                    paymentStatus: paymentStatus || [],
                    upcomingAgendamentos: upcomingAgendamentos || []
                });


// Formata a resposta final
const response = {
    success: true,
    data: {
        totalClients: Number(totalClients) || 0,
        todayAgendamentos: Number(todayAgendamentos) || 0,
        monthlyRevenue: Number(monthlyRevenue) || 0,
        pendingAgendamentos: Number(pendingAgendamentos) || 0,
        monthlyAppointmentStats: {
            labels: ['Cancelados', 'Finalizados'],
            data: [
                monthlyAppointmentStats?.data?.[0] || 0,
                monthlyAppointmentStats?.data?.[1] || 0
            ],
            backgroundColor: ['#ff4d4d', '#4CAF50']
        },
        paymentStatus: Array.isArray(paymentStatus) ? paymentStatus : [],
        upcomingAgendamentos: (Array.isArray(upcomingAgendamentos) ? upcomingAgendamentos : []).map(apt => ({
            id: apt.id || '0',
            title: apt.title || 'Consulta',
            start: apt.startTime ? new Date(apt.startTime).toISOString() : new Date().toISOString(),
            end: apt.endTime ? new Date(apt.endTime).toISOString() : null,
            status: apt.status || 'PENDING',
            cliente: apt.cliente || { nome: 'Cliente não informado' },
            procedimento: apt.procedimento || { nome: 'Procedimento não especificado' },
            valor: apt.valor || 0,
            clientEmail: apt.clientes?.email || 'Não informado'
        }))
    }
};

console.log('Resposta formatada:', JSON.stringify(response, null, 2));
return res.json(response);
            } catch (error) {
                console.error('Erro nas consultas do dashboard:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Erro ao processar as estatísticas do dashboard',
                    details: error.message,
                    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
                });
            }
            
        } catch (error) {
            console.error('Erro inesperado no getDashboardStats:', error);
            return res.status(500).json({
                success: false,
                error: 'Erro inesperado ao processar a requisição',
                details: error.message,
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        }
    },
    
    /**
     * Obtém o status de pagamento das consultas
     */
    getPaymentStatus,
    
    /**
     * Obtém as estatísticas de agendamentos do mês
     */
    getMonthlyAppointmentStats
};

module.exports = dashboardController;
