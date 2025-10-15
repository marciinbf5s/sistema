const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clientController = {
    /**
     * Cria um novo cliente
     */
    async createClient(req, res) {
        try {
            const { 
                nome, 
                email, 
                telefone,
                cpf,
                rua,
                numero,
                complemento,
                bairro,
                cidade,
                estado,
                cep,
                observacoes,
                dataNascimento,
                status = 'ATIVO'
            } = req.body;
            
            // Verifica se o cliente já existe
            const existingClient = await prisma.cliente.findFirst({
                where: { email }
            });
            
            if (existingClient) {
                return res.status(400).json({ 
                    error: 'Já existe um cliente com este email' 
                });
            }
            
            // Cria o cliente associado ao usuário logado
            const client = await prisma.cliente.create({
                data: {
                    nome,
                    email,
                    telefone,
                    cpf: cpf || null,
                    rua,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado,
                    cep,
                    observacoes,
                    dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
                    status,
                    usuarioId: req.user.id
                }
            });
            
            res.status(201).json(client);
            
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Lista todos os clientes do usuário logado
     */
    async listMyClients(req, res) {
        try {
            console.log('=== INÍCIO listMyClients ===');
            console.log('Usuário autenticado:', JSON.stringify(req.user, null, 2));
            
            if (!req.user || !req.user.id) {
                const errorMsg = 'Usuário não autenticado ou ID do usuário não encontrado';
                console.error(errorMsg);
                return res.status(401).json({ error: errorMsg });
            }
            
            console.log('Buscando clientes para o usuário ID:', req.user.id);
            
            try {
                // Buscar clientes usando o Prisma ORM
                console.log('Buscando clientes...');
                const clients = await prisma.cliente.findMany({
                    where: { usuarioId: req.user.id },
                    orderBy: { nome: 'asc' },
                    take: 50
                });
                
                console.log(`Encontrados ${clients.length} clientes`);
                
                // Formatar as datas para ISO string
                const formattedClients = clients.map(client => ({
                    id: client.id,
                    nome: client.nome,
                    email: client.email,
                    telefone: client.telefone,
                    cpf: client.cpf,
                    dataNascimento: client.dataNascimento ? new Date(client.dataNascimento).toISOString() : null,
                    rua: client.rua,
                    numero: client.numero,
                    complemento: client.complemento,
                    bairro: client.bairro,
                    cidade: client.cidade,
                    estado: client.estado,
                    cep: client.cep,
                    status: client.status,
                    observacoes: client.observacoes,
                    usuarioId: client.usuarioId,
                    criadoEm: client.createdAt ? new Date(client.createdAt).toISOString() : null,
                    atualizadoEm: client.updatedAt ? new Date(client.updatedAt).toISOString() : null
                }));
                
                return res.json(formattedClients);
                
            } catch (dbError) {
                console.error('Erro ao acessar o banco de dados:', dbError);
                
                // Log mais detalhado do erro
                if (dbError.code) {
                    console.error('Código do erro:', dbError.code);
                }
                if (dbError.meta) {
                    console.error('Metadados do erro:', dbError.meta);
                }
                
                return res.status(500).json({ 
                    error: 'Erro ao acessar o banco de dados',
                    details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
                });
            }
        } catch (error) {
            console.error('Erro ao listar clientes:', error);
            
            // Log mais detalhado do erro
            if (error.code) {
                console.error('Código do erro:', error.code);
            }
            if (error.meta) {
                console.error('Metadados do erro:', error.meta);
            }
            
            res.status(500).json({ 
                error: 'Erro ao carregar clientes',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    /**
     * Lista todos os clientes (apenas admin)
     */
    async listAllClients(req, res) {
        try {
            console.log('Iniciando listagem de todos os clientes...');
            
            // Primeiro, verifica se o usuário está autenticado
            if (!req.user) {
                console.error('Usuário não autenticado');
                return res.status(401).json({ error: 'Não autorizado' });
            }
            
            console.log('Usuário autenticado:', req.user.id);
            
            // Se for admin, lista todos os clientes, senão lista apenas os do usuário
            let whereClause = {};
            if (req.user.role !== 'ADMIN') {
                whereClause = { usuarioId: req.user.id };
            }
            
            console.log('Buscando clientes com filtro:', whereClause);
            
            const clients = await prisma.cliente.findMany({
                where: whereClause,
                select: {
                    id: true,
                    nome: true,
                    email: true,
                    telefone: true,
                    cpf: true,
                    status: true,
                    dataNascimento: true,
                    rua: true,
                    numero: true,
                    complemento: true,
                    bairro: true,
                    cidade: true,
                    estado: true,
                    cep: true,
                    observacoes: true,
                    criadoEm: true,
                    atualizadoEm: true
                },
                orderBy: {
                    nome: 'asc'
                }
            });
            
            console.log(`Encontrados ${clients.length} clientes`);
            res.json(clients);
            
        } catch (error) {
            console.error('Erro ao listar todos os clientes:', error);
            // Log mais detalhado do erro
            if (error.code) {
                console.error('Código do erro:', error.code);
            }
            if (error.meta) {
                console.error('Metadados do erro:', error.meta);
            }
            res.status(500).json({ 
                error: 'Erro ao carregar clientes',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    
    /**
     * Atualiza um cliente
     */
    async updateClient(req, res) {
        try {
            const { id } = req.params;
            const { 
                nome, 
                email, 
                telefone,
                cpf,
                rua,
                numero,
                complemento,
                bairro,
                cidade,
                estado,
                cep,
                observacoes,
                dataNascimento,
                status
            } = req.body;
            
            // Verifica se o cliente existe
            const client = await prisma.cliente.findUnique({
                where: { id: parseInt(id) }
            });
            
            if (!client) {
                return res.status(404).json({ error: 'Cliente não encontrado' });
            }
            
            // Verifica se o usuário tem permissão para atualizar este cliente
            if (req.user.role !== 'ADMIN' && client.usuarioId !== req.user.id) {
                return res.status(403).json({ 
                    error: 'Você não tem permissão para atualizar este cliente' 
                });
            }
            
            // Atualiza o cliente
            const updatedClient = await prisma.cliente.update({
                where: { id: parseInt(id) },
                data: {
                    nome,
                    email,
                    telefone,
                    cpf: cpf || null,
                    rua,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado,
                    cep,
                    observacoes,
                    dataNascimento: dataNascimento ? new Date(dataNascimento) : null,
                    status: status || client.status
                }
            });
            
            res.json(updatedClient);
            
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Remove um cliente
     */
    async deleteClient(req, res) {
        try {
            const { id } = req.params;
            
            // Verifica se o cliente existe
            const client = await prisma.cliente.findUnique({
                where: { id: parseInt(id) },
                include: {
                    agendamentos: true
                }
            });
            
            if (!client) {
                return res.status(404).json({ error: 'Cliente não encontrado' });
            }
            
            // Verifica se o usuário tem permissão para remover este cliente
            if (req.user.role !== 'ADMIN' && client.usuarioId !== req.user.id) {
                return res.status(403).json({ 
                    error: 'Você não tem permissão para remover este cliente' 
                });
            }
            
            // Verifica se existem agendamentos futuros para este cliente
            const now = new Date();
            const futureAppointments = client.agendamentos.filter(
                appt => new Date(appt.startTime) > now
            );
            
            if (futureAppointments.length > 0) {
                return res.status(400).json({ 
                    error: 'Não é possível remover um cliente com agendamentos futuros' 
                });
            }
            
            // Remove o cliente
            await prisma.cliente.delete({
                where: { id: parseInt(id) }
            });
            
            res.status(204).send();
            
        } catch (error) {
            console.error('Erro ao remover cliente:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Obtém um cliente por ID
     */
    async getClientById(req, res) {
        try {
            const { id } = req.params;
            
            // Validate ID
            const clientId = parseInt(id);
            if (isNaN(clientId)) {
                return res.status(400).json({ error: 'ID do cliente inválido' });
            }
            
            // Get client with related data
            const client = await prisma.cliente.findUnique({
                where: { id: clientId },
                include: {
                    agendamentos: {
                        include: {
                            procedimento: true,
                            convenio: true
                        },
                        orderBy: {
                            startTime: 'desc'
                        },
                        take: 5 // Últimos 5 agendamentos
                    }
                }
            });
            
            if (!client) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Cliente não encontrado' 
                });
            }
            
            // Skip permission check for now to test the endpoint
            // TODO: Re-enable permission check after confirming the endpoint works
            /*
            if (client.usuarioId !== req.user?.id && req.user?.role !== 'ADMIN') {
                return res.status(403).json({ 
                    success: false,
                    error: 'Você não tem permissão para acessar este cliente' 
                });
            }
            */
            
            res.json({
                success: true,
                data: client
            });
            
        } catch (error) {
            console.error('Erro ao buscar cliente:', error);
            res.status(500).json({ 
                success: false,
                error: 'Erro interno ao buscar cliente' 
            });
        }
    }
};

module.exports = clientController;
