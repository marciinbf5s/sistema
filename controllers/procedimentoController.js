const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const procedimentoController = {
    /**
     * Cria um novo procedimento (apenas admin)
     */
    async createProcedimento(req, res) {
        try {
            const { nome, descricao, duracaoMinutos, valorPadrao } = req.body;
            
            const procedimento = await prisma.procedimentos.create({
                data: {
                    name: nome,  // Changed from nome to name to match schema
                    descricao,
                    durationMins: parseInt(duracaoMinutos),  // Changed from duracaoMinutos to durationMins
                    defaultPrice: valorPadrao ? parseFloat(valorPadrao) : null  // Changed from valorPadrao to defaultPrice
                }
            });
            
            res.status(201).json(procedimento);
            
        } catch (error) {
            console.error('Erro ao criar procedimento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Lista todos os procedimentos
     */
    async listProcedimentos(req, res) {
        try {
            const procedimentos = await prisma.procedimentos.findMany({
                where: { ativo: true },
                orderBy: {
                    name: 'asc'
                },
                include: {
                    convenios: {
                        include: {
                            convenio: true
                        }
                    }
                }
            });
            
            res.json(procedimentos);
            
        } catch (error) {
            console.error('Erro ao listar procedimentos:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Obtém um procedimento por ID
     */
    async getProcedimentoById(req, res) {
        try {
            const { id } = req.params;
            
            const procedimento = await prisma.procedimentos.findUnique({
                where: { id: parseInt(id) },
                include: {
                    convenios: {
                        include: {
                            convenio: true
                        }
                    }
                }
            });
            
            if (!procedimento) {
                return res.status(404).json({ error: 'Procedimento não encontrado' });
            }
            
            res.json(procedimento);
            
        } catch (error) {
            console.error('Erro ao buscar procedimento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Atualiza um procedimento (apenas admin)
     */
    async updateProcedimento(req, res) {
        try {
            const { id } = req.params;
            const { nome, descricao, duracaoMinutos, valorPadrao, ativo } = req.body;
            
            const updateData = {};
            if (nome !== undefined) updateData.name = nome;  // Changed from nome to name
            if (descricao !== undefined) updateData.descricao = descricao;
            if (duracaoMinutos !== undefined) updateData.durationMins = parseInt(duracaoMinutos);  // Changed from duracaoMinutos to durationMins
            if (valorPadrao !== undefined) updateData.defaultPrice = parseFloat(valorPadrao);  // Changed from valorPadrao to defaultPrice
            if (ativo !== undefined) updateData.ativo = ativo;
            
            const procedimento = await prisma.procedimentos.update({
                where: { id: parseInt(id) },
                data: updateData
            });
            
            res.json(procedimento);
            
        } catch (error) {
            console.error('Erro ao atualizar procedimento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Remove um procedimento (apenas admin)
     */
    async deleteProcedimento(req, res) {
        try {
            const { id } = req.params;
            
            // Verifica se existem agendamentos para este procedimento
            const agendamentos = await prisma.agendamentos.findMany({
                where: { procedimentoId: parseInt(id) }
            });
            
            if (agendamentos.length > 0) {
                return res.status(400).json({
                    error: 'Não é possível remover um procedimento que possui agendamentos associados'
                });
            }
            
            // Remove os relacionamentos com convênios primeiro
            await prisma.convenioProcedimento.deleteMany({
                where: { procedimentoId: parseInt(id) }
            });
            
            // Remove o procedimento
            await prisma.procedimentos.delete({
                where: { id: parseInt(id) }
            });
            
            res.json({ message: 'Procedimento removido com sucesso' });
            
        } catch (error) {
            console.error('Erro ao remover procedimento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Adiciona ou atualiza o valor de um procedimento para um convênio
     */
    async atualizarValorConvenio(req, res) {
        try {
            const { procedimentoId, convenioId } = req.params;
            const { valor } = req.body;
            
            const procedimentoConvenio = await prisma.convenioProcedimento.upsert({
                where: {
                    convenioId_procedimentoId: {
                        convenioId: parseInt(convenioId),
                        procedimentoId: parseInt(procedimentoId)
                    }
                },
                update: {
                    valor: parseFloat(valor),
                    ativo: true
                },
                create: {
                    convenioId: parseInt(convenioId),
                    procedimentoId: parseInt(procedimentoId),
                    valor: parseFloat(valor),
                    ativo: true
                }
            });
            
            res.json(procedimentoConvenio);
            
        } catch (error) {
            console.error('Erro ao atualizar valor do convênio:', error);
            res.status(500).json({ error: error.message });
        }
    },
    
    /**
     * Remove o valor de um procedimento para um convênio
     */
    async removerValorConvenio(req, res) {
        try {
            const { procedimentoId, convenioId } = req.params;
            
            await prisma.convenioProcedimento.delete({
                where: {
                    convenioId_procedimentoId: {
                        convenioId: parseInt(convenioId),
                        procedimentoId: parseInt(procedimentoId)
                    }
                }
            });
            
            res.json({ message: 'Valor do convênio removido com sucesso' });
            
        } catch (error) {
            console.error('Erro ao remover valor do convênio:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = procedimentoController;
