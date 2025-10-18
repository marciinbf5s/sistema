const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const professionalController = {
    /**
     * Cria um novo profissional
     */
    async createProfessional(req, res) {
        try {
            const { 
                nome, 
                email, 
                telefone,
                celular,
                cpf,
                rg,
                dataNascimento,
                especialidade,
                registro,
                rua,
                numero,
                complemento,
                bairro,
                cidade,
                estado,
                cep,
                observacoes,
                status = 'ATIVO'
            } = req.body;
            
            // Verifica se já existe um profissional com o mesmo email (case insensitive)
            if (email) {
                const existingByEmail = await prisma.profissional.findFirst({
                    where: { 
                        email: { 
                            equals: email,
                            mode: 'insensitive'
                        },
                        id: { not: req.params?.id } // Ignora o próprio registro em caso de atualização
                    }
                });
                
                if (existingByEmail) {
                    console.log('Email já cadastrado:', email);
                    return res.status(400).json({ 
                        error: 'Já existe um profissional com este e-mail',
                        field: 'email',
                        code: 'DUPLICATE_EMAIL'
                    });
                }
            }
            
            // Verifica se já existe um profissional com o mesmo CPF
            if (cpf) {
                const existingByCpf = await prisma.profissional.findFirst({
                    where: { 
                        cpf,
                        id: { not: req.params.id } // Ignora o próprio registro em caso de atualização
                    }
                });
                
                if (existingByCpf) {
                    return res.status(400).json({ 
                        error: 'Já existe um profissional cadastrado com este CPF' 
                    });
                }
            }
            
            // Prepara os dados do profissional
            const profissionalData = {
                nome,
                email: email || null,
                telefone: telefone || null,
                celular: celular || null,
                cpf: cpf || null,
                rg: rg || null,
                dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
                especialidade: especialidade || null,
                registro: registro || null,
                rua: rua || null,
                numero: numero || null,
                complemento: complemento || null,
                bairro: bairro || null,
                cidade: cidade || null,
                estado: estado || null,
                cep: cep || null,
                status: status || 'ATIVO',
                usuarioId: req.user.id, // Usando req.user.id do middleware de autenticação
            };

            // Adiciona especialidades se existirem
            if (req.body.especialidades) {
                // Se for string, converte para array separando por vírgula
                if (typeof req.body.especialidades === 'string') {
                    profissionalData.especialidades = req.body.especialidades.split(',').map(e => e.trim()).filter(e => e);
                }
                // Se já for array, usa diretamente
                else if (Array.isArray(req.body.especialidades)) {
                    profissionalData.especialidades = req.body.especialidades;
                }
            }

            try {
                // Cria o profissional associado ao usuário logado
                const professional = await prisma.profissional.create({
                    data: profissionalData
                });
                
                return res.status(201).json(professional);
            } catch (error) {
                console.error('Erro ao criar profissional no banco de dados:', error);
                
                // Trata erros de restrição única do banco de dados
                if (error.code === 'P2002') {
                    const field = error.meta?.target?.[0];
                    if (field === 'email') {
                        return res.status(400).json({
                            error: 'Já existe um profissional com este e-mail',
                            field: 'email',
                            code: 'DUPLICATE_EMAIL'
                        });
                    } else if (field === 'cpf') {
                        return res.status(400).json({
                            error: 'Já existe um profissional com este CPF',
                            field: 'cpf',
                            code: 'DUPLICATE_CPF'
                        });
                    }
                }
                
                throw error; // Rejeita para ser pego pelo bloco catch externo
            }
            
        } catch (error) {
            console.error('Erro ao criar profissional:', error);
            console.error('Detalhes do erro:', {
                message: error.message,
                code: error.code,
                meta: error.meta
            });
            return res.status(500).json({ 
                error: 'Erro ao criar profissional',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error : {}
            });
        }
    },

    /**
     * Lista todos os profissionais do usuário logado
     */
    async listMyProfessionals(req, res) {
        try {
            const { search = '', page = 1, perPage = 10 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(perPage);
            
            const where = {
                usuarioId: req.userId,
                OR: [
                    { nome: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { cpf: { contains: search } },
                    { telefone: { contains: search } },
                    { celular: { contains: search } }
                ]
            };
            
            const [professionals, total] = await Promise.all([
                prisma.profissional.findMany({
                    where,
                    skip,
                    take: parseInt(perPage),
                    orderBy: { nome: 'asc' },
                    include: {
                        usuario: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }),
                prisma.profissional.count({ where })
            ]);
            
            return res.json({
                data: professionals,
                pagination: {
                    total,
                    page: parseInt(page),
                    perPage: parseInt(perPage),
                    totalPages: Math.ceil(total / perPage)
                }
            });
            
        } catch (error) {
            console.error('Erro ao listar profissionais:', error);
            return res.status(500).json({ error: 'Erro ao listar profissionais' });
        }
    },

    /**
     * Lista todos os profissionais (apenas admin)
     */
    async listAllProfessionals(req, res) {
        try {
            if (req.userRole !== 'ADMIN') {
                return res.status(403).json({ error: 'Acesso negado' });
            }
            
            const { search = '', page = 1, perPage = 10 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(perPage);
            
            const where = {
                OR: [
                    { nome: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { cpf: { contains: search } },
                    { telefone: { contains: search } },
                    { celular: { contains: search } }
                ]
            };
            
            const [professionals, total] = await Promise.all([
                prisma.profissional.findMany({
                    where,
                    skip,
                    take: parseInt(perPage),
                    orderBy: { nome: 'asc' },
                    include: {
                        usuario: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }),
                prisma.profissional.count({ where })
            ]);
            
            return res.json({
                data: professionals,
                pagination: {
                    total,
                    page: parseInt(page),
                    perPage: parseInt(perPage),
                    totalPages: Math.ceil(total / perPage)
                }
            });
            
        } catch (error) {
            console.error('Erro ao listar profissionais:', error);
            return res.status(500).json({ error: 'Erro ao listar profissionais' });
        }
    },

    /**
     * Atualiza um profissional
     */
    async updateProfessional(req, res) {
        try {
            const { id } = req.params;
            const { 
                nome, 
                email, 
                telefone,
                celular,
                cpf,
                rg,
                dataNascimento,
                especialidade,
                registro,
                rua,
                numero,
                complemento,
                bairro,
                cidade,
                estado,
                cep,
                observacoes,
                status
            } = req.body;
            
            // Verifica se o ID é válido
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({ 
                    success: false,
                    error: 'ID_INVALIDO',
                    message: 'ID do profissional inválido'
                });
            }
            
            // Verifica se o profissional existe
            const professional = await prisma.profissional.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!professional) {
                return res.status(404).json({ 
                    success: false,
                    error: 'NAO_ENCONTRADO',
                    message: 'Profissional não encontrado',
                    details: `Nenhum profissional encontrado com o ID ${id}`
                });
            }
            
            // Obtém o ID e a role do usuário do objeto req.user definido pelo middleware de autenticação
            const userId = req.user?.id;
            const userRole = req.user?.role;
            
            console.log('Dados da requisição - User ID:', userId, 'User Role:', userRole, 'Professional User ID:', professional.usuarioId);
            
            // Verifica se o usuário está autenticado
            if (!userId) {
                console.log('Acesso negado - Usuário não autenticado');
                return res.status(401).json({ 
                    success: false,
                    error: 'NAO_AUTORIZADO',
                    message: 'Você precisa estar autenticado para realizar esta ação',
                    details: 'O token de autenticação não foi fornecido ou é inválido'
                });
            }
            
            // Verifica se o usuário tem permissão para atualizar
            if (userRole !== 'ADMIN' && professional.usuarioId !== parseInt(userId)) {
                console.log('Acesso negado - Usuário não tem permissão');
                return res.status(403).json({ 
                    success: false,
                    error: 'ACESSO_NEGADO',
                    message: 'Você não tem permissão para atualizar este profissional',
                    details: 'Apenas o proprietário do profissional ou um administrador podem realizar esta ação',
                    requiredRole: 'ADMIN',
                    currentRole: userRole,
                    isOwner: professional.usuarioId === parseInt(userId)
                });
            }
            
            // Verifica se o email já está em uso por outro profissional
            if (email && email !== professional.email) {
                const emailInUse = await prisma.profissional.findFirst({
                    where: {
                        email,
                        id: { not: parseInt(id) }
                    }
                });

                if (emailInUse) {
                    return res.status(400).json({ error: 'Email já está em uso' });
                }
            }
            
            // Verifica se o status fornecido é válido
            const statusValidos = ['ATIVO', 'INATIVO', 'PENDENTE', 'BLOQUEADO'];
            const novoStatus = status ? status.toUpperCase() : professional.status;

            if (status && !statusValidos.includes(novoStatus)) {
                return res.status(400).json({
                    success: false,
                    error: 'STATUS_INVALIDO',
                    message: 'Status inválido',
                    details: `O status deve ser um dos seguintes: ${statusValidos.join(', ')}`,
                    statusRecebido: status,
                    statusValidos: statusValidos
                });
            }
            
            // Verifica se há agendamentos futuros ao tentar inativar
            if (novoStatus === 'INATIVO' && professional.status !== 'INATIVO') {
                try {
                    const agendamentosFuturos = await prisma.agendamentos.findMany({
                        where: {
                            profissionalId: parseInt(id),
                            startTime: { gte: new Date() },
                            status: { not: 'CANCELADO' }
                        },
                        select: {
                            id: true,
                            startTime: true,
                            cliente: {
                                select: {
                                    nome: true,
                                    telefone: true
                                }
                            }
                        },
                        orderBy: {
                            startTime: 'asc'
                        },
                        take: 3
                    });
                    
                    if (agendamentosFuturos.length > 0) {
                        const proximosAgendamentos = agendamentosFuturos.map(ag => ({
                            id: ag.id,
                            data: ag.startTime.toISOString(),
                            cliente: ag.cliente.nome,
                            telefone: ag.cliente.telefone
                        }));
                        
                        return res.status(400).json({ 
                            success: false,
                            error: 'AGENDAMENTOS_FUTUROS',
                            message: 'Não é possível inativar o profissional',
                            details: 'Existem agendamentos futuros para este profissional. Cancele ou transfira os agendamentos antes de inativar.',
                            agendamentos: proximosAgendamentos,
                            totalAgendamentos: agendamentosFuturos.length
                        });
                    }
                } catch (error) {
                    console.error('Erro ao verificar agendamentos futuros:', error);
                    // Se houver erro na verificação, não bloqueia a inativação, mas registra o erro
                    console.warn('Não foi possível verificar agendamentos futuros. Continuando com a inativação...');
                }
            }
            
            try {
                // Prepara os dados para atualização
                const updateData = {
                    nome: nome !== undefined ? nome : professional.nome,
                    email: email !== undefined ? email : professional.email,
                    telefone: telefone !== undefined ? telefone : professional.telefone,
                    celular: celular !== undefined ? celular : professional.celular,
                    cpf: cpf !== undefined ? cpf : professional.cpf,
                    rg: rg !== undefined ? rg : professional.rg,
                    dataNascimento: dataNascimento !== undefined ? new Date(dataNascimento) : professional.dataNascimento,
                    especialidade: especialidade !== undefined ? especialidade : professional.especialidade,
                    registro: registro !== undefined ? registro : professional.registro,
                    rua: rua !== undefined ? rua : professional.rua,
                    numero: numero !== undefined ? numero : professional.numero,
                    complemento: complemento !== undefined ? complemento : professional.complemento,
                    bairro: bairro !== undefined ? bairro : professional.bairro,
                    cidade: cidade !== undefined ? cidade : professional.cidade,
                    estado: estado !== undefined ? estado : professional.estado,
                    cep: cep !== undefined ? cep : professional.cep,
                    observacoes: observacoes !== undefined ? observacoes : professional.observacoes,
                    status: novoStatus,
                    atualizadoEm: new Date()
                };
                
                console.log('Atualizando profissional com os seguintes dados:', JSON.stringify(updateData, null, 2));
                
                // Atualiza o profissional
                const updatedProfessional = await prisma.profissional.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                    include: {
                        usuario: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                });
                
                console.log('Profissional atualizado com sucesso:', updatedProfessional.id);
                
                // Remove dados sensíveis antes de enviar a resposta
                const { usuario, ...profissionalSemUsuario } = updatedProfessional;
                
                return res.json({
                    success: true,
                    message: 'Profissional atualizado com sucesso',
                    data: profissionalSemUsuario,
                    usuarioResponsavel: {
                        id: usuario.id,
                        name: usuario.name,
                        email: usuario.email
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Erro ao atualizar profissional no banco de dados:', error);
                
                // Tratamento de erros específicos do Prisma
                if (error.code === 'P2002') {
                    const field = error.meta?.target?.[0] || 'campo';
                    return res.status(400).json({
                        success: false,
                        error: 'DUPLICATE_ENTRY',
                        message: `Já existe um profissional com este ${field === 'email' ? 'e-mail' : field}`,
                        field: field,
                        details: `O valor informado para ${field} já está em uso por outro profissional.`
                    });
                }
                
                throw error; // Repassa o erro para o bloco catch externo
            }
            
        } catch (error) {
            console.error('Erro ao processar atualização do profissional:', error);
            
            // Se já foi enviada uma resposta, não envie outra
            if (res.headersSent) {
                console.warn('Resposta já enviada, ignorando erro:', error);
                return;
            }
            
            // Se for um erro de validação do Prisma
            if (error.name === 'PrismaClientValidationError' || error.code === 'P2003') {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: 'Erro de validação dos dados',
                    details: 'Verifique os dados fornecidos e tente novamente.',
                    validationError: error.message
                });
            }
            
            // Se for um erro de chave estrangeira
            if (error.code === 'P2003') {
                return res.status(400).json({
                    success: false,
                    error: 'FOREIGN_KEY_CONSTRAINT',
                    message: 'Erro de integridade referencial',
                    details: 'Não foi possível concluir a operação devido a uma restrição de chave estrangeira.'
                });
            }
            
            // Erro genérico
            return res.status(500).json({ 
                success: false,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Erro ao processar a solicitação',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
                timestamp: new Date().toISOString()
            });
        }
    },

    /**
     * Remove um profissional
     */
    async deleteProfessional(req, res) {
        try {
            const id = parseInt(req.params.id);
            
            // Verifica se o profissional existe
            const professional = await prisma.profissional.findUnique({
                where: { id },
                include: { 
                    agendamentos: true,
                    usuario: {
                        select: {
                            id: true
                        }
                    }
                }
            });

            if (!professional) {
                return res.status(404).json({ 
                    error: 'Profissional não encontrado' 
                });
            }

            // Verifica se o usuário tem permissão
            if (req.user.role !== 'ADMIN' && professional.usuarioId !== req.user.id) {
                return res.status(403).json({ 
                    error: 'Acesso negado',
                    message: 'Você não tem permissão para excluir este profissional'
                });
            }

            // Verifica se existem agendamentos futuros
            const hasFutureAppointments = professional.agendamentos.some(appointment => {
                return new Date(appointment.startTime) > new Date();
            });
            
            if (hasFutureAppointments) {
                return res.status(400).json({ 
                    error: 'Não é possível excluir um profissional com agendamentos futuros' 
                });
            }
            
            // Remove o profissional
            await prisma.profissional.delete({
                where: { id: parseInt(id) }
            });
            
            return res.status(204).send();
            
        } catch (error) {
            console.error('Erro ao excluir profissional:', error);
            return res.status(500).json({ error: 'Erro ao excluir profissional' });
        }
    },

    /**
     * Obtém um profissional por ID
     */
    async getProfessionalById(req, res) {
        try {
            const { id } = req.params;
            
            // Validação básica do ID
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({ 
                    success: false,
                    error: 'ID_INVALIDO',
                    message: 'ID do profissional inválido'
                });
            }

            // Primeiro, busca apenas os dados básicos do profissional
            const professional = await prisma.profissional.findUnique({
                where: { id: parseInt(id) },
                include: {
                    usuario: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            
            if (!professional) {
                return res.status(404).json({ 
                    success: false,
                    error: 'NAO_ENCONTRADO',
                    message: 'Profissional não encontrado'
                });
            }
            
            // Verifica se o usuário tem permissão para visualizar
            const isAdmin = req.user.role === 'ADMIN';
            const isOwner = professional.usuarioId === req.user.id;
            
            if (!isAdmin && !isOwner) {
                console.log('Acesso negado - Permissão insuficiente:', { 
                    userId: req.user.id, 
                    userRole: req.user.role,
                    professionalUserId: professional.usuarioId 
                });
                return res.status(403).json({ 
                    success: false,
                    error: 'ACESSO_NEGADO',
                    message: 'Você não tem permissão para acessar este profissional'
                });
            }

            // Se o usuário tiver permissão, busca os dados adicionais
            try {
                // Busca os agendamentos em uma consulta separada para evitar problemas de relacionamento
                const agendamentos = await prisma.agendamentos.findMany({
                    where: { profissionalId: parseInt(id) },
                    include: {
                        procedimentos: true,
                        convenios: true,
                        clientes: true
                    },
                    orderBy: { startTime: 'desc' },
                    take: 10
                });

                // Monta o objeto de resposta
                const response = {
                    ...professional,
                    agendamentos
                };
                
                return res.json({
                    success: true,
                    data: response
                });
                
            } catch (dbError) {
                console.error('Erro ao buscar agendamentos do profissional:', dbError);
                // Retorna os dados do profissional mesmo se houver erro nos agendamentos
                return res.json({
                    success: true,
                    data: {
                        ...professional,
                        agendamentos: []
                    },
                    warning: 'Não foi possível carregar os agendamentos deste profissional'
                });
            }
            
        } catch (error) {
            console.error('Erro ao buscar profissional:', error);
            return res.status(500).json({ 
                success: false,
                error: 'ERRO_INTERNO',
                message: 'Ocorreu um erro ao buscar o profissional',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Atualiza apenas o status de um profissional (rota PATCH /api/professionals/:id/status)
     */
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            console.log(`[${new Date().toISOString()}] Atualizando status do profissional ${id} para ${status}`);
            
            // Validação básica
            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'STATUS_NAO_FORNECIDO',
                    message: 'O novo status não foi fornecido',
                    code: 'VALIDATION_ERROR_001'
                });
            }
            
            const statusFormatado = status.toUpperCase();
            const statusValidos = ['ATIVO', 'INATIVO', 'PENDENTE', 'BLOQUEADO'];
            
            if (!statusValidos.includes(statusFormatado)) {
                return res.status(400).json({
                    success: false,
                    error: 'STATUS_INVALIDO',
                    message: 'Status inválido',
                    details: `O status deve ser um dos seguintes: ${statusValidos.join(', ')}`,
                    statusRecebido: status,
                    statusValidos,
                    code: 'VALIDATION_ERROR_002'
                });
            }
            
            // Verifica se o profissional existe
            const professional = await prisma.profissional.findUnique({
                where: { id: parseInt(id) },
                include: {
                    usuario: {
                        select: { id: true, role: true }
                    }
                }
            });
            
            if (!professional) {
                return res.status(404).json({
                    success: false,
                    error: 'PROFISSIONAL_NAO_ENCONTRADO',
                    message: 'Profissional não encontrado',
                    code: 'NOT_FOUND_001'
                });
            }
            
            // Verifica permissões
            const isAdmin = req.user.role === 'ADMIN';
            const isOwner = professional.usuarioId === req.user.id;
            
            if (!isAdmin && !isOwner) {
                console.error('Acesso negado para o usuário:', req.user.id, 'tentando acessar profissional:', id);
                return res.status(403).json({
                    success: false,
                    error: 'ACESSO_NEGADO',
                    message: 'Você não tem permissão para atualizar este profissional',
                    code: 'AUTH_ERROR_001',
                    details: 'Apenas o proprietário do profissional ou um administrador podem realizar esta ação'
                });
            }
            
            // Se estiver inativando, verifica agendamentos futuros
            if (statusFormatado === 'INATIVO' && professional.status !== 'INATIVO') {
                const now = new Date();
                const agendamentosFuturos = await prisma.agendamentos.findMany({
                    where: {
                        profissionalId: parseInt(id),
                        startTime: { gte: now },
                        status: { not: 'CANCELADO' }
                    },
                    select: {
                        id: true,
                        startTime: true,
                        cliente: {
                            select: {
                                nome: true,
                                telefone: true
                            }
                        }
                    },
                    orderBy: { startTime: 'asc' },
                    take: 3
                });
                
                if (agendamentosFuturos.length > 0) {
                    console.error(`Tentativa de inativar profissional ${id} com ${agendamentosFuturos.length} agendamentos futuros`);
                    
                    const proximosAgendamentos = agendamentosFuturos.map(ag => ({
                        id: ag.id,
                        data: ag.startTime.toISOString(),
                        cliente: ag.cliente.nome,
                        telefone: ag.cliente.telefone
                    }));
                    
                    return res.status(400).json({
                        success: false,
                        error: 'AGENDAMENTOS_FUTUROS',
                        message: 'Não é possível inativar o profissional',
                        details: 'Existem agendamentos futuros para este profissional. Cancele ou transfira os agendamentos antes de inativar.',
                        code: 'VALIDATION_ERROR_003',
                        agendamentos: proximosAgendamentos,
                        totalAgendamentos: agendamentosFuturos.length
                    });
                }
            }
            
            // Atualiza apenas o status
            const updatedProfessional = await prisma.profissional.update({
                where: { id: parseInt(id) },
                data: { 
                    status: statusFormatado,
                    atualizadoEm: new Date()
                },
                include: {
                    usuario: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            
            console.log(`Status do profissional ${id} atualizado para ${statusFormatado}`);
            
            return res.status(200).json({
                success: true,
                data: updatedProfessional,
                message: `Status do profissional atualizado para ${statusFormatado}`,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Erro ao atualizar status do profissional:', error);
            
            // Tratamento de erros específicos do Prisma
            if (error.code === 'P2025') {
                return res.status(404).json({
                    success: false,
                    error: 'PROFISSIONAL_NAO_ENCONTRADO',
                    message: 'Profissional não encontrado',
                    code: 'NOT_FOUND_002',
                    details: error.meta?.cause || 'O profissional especificado não existe'
                });
            }
            
            return res.status(500).json({
                success: false,
                error: 'ERRO_INTERNO',
                message: 'Ocorreu um erro ao atualizar o status do profissional',
                code: 'INTERNAL_SERVER_ERROR_001',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    /**
     * Atualização parcial de um profissional (PATCH)
     */
    async partialUpdateProfessional(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            
            console.log('=== INÍCIO partialUpdateProfessional ===');
            console.log('ID do profissional:', id);
            console.log('Dados recebidos para atualização:', JSON.stringify(updateData, null, 2));
            console.log('Usuário autenticado:', req.user);
            
            // Verifica se o ID é válido
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({ 
                    success: false,
                    error: 'ID_INVALIDO',
                    message: 'ID do profissional inválido',
                    code: 'VALIDATION_ERROR_001'
                });
            }
            
            // Verifica se o profissional existe
            const professional = await prisma.profissional.findUnique({
                where: { id: parseInt(id) },
                include: { usuario: { select: { id: true } } }
            });
            
            console.log('Profissional encontrado:', professional);
            
            if (!professional) {
                return res.status(404).json({ 
                    success: false,
                    error: 'NAO_ENCONTRADO',
                    message: 'Profissional não encontrado',
                    code: 'NOT_FOUND_001'
                });
            }
            
            // Verifica permissões
            const isAdmin = req.user.role === 'ADMIN';
            const isOwner = professional.usuario.id === req.user.id;
            
            if (!isAdmin && !isOwner) {
                return res.status(403).json({ 
                    success: false,
                    error: 'ACESSO_NEGADO',
                    message: 'Você não tem permissão para atualizar este profissional',
                    code: 'AUTH_ERROR_001'
                });
            }
            
            // Se estiver atualizando o status, verifica agendamentos futuros
            console.log('Status atual do profissional:', professional.status);
            console.log('Novo status solicitado:', updateData.status);
            
            if (updateData.status && updateData.status.toUpperCase() === 'INACTIVE' && professional.status !== 'INACTIVE') {
                const agendamentosFuturos = await prisma.agendamentos.findFirst({
                    where: {
                        profissionalId: parseInt(id),
                        startTime: { gte: new Date() },
                        status: { not: 'CANCELADO' }
                    }
                });
                
                if (agendamentosFuturos) {
                    return res.status(400).json({
                        success: false,
                        error: 'AGENDAMENTOS_FUTUROS',
                        message: 'Não é possível inativar o profissional',
                        details: 'Existem agendamentos futuros para este profissional',
                        code: 'VALIDATION_ERROR_002'
                    });
                }
            }
            
            // Remove campos que não devem ser atualizados
            const { id: _, usuario, ...safeUpdateData } = updateData;
            
            console.log('Dados seguros para atualização:', safeUpdateData);
            
            // Atualiza apenas os campos fornecidos
            const updateDataPrisma = {
                ...safeUpdateData,
                atualizadoEm: new Date()
            };
            
            console.log('Dados para atualização no Prisma:', updateDataPrisma);
            
            const updatedProfessional = await prisma.profissional.update({
                where: { id: parseInt(id) },
                data: updateDataPrisma
            });
            
            console.log('Profissional atualizado com sucesso:', updatedProfessional);
            
            return res.json({
                success: true,
                message: 'Profissional atualizado com sucesso',
                data: updatedProfessional
            });
            
        } catch (error) {
            console.error('=== ERRO NO partialUpdateProfessional ===');
            console.error('Erro completo:', error);
            console.error('Mensagem de erro:', error.message);
            console.error('Stack trace:', error.stack);
            console.error('=== FIM DO ERRO ===');
            
            if (error.code === 'P2002') {
                const field = error.meta?.target?.[0] || 'campo';
                return res.status(400).json({
                    success: false,
                    error: 'ENTRADA_DUPLICADA',
                    message: `Já existe um profissional com este ${field === 'email' ? 'e-mail' : field}`,
                    field: field,
                    code: 'VALIDATION_ERROR_003'
                });
            }
            
            return res.status(500).json({
                success: false,
                error: 'ERRO_INTERNO',
                message: 'Ocorreu um erro ao atualizar o profissional',
                code: 'INTERNAL_SERVER_ERROR_001'
            });
        }
    }
};

module.exports = professionalController;
