const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Função auxiliar para obter consultas da semana
async function getWeeklyAgendamentos() {
    try {
        console.log('Iniciando getWeeklyAgendamentos');
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo da semana atual
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado da semana atual
        endOfWeek.setHours(23, 59, 59, 999);
        
        console.log('Período da semana:', { startOfWeek, endOfWeek });
        
        // Busca os agendamentos da semana
        const agendamentos = await prisma.agendamentos.findMany({
            where: {
                startTime: {
                    gte: startOfWeek,
                    lte: endOfWeek
                }
            },
            select: {
                startTime: true
            }
        }).catch(error => {
            console.error('Erro ao buscar agendamentos semanais:', error);
            return [];
        });
        
        console.log(`Encontrados ${agendamentos?.length || 0} agendamentos na semana`);
        
        // Inicializa o array de contagem de consultas por dia
        const weeklyData = Array(7).fill(0);
        
        // Conta as consultas por dia da semana
        if (Array.isArray(agendamentos)) {
            agendamentos.forEach(agendamento => {
                try {
                    if (!agendamento?.startTime) return;
                    const dayOfWeek = new Date(agendamento.startTime).getDay(); // 0 = Domingo, 1 = Segunda, etc.
                    if (dayOfWeek >= 0 && dayOfWeek < 7) {
                        weeklyData[dayOfWeek]++;
                    }
                } catch (e) {
                    console.error('Erro ao processar agendamento:', e);
                }
            });
        }
        
        // Reorganiza o array para começar na segunda-feira
        const reorderedData = [
            ...weeklyData.slice(1), // Segunda a Sábado
            weeklyData[0] // Domingo
        ];
        
        console.log('Dados semanais processados:', { labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], data: reorderedData });
        
        return {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            data: reorderedData
        };
    } catch (error) {
        console.error('Erro em getWeeklyAgendamentos:', error);
        return {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            data: [0, 0, 0, 0, 0, 0, 0]
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
                    weeklyAgendamentos,
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
                            startTime: { 
                                gte: firstDayOfMonth, 
                                lte: lastDayOfMonth 
                            },
                            status: 'CONFIRMED'
                        },
                        _sum: { 
                            valorCobrado: true 
                        }
                    }).then(result => {
                        const total = Number(result._sum?.valorCobrado || 0);
                        console.log(`Faturamento mensal calculado: R$ ${total.toFixed(2)}`);
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
                        console.log(`Total de agendamentos pendentes: ${count}`);
                        return count;
                    }).catch(e => {
                        console.error('Erro ao buscar agendamentos pendentes:', e);
                        return 0;
                    }),
                    
                    // Dados semanais
                    getWeeklyAgendamentos().catch(e => {
                        console.error('Erro ao buscar consultas da semana:', e);
                        return defaultStats.data.weeklyAgendamentos;
                    }),
                    
                    // Status de pagamento
                    getPaymentStatus().catch(e => {
                        console.error('Erro ao buscar status de pagamento:', e);
                        return [];
                    }),
                    
                    // Próximos agendamentos
                    prisma.agendamentos.findMany({
                        where: {
                            startTime: { 
                                gte: today 
                            },
                            status: { 
                                in: ['CONFIRMED', 'PENDING'] 
                            }
                        },
                        orderBy: { 
                            startTime: 'asc' 
                        },
                        take: 5,
                        include: {
                            clientes: {
                                select: { 
                                    nome: true, 
                                    email: true, 
                                    telefone: true 
                                }
                            },
                            procedimentos: {
                                select: { 
                                    name: true, 
                                    durationMins: true, 
                                    defaultPrice: true 
                                }
                            }
                        }
                    }).then(agendamentos => {
                        console.log(`Encontrados ${agendamentos.length} próximos agendamentos`);
                        return agendamentos;
                    }).catch(e => {
                        console.error('Erro ao buscar próximos agendamentos:', e);
                        return [];
                    })
                ]);

                // Formata os dados para o frontend
                const response = {
                    success: true,
                    data: {
                        totalClients: Number(totalClients) || 0,
                        todayAgendamentos: Number(todayAgendamentos) || 0,
                        monthlyRevenue: Number(monthlyRevenue) || 0,
                        pendingAgendamentos: Number(pendingAgendamentos) || 0,
                        weeklyAgendamentos: weeklyAgendamentos || defaultStats.data.weeklyAgendamentos,
                        paymentStatus: Array.isArray(paymentStatus) ? paymentStatus : [],
                        upcomingAgendamentos: (Array.isArray(upcomingAgendamentos) ? upcomingAgendamentos : []).map(apt => {
                            console.log('Processando agendamento:', apt);
                            return {
                                id: apt.id || '0',
                                date: apt.startTime || new Date(),
                                client: apt.clientes?.nome || 'Cliente não encontrado',
                                service: apt.procedimentos?.name || 'Procedimento não especificado',
                                status: apt.status || 'PENDING',
                                duration: apt.procedimentos?.durationMins || 30,
                                price: apt.procedimentos?.defaultPrice || 0,
                                clientPhone: apt.clientes?.telefone || 'Não informado',
                                clientEmail: apt.clientes?.email || 'Não informado'
                            };
                        })
                    }
                };
                
                console.log('Dados formatados para o frontend:', JSON.stringify(response, null, 2));
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
     * Obtém as consultas da semana para o gráfico
     */
    getWeeklyAgendamentos,
    
    /**
     * Obtém o status de pagamento das consultas
     */
    getPaymentStatus
};

module.exports = dashboardController;
