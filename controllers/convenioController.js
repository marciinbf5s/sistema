const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const convenioController = {
    /**
     * Cria um novo convênio (apenas admin)
     */
    async createConvenio(req, res) {
        try {
            console.log('Dados recebidos no createConvenio:', req.body);
            
            // Extrai apenas os campos necessários do corpo da requisição
            const { nome, descricao, ativo } = req.body;
            
            // Validação básica
            if (!nome || typeof nome !== 'string' || nome.trim() === '') {
                console.error('Erro de validação: Nome do convênio é obrigatório');
                return res.status(400).json({ 
                    error: 'O nome do convênio é obrigatório',
                    details: 'O campo nome não pode estar vazio'
                });
            }

            // Prepara os dados para criação
            const convenioData = {
                nome: nome.trim(),
                descricao: descricao ? descricao.trim() : null,
                ativo: ativo !== undefined ? Boolean(ativo) : true
            };

            console.log('Tentando criar convênio com os dados:', convenioData);

            // Cria o convênio apenas com os campos necessários
            const convenio = await prisma.convenio.create({
                data: convenioData
            });
            
            console.log('Convênio criado com sucesso:', convenio);
            res.status(201).json(convenio);
            
        } catch (error) {
            console.error('Erro ao criar convênio:', error);
            
            // Verifica se é um erro de validação do Prisma
            if (error.code === 'P2002') {
                return res.status(400).json({
                    error: 'Já existe um convênio com este nome',
                    details: 'Por favor, escolha um nome diferente.'
                });
            }
            
            res.status(500).json({ 
                error: 'Erro interno ao processar a requisição',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    
    /**
     * Lista todos os convênios
     */
    async listConvenios(req, res) {
        try {
            const convenios = await prisma.convenio.findMany({
                where: { ativo: true },
                orderBy: {
                    nome: 'asc'
                },
                include: {
                    procedimentos: {
                        include: {
                            procedimento: true
                        }
                    }
                }
            });
            
            res.json(convenios);
            
        } catch (error) {
            console.error('Erro ao listar convênios:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Obtém um convênio por ID
     */
    async getConvenioById(req, res) {
        try {
            const { id } = req.params;
            
            const convenio = await prisma.convenio.findUnique({
                where: { id: parseInt(id) },
                include: {
                    procedimentos: {
                        include: {
                            procedimento: true
                        }
                    }
                }
            });
            
            if (!convenio) {
                return res.status(404).json({ error: 'Convênio não encontrado' });
            }
            
            res.json(convenio);
            
        } catch (error) {
            console.error('Erro ao buscar convênio:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Atualiza um convênio (apenas admin)
     */
    async updateConvenio(req, res) {
        try {
            const { id } = req.params;
            const { nome, descricao, ativo } = req.body;
            
            // Validação básica
            if (!nome || typeof nome !== 'string' || nome.trim() === '') {
                return res.status(400).json({ error: 'O nome do convênio é obrigatório' });
            }

            // Prepara os dados para atualização
            const updateData = {
                nome: nome.trim(),
                descricao: descricao ? descricao.trim() : null
            };
            
            // Só atualiza o status se for enviado
            if (ativo !== undefined) {
                updateData.ativo = Boolean(ativo);
            }
            
            const convenio = await prisma.convenio.update({
                where: { id: parseInt(id) },
                data: updateData
            });
            
            console.log('Convênio atualizado com sucesso:', convenio);
            res.json(convenio);
            
        } catch (error) {
            console.error('Erro ao atualizar convênio:', error);
            res.status(500).json({ 
                error: 'Erro interno ao processar a requisição',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },
    
    /**
     * Remove um convênio (apenas admin)
     */
    async deleteConvenio(req, res) {
        try {
            const { id } = req.params;
            
            // Verifica se existem agendamentos para este convênio
            const agendamentos = await prisma.agendamento.findMany({
                where: { convenioId: parseInt(id) }
            });
            
            if (agendamentos.length > 0) {
                return res.status(400).json({
                    error: 'Não é possível remover um convênio que possui agendamentos associados'
                });
            }
            
            // Remove os relacionamentos com procedimentos primeiro
            await prisma.convenioProcedimento.deleteMany({
                where: { convenioId: parseInt(id) }
            });
            
            // Remove o convênio
            await prisma.convenio.delete({
                where: { id: parseInt(id) }
            });
            
            res.json({ message: 'Convênio removido com sucesso' });
            
        } catch (error) {
            console.error('Erro ao remover convênio:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Lista todos os procedimentos de um convênio
     */
    async listProcedimentosPorConvenio(req, res) {
        try {
            const { id } = req.params;
            
            const procedimentos = await prisma.convenioProcedimento.findMany({
                where: { 
                    convenioId: parseInt(id),
                    ativo: true
                },
                include: {
                    procedimento: true
                },
                orderBy: {
                    procedimento: {
                        nome: 'asc'
                    }
                }
            });
            
            res.json(procedimentos);
            
        } catch (error) {
            console.error('Erro ao listar procedimentos do convênio:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = convenioController;
