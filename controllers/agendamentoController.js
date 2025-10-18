const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty'
});

/**
 * Middleware para validar se a data do agendamento não está no passado
 * @param {Date} dateTime - Data e hora do agendamento
 * @returns {Object} - Objeto com validação e mensagem de erro (se houver)
 */
const validarDataAgendamento = (dateTime) => {
    const agora = new Date();
    
    // Remover segundos e milissegundos para comparação
    agora.setSeconds(0, 0);
    
    if (new Date(dateTime) < agora) {
        return {
            valido: false,
            mensagem: 'Não é possível agendar para uma data/hora que já passou.'
        };
    }
    
    return { valido: true };
};

// Add error handling for Prisma client
prisma.$on('error', (e) => {
  console.error('Prisma Client Error:', e);
});

// Handle process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Test the database connection when the controller loads
(async () => {
  try {
    await prisma.$connect();
    console.log('✅ Prisma Client connected to the database');
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
  }
})();

/**
 * Cria um novo agendamento
 */
const criarAgendamento = async (req, res) => {
    try {
        console.log('Recebendo criarAgendamento - headers:', {
            host: req.headers.host,
            origin: req.headers.origin,
            authorization: req.headers.authorization ? '[REDACTED]' : undefined
        });
        console.log('Recebendo criarAgendamento - body:', req.body);

        const { 
            clienteId, 
            profissionalId, 
            procedimentoId, 
            convenioId, 
            valorCobrado, 
            startTime, 
            endTime, 
            observacoes,
            data: dataRaw,
            horaInicio: horaInicioRaw
        } = req.body;

        // Função para converter a string recebida para Date sem alterar o valor
        // Nota: aqui NÃO ajustamos/subtraímos o timezone — vamos armazenar o instante que o cliente enviou.
        // Se o cliente enviar uma string com timezone (ex: '...Z' ou '+03:00'), ela será interpretada com esse timezone.
        // Se enviar sem timezone, será interpretada pelo Node como local do servidor.
        const ajustarData = (dataString) => {
            if (!dataString) return null;
            const data = new Date(dataString);
            if (isNaN(data.getTime())) return null;
            return data;
        };

        // Validações básicas e mensagens claras para o cliente
        const missing = [];
        if (clienteId === undefined || clienteId === null || clienteId === '') missing.push('clienteId');
        if (procedimentoId === undefined || procedimentoId === null || procedimentoId === '') missing.push('procedimentoId');
        if (!startTime) missing.push('startTime');
        if (!endTime) missing.push('endTime');

        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Campos obrigatórios faltando: ${missing.join(', ')}`,
                received: { clienteId, procedimentoId, startTime, endTime }
            });
        }

        // Validar datas
        const dataInicio = ajustarData(startTime);
        const dataFim = ajustarData(endTime);
        const agora = new Date();

        if (!dataInicio) {
            return res.status(400).json({ success: false, error: 'Data/hora de início inválida', receivedStartTime: startTime });
        }
              
        if (!dataFim || dataFim <= dataInicio) {
            return res.status(400).json({ success: false, error: 'Data/hora de término inválida ou anterior à data de início', received: { startTime, endTime } });
        }

        // Validar se a data não está no passado
        const validacaoData = validarDataAgendamento(startTime);
        if (!validacaoData.valido) {
            return res.status(400).json({
                success: false,
                error: validacaoData.mensagem,
                receivedStartTime: startTime,
                now: new Date().toISOString()
            });
        }

        // Preparar valores numéricos com checagem
        const clienteIdNum = parseInt(clienteId);
        const procedimentoIdNum = parseInt(procedimentoId);
        const profissionalIdNum = profissionalId ? parseInt(profissionalId) : null;
        const convenioIdNum = convenioId ? parseInt(convenioId) : null;
        const valorCobradoNum = valorCobrado !== undefined && valorCobrado !== null && valorCobrado !== '' ? parseFloat(valorCobrado) : 0;

        if (isNaN(clienteIdNum) || isNaN(procedimentoIdNum)) {
            return res.status(400).json({ success: false, error: 'IDs inválidos (clienteId/procedimentoId)', received: { clienteId, procedimentoId } });
        }

        try {
            // Verifica se o procedimento existe e recupera informações para retorno
            let procedimentoEncontrado = null;
            try {
                procedimentoEncontrado = await prisma.procedimentos.findUnique({ where: { id: procedimentoIdNum } });
            } catch (errFind) {
                console.error('Erro ao buscar procedimento para validação:', errFind);
            }

            console.log('Validando procedimento recebido:', { procedimentoIdNum, encontrado: !!procedimentoEncontrado, procedimento: procedimentoEncontrado ? { id: procedimentoEncontrado.id, name: procedimentoEncontrado.name || procedimentoEncontrado.nome } : null });

            if (!procedimentoEncontrado) {
                return res.status(400).json({ success: false, error: 'Procedimento não encontrado', procedimentoId: procedimentoIdNum });
            }

            const agendamento = await prisma.agendamentos.create({
                data: {
                    clienteId: clienteIdNum,
                    profissionalId: profissionalIdNum,
                    procedimentoId: procedimentoIdNum,
                    convenioId: convenioIdNum,
                    valorCobrado: valorCobradoNum,
                    startTime: dataInicio,
                    endTime: dataFim,
                    observacoes: observacoes || null,
                    status: 'AGENDADO',
                    updatedAt: new Date()
                },
                include: {
                    clientes: true,
                    profissionais: true,
                    procedimentos: true,
                    convenios: true
                }
            });

            // Anexar os campos de wall-clock recebidos (se houver) e garantir nome do procedimento na resposta
            const agendamentoComCampos = {
                ...agendamento,
                data: dataRaw || (dataInicio ? dataInicio.toISOString().split('T')[0] : null),
                horaInicio: horaInicioRaw || (dataInicio ? dataInicio.toISOString().split('T')[1].split('.')[0].slice(0,5) : null),
                procedimentoNome: procedimentoEncontrado.name || procedimentoEncontrado.nome || (agendamento.procedimentos ? (agendamento.procedimentos.name || agendamento.procedimentos.nome) : null)
            };

            console.log('Agendamento criado com sucesso:', { id: agendamento.id, procedimentoId: procedimentoIdNum, procedimentoNome: agendamentoComCampos.procedimentoNome, data: agendamentoComCampos.data, horaInicio: agendamentoComCampos.horaInicio });
            return res.status(201).json({ success: true, data: agendamentoComCampos });
        } catch (prismaError) {
            console.error('Prisma error ao criar agendamento:', prismaError);
            // Retornar detalhes em development
            return res.status(500).json({ success: false, error: 'Erro ao criar agendamento no banco de dados', details: prismaError.message });
        }

    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        return res.status(500).json({ error: 'Erro interno ao processar a requisição', details: error.message });
    }
};

/**
 * Verifica a disponibilidade de horário
 */
const verificarDisponibilidade = async (req, res) => {
    try {
        const { profissionalId, dataInicio, dataFim } = req.query;
        
        // Função para converter string de data para objeto Date
        const parseDate = (dateString) => {
            // Tenta converter a string de data para um objeto Date
            let date = new Date(dateString);
            
            // Se a conversão resultar em uma data inválida, tenta formatos alternativos
            if (isNaN(date.getTime())) {
                // Tenta remover o deslocamento de fuso horário e converter
                const isoString = dateString.replace(/[+-]\d{2}:\d{2}$/, '');
                date = new Date(isoString);
                
                // Se ainda for inválido, tenta com o formato ISO 8601 básico
                if (isNaN(date.getTime())) {
                    const basicIsoString = dateString.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})?/, '$1T$2Z');
                    date = new Date(basicIsoString);
                }
            }
            
            if (isNaN(date.getTime())) {
                console.error('Não foi possível converter a data:', dateString);
                throw new Error('Formato de data inválido');
            }
            
            return date;
        };

        // Converter as datas para objetos Date
        const dataInicioAjustada = parseDate(dataInicio);
        const dataFimAjustada = parseDate(dataFim);
        
        console.log('Verificando disponibilidade:', {
            profissionalId,
            dataInicio: dataInicioAjustada.toISOString(),
            dataFim: dataFimAjustada.toISOString(),
            agendamentoId: req.query.agendamentoId || null
        });

        // Construir o objeto de consulta base
        const whereClause = {
            OR: [
                {
                    // Verifica se o novo agendamento começa durante um existente
                    startTime: { lt: dataFimAjustada },
                    endTime: { gt: dataInicioAjusteda }
                },
                {
                    // Verifica se o novo agendamento termina durante um existente
                    startTime: { lt: dataFimAjustada },
                    endTime: { gt: dataInicioAjustada }
                },
                {
                    // Verifica se o novo agendamento contém um existente
                    startTime: { gte: dataInicioAjustada },
                    endTime: { lte: dataFimAjustada }
                }
            ],
            status: {
                not: 'CANCELADO' // Não considerar agendamentos cancelados
            }
        };

        // Adicionar filtro de profissional se fornecido
        if (profissionalId && profissionalId !== 'null' && profissionalId !== 'undefined') {
            whereClause.profissionalId = parseInt(profissionalId);
        } else {
            // Se não houver profissional, verificar conflitos apenas com agendamentos sem profissional
            whereClause.profissionalId = null;
        }

        // Se for uma edição, não considerar o próprio agendamento
        if (req.query.agendamentoId) {
            const agendamentoId = parseInt(req.query.agendamentoId);
            if (!isNaN(agendamentoId) && agendamentoId > 0) {
                whereClause.NOT = whereClause.NOT || {};
                whereClause.NOT.id = agendamentoId;
                console.log('Excluindo agendamento atual da verificação:', agendamentoId);
            }
        }

        // Verifica se já existe algum agendamento no mesmo horário
        const agendamentosExistentes = await prisma.agendamentos.findMany({
            where: whereClause,
            include: {
                clientes: {
                    select: { nome: true }
                },
                procedimentos: {
                    select: { name: true }
                }
            }
        });

        res.json({ 
            disponivel: agendamentosExistentes.length === 0, 
            conflitos: agendamentosExistentes.map(ag => ({
                ...ag,
                // Converter para string ISO para garantir que o cliente veja exatamente o que está no banco
                startTime: ag.startTime.toISOString(),
                endTime: ag.endTime.toISOString()
            }))
        });
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
                status: {
                    not: 'CANCELADO' // Não mostrar agendamentos cancelados
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
 * Atualiza um agendamento (edição)
 */
const atualizarAgendamento = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};

        console.log('Iniciando atualizarAgendamento - id:', id);
        console.log('Payload recebido (tipos):', Object.keys(body).reduce((acc, k) => { acc[k] = typeof body[k]; return acc; }, {}));
        console.log('Payload recebido (amostra):', JSON.stringify(body).slice(0, 1000));

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ success: false, error: 'ID inválido' });
        }

        // Campos que podem ser atualizados (validação limpa)
        const updatable = {};

        const safeParseInt = (v) => {
            if (v === null || v === undefined || v === '') return null;
            const n = parseInt(v);
            return isNaN(n) ? null : n;
        };

        if (body.clienteId !== undefined) {
            const n = safeParseInt(body.clienteId);
            if (n === null) return res.status(400).json({ success: false, error: 'clienteId inválido' });
            updatable.clienteId = n;
        }

        if (body.profissionalId !== undefined) {
            if (body.profissionalId === null || body.profissionalId === 'null' || body.profissionalId === '') {
                updatable.profissionalId = null;
            } else {
                const n = safeParseInt(body.profissionalId);
                if (n === null) return res.status(400).json({ success: false, error: 'profissionalId inválido' });
                updatable.profissionalId = n;
            }
        }

        if (body.procedimentoId !== undefined) {
            const n = safeParseInt(body.procedimentoId);
            if (n === null) return res.status(400).json({ success: false, error: 'procedimentoId inválido' });
            updatable.procedimentoId = n;
        }

        if (body.convenioId !== undefined) {
            if (body.convenioId === null || body.convenioId === 'null' || body.convenioId === '') {
                updatable.convenioId = null;
            } else {
                const n = safeParseInt(body.convenioId);
                if (n === null) return res.status(400).json({ success: false, error: 'convenioId inválido' });
                updatable.convenioId = n;
            }
        }

        if (body.valorCobrado !== undefined) {
            const v = parseFloat(body.valorCobrado);
            if (isNaN(v)) return res.status(400).json({ success: false, error: 'valorCobrado inválido' });
            updatable.valorCobrado = v;
        }

        const safeParseDate = (v) => {
            if (!v) return null;
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
        };

        if (body.startTime !== undefined) {
            const d = safeParseDate(body.startTime);
            if (!d) {
                console.warn('startTime fornecido é inválido:', body.startTime);
                return res.status(400).json({ success: false, error: 'startTime inválido', received: body.startTime });
            }
            updatable.startTime = d;
        }

        if (body.endTime !== undefined) {
            const d2 = safeParseDate(body.endTime);
            if (!d2) {
                console.warn('endTime fornecido é inválido:', body.endTime);
                return res.status(400).json({ success: false, error: 'endTime inválido', received: body.endTime });
            }
            updatable.endTime = d2;
        }

        if (body.observacoes !== undefined) updatable.observacoes = body.observacoes;
        if (body.status !== undefined) updatable.status = body.status;
        updatable.updatedAt = new Date();

        const existing = await prisma.agendamentos.findUnique({ where: { id: parseInt(id) } });
        if (!existing) return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

        // Se procedimentoId foi alterado, verificar existência
        if (updatable.procedimentoId) {
            const proc = await prisma.procedimentos.findUnique({ where: { id: updatable.procedimentoId } });
            if (!proc) return res.status(400).json({ success: false, error: 'Procedimento não encontrado' });
        }

        let updated;
        try {
            updated = await prisma.agendamentos.update({
            where: { id: parseInt(id) },
            data: updatable,
            include: {
                clientes: true,
                profissionais: true,
                procedimentos: true,
                convenios: true
            }
            });
        } catch (prismaErr) {
            console.error('Erro Prisma ao atualizar agendamento:', { message: prismaErr.message, code: prismaErr.code, stack: prismaErr.stack });
            // Fornecer detalhes em ambiente de desenvolvimento para facilitar debug
            return res.status(500).json({ success: false, error: 'Erro no banco ao atualizar agendamento', details: process.env.NODE_ENV === 'development' ? prismaErr.message : undefined });
        }

        const dataField = body.data || (updated.startTime ? updated.startTime.toISOString().split('T')[0] : null);
        const horaInicioField = body.horaInicio || (updated.startTime ? updated.startTime.toISOString().split('T')[1].split('.')[0].slice(0,5) : null);

        return res.json({ success: true, data: { ...updated, data: dataField, horaInicio: horaInicioField } });
    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        return res.status(500).json({ success: false, error: 'Erro interno ao atualizar agendamento', details: error.message });
    }
};

/**
 * Cancela um agendamento
 */
const cancelarAgendamento = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verifica se o agendamento existe
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

        // Log para depuração
        console.log('Usuário logado - ID:', req.user.id, 'Tipo:', typeof req.user.id);
        console.log('Dono do agendamento - ID:', agendamento.clientes?.usuarioId, 'Tipo:', typeof agendamento.clientes?.usuarioId);
        console.log('É admin?', req.user.role === 'ADMIN');

        // Verifica se o usuário é um administrador
        if (req.user.role === 'ADMIN') {
            console.log('Acesso permitido: usuário é administrador');
        } else {
            // Verifica se o usuário é o dono do agendamento
            if (String(req.user.id) !== String(agendamento.clientes?.usuarioId)) {
                console.log('Acesso negado: usuário não é o dono do agendamento');
                return res.status(403).json({ 
                    error: 'Sem permissão para cancelar este agendamento',
                    details: 'Você só pode cancelar seus próprios agendamentos.'
                });
            }
            console.log('Acesso permitido: usuário é o dono do agendamento');
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
    console.log('Recebida requisição para listar agendamentos com query:', req.query);
    
    try {
        const { data, start, end } = req.query;

        // Se o frontend enviar start/end explicitos (ISO instants), usá-los diretamente
        let startOfDay, endOfDay;
        try {
            if (start && end) {
                startOfDay = new Date(start);
                endOfDay = new Date(end);

                if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
                    throw new Error('Parâmetros start/end inválidos');
                }

                console.log('Período de busca recebido diretamente (start/end):', {
                    inicio: startOfDay.toISOString(),
                    fim: endOfDay.toISOString(),
                    inicioLocal: startOfDay.toString(),
                    fimLocal: endOfDay.toString()
                });
            } else if (data) {
                // Espera data no formato YYYY-MM-DD (representando o dia no fuso do usuário)
                const parts = data.split('-');
                if (parts.length !== 3) throw new Error('Formato de data inválido');
                const [yearStr, monthStr, dayStr] = parts;
                const year = parseInt(yearStr, 10);
                const month = parseInt(monthStr, 10) - 1;
                const day = parseInt(dayStr, 10);

                if (isNaN(year) || isNaN(month) || isNaN(day)) throw new Error('Partes da data inválidas');

                // Construir início e fim do dia usando componentes (sem ajustar timezone manualmente)
                startOfDay = new Date(year, month, day, 0, 0, 0, 0);
                endOfDay = new Date(year, month, day, 23, 59, 59, 999);

                console.log('Período de busca construído a partir de data:', {
                    data,
                    inicio: startOfDay.toISOString(),
                    fim: endOfDay.toISOString(),
                    inicioLocal: startOfDay.toString(),
                    fimLocal: endOfDay.toString()
                });
            } else {
                console.error('Erro: Parâmetro "data" ou "start"/"end" não fornecido');
                return res.status(400).json({ 
                    success: false,
                    error: 'Parâmetro "data" ou "start"/"end" é obrigatório' 
                });
            }
        } catch (error) {
            console.error('Erro ao processar datas:', error);
            return res.status(400).json({
                success: false,
                error: 'Formato de data inválido. Use o formato YYYY-MM-DD ou parâmetros start/end em ISO.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }

        try {
            console.log('Iniciando consulta ao banco de dados...');
            const agendamentos = await prisma.agendamentos.findMany({
                where: {
                    startTime: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                },
                include: {
                    clientes: {
                        select: { 
                            id: true,
                            nome: true, 
                            telefone: true 
                        }
                    },
                    profissionais: {
                        select: {
                            id: true,
                            nome: true
                        }
                    },
                    procedimentos: {
                        select: {
                            id: true,
                            name: true,
                            durationMins: true
                        }
                    },
                    convenios: {
                        select: {
                            id: true,
                            nome: true
                        }
                    }
                },
                orderBy: {
                    startTime: 'asc'
                }
            });

            console.log(`Encontrados ${agendamentos.length} agendamentos`);

            // Se não houver agendamentos, retornar array vazio
            if (!agendamentos || agendamentos.length === 0) {
                return res.status(200).json([]);
            }

            // Formatar os dados de saída para o formato esperado pelo frontend
            const agendamentosFormatados = agendamentos.map(agendamento => {
                try {
                    // Calcular duração em minutos
                    const duracaoMinutos = agendamento.procedimentos?.durationMins || 30;
                    
                    // Formatar dados do cliente
                    const cliente = agendamento.clientes ? {
                        id: agendamento.clientes.id,
                        nome: agendamento.clientes.nome,
                        telefone: agendamento.clientes.telefone || 'Não informado'
                    } : null;

                    // Formatar dados do procedimento
                    const procedimento = agendamento.procedimentos ? {
                        id: agendamento.procedimentos.id,
                        name: agendamento.procedimentos.name,
                        duracaoMinutos: duracaoMinutos
                    } : null;

                    // Formatar dados do profissional
                    const profissional = agendamento.profissionais ? {
                        id: agendamento.profissionais.id,
                        nome: agendamento.profissionais.nome
                    } : null;

                    // Criar objeto formatado
                    const formatted = {
                        id: agendamento.id,
                        cliente: cliente,
                        procedimento: procedimento,
                        profissional: profissional,
                        profissionalId: profissional?.id || null,
                        data: agendamento.startTime.toISOString().split('T')[0],
                        horaInicio: agendamento.startTime.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false
                        }),
                        duracao: duracaoMinutos,
                        status: agendamento.status,
                        observacoes: agendamento.observacoes || '',
                        // Campos adicionais para compatibilidade
                        startTime: agendamento.startTime.toISOString(),
                        endTime: agendamento.endTime.toISOString(),
                        dataFormatada: agendamento.startTime.toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                        })
                    };

                    return formatted;
                } catch (error) {
                    console.error('Erro ao formatar agendamento:', {
                        agendamento,
                        error: error.message
                    });
                    return null;
                }
            }).filter(Boolean); // Remove entradas nulas

            console.log('Agendamentos formatados com sucesso');
            return res.json({
                success: true,
                data: agendamentosFormatados
            });

        } catch (dbError) {
            console.error('Erro na consulta ao banco de dados:', {
                message: dbError.message,
                stack: dbError.stack,
                query: {
                    startTime: startOfDay,
                    endTime: endOfDay
                }
            });
            throw dbError;
        }
    } catch (error) {
        console.error('Erro ao listar agendamentos:', {
            message: error.message,
            stack: error.stack,
            query: req.query,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar agendamentos',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
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
            return res.status(400).json({ 
                success: false,
                error: 'Data de início e data de fim são obrigatórias' 
            });
        }
        
        // Função para validar e ajustar data
        const ajustarData = (dataString) => {
            if (!dataString) return null;
            
            const data = new Date(dataString);
            if (isNaN(data.getTime())) {
                throw new Error('Data inválida fornecida');
            }
            
            // Ajusta para o fuso horário local sem alterar o horário
            return new Date(data.getTime() - (data.getTimezoneOffset() * 60000));
        };
        
        // Validar e ajustar as datas
        const dataInicioAjustada = ajustarData(dataInicio);
        const dataFimAjustada = ajustarData(dataFim);
        
        if (!dataInicioAjustada || !dataFimAjustada) {
            return res.status(400).json({
                success: false,
                error: 'Datas fornecidas são inválidas'
            });
        }
        
        console.log('Buscando agendamentos no período:', {
            inicio: dataInicioAjustada.toISOString(),
            fim: dataFimAjustada.toISOString(),
            timezoneOffset: new Date().getTimezoneOffset()
        });
        
        // Primeiro, buscar os agendamentos básicos
        const agendamentos = await prisma.agendamentos.findMany({
            where: {
                startTime: {
                    gte: dataInicioAjustada,
                    lte: dataFimAjustada
                },
                status: {
                    not: 'CANCELADO' // Não incluir agendamentos cancelados
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        });

        // Buscar os relacionamentos em paralelo para melhor desempenho
        const agendamentosComRelacionamentos = await Promise.all(
            agendamentos.map(async (agendamento) => {
                try {
                    const [cliente, profissional, procedimento, convenio] = await Promise.all([
                        prisma.clientes.findUnique({
                            where: { id: agendamento.clienteId },
                            select: { nome: true, telefone: true, email: true }
                        }),
                        agendamento.profissionalId ? 
                            prisma.profissionais.findUnique({
                                where: { id: agendamento.profissionalId },
                                select: { nome: true, id: true }
                            }) : 
                            Promise.resolve(null),
                        prisma.procedimentos.findUnique({
                            where: { id: agendamento.procedimentoId },
                            select: { name: true, duracaoMinutos: true, id: true }
                        }),
                        agendamento.convenioId ?
                            prisma.convenios.findUnique({
                                where: { id: agendamento.convenioId },
                                select: { nome: true, id: true }
                            }) :
                            Promise.resolve(null)
                    ]);

                    // Formatar as datas para exibição consistente
                    const startTime = agendamento.startTime ? new Date(agendamento.startTime) : null;
                    const endTime = agendamento.endTime ? new Date(agendamento.endTime) : null;
                    
                    const profissionalObj = profissional || { nome: 'Não atribuído', id: null };
                    
                    return {
                        ...agendamento,
                        // Incluir o ID do profissional no objeto principal
                        profissionalId: profissionalObj.id,
                        // Relacionamentos
                        cliente: cliente || { nome: 'Cliente não encontrado', telefone: '', email: '' },
                        profissional: profissionalObj,
                        procedimento: procedimento || { name: 'Procedimento não encontrado', duracaoMinutos: 30, id: null },
                        convenio: convenio || { nome: 'Particular', id: null },
                        
                        // Manter as datas originais do banco
                        startTime: startTime ? startTime.toISOString() : null,
                        endTime: endTime ? endTime.toISOString() : null,
                        
                        // Campos formatados para exibição
                        dataFormatada: startTime ? startTime.toLocaleDateString('pt-BR') : 'Data não disponível',
                        horaInicio: startTime ? startTime.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit'
                        }) : '--:--',
                        horaFim: endTime ? endTime.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit'
                        }) : '--:--',
                        
                        // Campos adicionais para compatibilidade
                        clienteNome: cliente?.nome || 'Cliente não encontrado',
                        clienteTelefone: cliente?.telefone || '',
                        procedimentoNome: procedimento?.name || 'Procedimento não encontrado',
                        duracao: procedimento?.duracaoMinutos || 30
                    };
                } catch (error) {
                    console.error(`Erro ao processar agendamento ${agendamento.id}:`, error);
                    return {
                        ...agendamento,
                        error: 'Erro ao carregar dados do agendamento',
                        startTime: agendamento.startTime ? new Date(agendamento.startTime).toISOString() : null,
                        endTime: agendamento.endTime ? new Date(agendamento.endTime).toISOString() : null,
                        cliente: { nome: 'Erro ao carregar', telefone: '', email: '' },
                        profissional: { nome: 'Erro ao carregar', id: null },
                        procedimento: { name: 'Erro ao carregar', duracaoMinutos: 30, id: null },
                        convenio: { nome: 'Erro ao carregar', id: null },
                        dataFormatada: agendamento.startTime ? new Date(agendamento.startTime).toLocaleDateString('pt-BR') : '--/--/----',
                        horaInicio: agendamento.startTime ? new Date(agendamento.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                        horaFim: agendamento.endTime ? new Date(agendamento.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                        clienteNome: 'Erro ao carregar',
                        clienteTelefone: '',
                        procedimentoNome: 'Erro ao carregar',
                        duracao: 30
                    };
                }
            })
        );

        // Filtrar possíveis erros e ordenar por data/hora
        const agendamentosValidos = agendamentosComRelacionamentos.filter(a => !a.error);
        const agendamentosComErro = agendamentosComRelacionamentos.filter(a => a.error);

        // Ordenar agendamentos por data/hora de início
        agendamentosValidos.sort((a, b) => {
            const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
            const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
            return dateA - dateB;
        });

        // Juntar agendamentos válidos e com erro (os com erro ficam no final)
        const resultadoFinal = [...agendamentosValidos, ...agendamentosComErro];

        res.json({
            success: true,
            data: resultadoFinal,
            metadata: {
                total: resultadoFinal.length,
                comErro: agendamentosComErro.length,
                dataInicio: dataInicioAjustada.toISOString(),
                dataFim: dataFimAjustada.toISOString()
            }
        });
    } catch (error) {
        console.error('Erro ao buscar agendamentos por período:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            name: error.name,
            query: req.query,
            timestamp: new Date().toISOString()
        });
        
        // Verifica se é um erro de validação do Prisma
        if (error.code === 'P2002' || error.code === 'P2003' || error.code === 'P2025') {
            return res.status(400).json({
                success: false,
                error: 'Erro de validação nos dados fornecidos',
                details: error.meta || error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro interno ao processar a requisição',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
/**
 * Obtém um agendamento por ID
 */
/**
 * Obtém um agendamento por ID
 */
const obterAgendamentoPorId = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validar se o ID é um número
        if (isNaN(parseInt(id))) {
            return res.status(400).json({ 
                success: false,
                error: 'ID do agendamento inválido' 
            });
        }

        console.log(`Buscando agendamento com ID: ${id}`);
        
        // Primeiro, buscar apenas os dados básicos do agendamento
        const agendamento = await prisma.agendamentos.findUnique({
            where: { id: parseInt(id) }
        });

        if (!agendamento) {
            console.log(`Agendamento com ID ${id} não encontrado`);
            return res.status(404).json({ 
                success: false,
                error: 'Agendamento não encontrado' 
            });
        }

        console.log('Agendamento encontrado:', {
            id: agendamento.id,
            startTime: agendamento.startTime,
            endTime: agendamento.endTime,
            status: agendamento.status
        });

        try {
            // Buscar relacionamentos em paralelo
            const [cliente, profissional, procedimento, convenio] = await Promise.all([
                prisma.clientes.findUnique({
                    where: { id: agendamento.clienteId },
                    select: { 
                        id: true,
                        nome: true, 
                        telefone: true, 
                        email: true,
                        dataNascimento: true,
                        cpf: true,
                        rua: true,
                        numero: true,
                        complemento: true,
                        bairro: true,
                        cidade: true,
                        estado: true,
                        cep: true
                    }
                }),
                agendamento.profissionalId ? prisma.profissionais.findUnique({
                    where: { id: agendamento.profissionalId },
                    select: { 
                        id: true,
                        nome: true,
                        especialidade: true,
                        email: true,
                        telefone: true,
                        celular: true,
                        ativo: true
                    }
                }).catch((error) => {
                    console.error('Erro ao buscar profissional:', error);
                    return null;
                }) : Promise.resolve(null),
                prisma.procedimentos.findUnique({
                    where: { id: agendamento.procedimentoId },
                    select: { 
                        id: true,
                        name: true,
                        descricao: true,
                        duracaoMinutos: true,
                        valor: true,
                        ativo: true
                    }
                }),
                agendamento.convenioId ? prisma.convenios.findUnique({
                    where: { id: agendamento.convenioId },
                    select: {
                        id: true,
                        nome: true,
                        desconto: true,
                        telefone: true,
                        ativo: true
                    }
                }).catch(() => null) : Promise.resolve(null)
            ]);

            // Formatar os dados para o frontend
            const responseData = {
                ...agendamento,
                // Adiciona os dados do cliente
                clienteId: cliente?.id || agendamento.clienteId,
                clienteNome: cliente?.nome,
                clienteTelefone: cliente?.telefone,
                clienteEmail: cliente?.email,
                
                // Adiciona os dados do profissional, se existir
                profissionalId: profissional?.id || agendamento.profissionalId,
                profissionalNome: profissional?.nome,
                
                // Adiciona os dados do procedimento
                procedimentoId: procedimento?.id || agendamento.procedimentoId,
                procedimentoNome: procedimento?.nome,
                procedimentoValor: procedimento?.valor,
                procedimentoDuracao: procedimento?.duracaoMinutos,
                
                // Adiciona os dados do convênio, se existir
                convenioId: convenio?.id || agendamento.convenioId,
                convenioNome: convenio?.nome,
                
                // Mantém os objetos completos para referência
                _cliente: cliente,
                _profissional: profissional,
                _procedimento: procedimento,
                _convenio: convenio
            };

            // Remover campos desnecessários para não poluir a resposta
            delete responseData._cliente;
            delete responseData._profissional;
            delete responseData._procedimento;
            delete responseData._convenio;

            return res.json({
                success: true,
                data: responseData
            });
        } catch (error) {
            console.error('Erro ao buscar relacionamentos:', error);
            // Se houver erro nos relacionamentos, retornar apenas os dados básicos
            return res.json({
                success: true,
                data: agendamento
            });
        }
    } catch (error) {
        console.error('Erro ao buscar agendamento:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro ao buscar agendamento',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


module.exports = {
    criarAgendamento,
    verificarDisponibilidade,
    listarMeusAgendamentos,
    atualizarStatusAgendamento,
    atualizarAgendamento,
    cancelarAgendamento,
    listarAgendamentos,
    buscarAgendamentosPorPeriodo,
    obterAgendamentoPorId
};
