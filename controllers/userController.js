const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { USER } = require('../constants/messages');

const prisma = new PrismaClient();

const userController = {
    /**
     * Lista todos os usuários (apenas admin)
     */
    async listUsers(req, res) {
        try {
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    updatedAt: true,
                    clientes: {
                        select: {
                            id: true,
                            nome: true
                        }
                    },
                    profissionais: {
                        select: {
                            id: true,
                            nome: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            res.json(users);
            
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            res.status(500).json({ 
                error: 'Erro ao listar usuários',
                details: error.message 
            });
        }
    },

    /**
     * Obtém um usuário por ID (apenas admin)
     */
    async getUserById(req, res) {
        try {
            const { id } = req.params;
            
            const user = await prisma.user.findUnique({
                where: { id: parseInt(id) },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    clientes: {
                        select: {
                            id: true,
                            nome: true
                        }
                    },
                    profissionais: {
                        select: {
                            id: true,
                            nome: true
                        }
                    }
                }
            });

            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            // Remover a senha do retorno
            const { password, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
            
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Cria um novo usuário (apenas admin)
     */
    async createUser(req, res) {
        try {
            const { name, email, password, role, status = 'ACTIVE' } = req.body;

            // Verifica se o email já está em uso
            const existingUser = await prisma.user.findUnique({
                where: { email }
            });

            if (existingUser) {
                return res.status(400).json({ error: 'Este email já está em uso' });
            }

            // Criptografa a senha
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role,
                    status
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    createdAt: true
                }
            });

            res.status(201).json(user);

        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Atualiza um usuário existente (apenas admin)
     */
    async updateUser(req, res) {
        try {
            const { id } = req.params;

            console.log('=== INÍCIO DA ATUALIZAÇÃO ===');
            console.log('Method:', req.method);
            console.log('URL:', req.url);
            console.log('Content-Type:', req.headers['content-type']);
            console.log('Body type:', typeof req.body);
            console.log('Body is array:', Array.isArray(req.body));
            console.log('Body:', req.body);
            console.log('Dados brutos recebidos (req.body):', JSON.stringify(req.body, null, 2));

            const { name, email, password, role, status } = req.body;

            console.log('Dados recebidos para atualização:', {
                id,
                name,
                email,
                role,
                status,
                statusType: typeof status,
                hasPassword: !!password,
                rawBody: JSON.stringify(req.body)
            });

            // Verificar se os campos obrigatórios foram enviados
            if (!name || name.trim() === '') {
                console.log('ERRO: Campo name está vazio!');
                return res.status(400).json({ error: 'Campo nome é obrigatório' });
            }

            if (!email || email.trim() === '') {
                console.log('ERRO: Campo email está vazio!');
                return res.status(400).json({ error: 'Campo email é obrigatório' });
            }

            // Garantir que o status seja uma string e esteja em maiúsculas
            const normalizedStatus = status ? String(status).toUpperCase() : 'ATIVO';

            const updateData = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role,
                status: normalizedStatus
            };

            console.log('Dados que serão atualizados:', JSON.stringify(updateData, null, 2));
            console.log('Query que será executada:');
            console.log(`UPDATE User SET name='${name.trim()}', email='${email.trim().toLowerCase()}', role='${role}', status='${normalizedStatus}' WHERE id=${id}`);

            // Se uma nova senha for fornecida, criptografa
            if (password && password.trim() !== '') {
                updateData.password = await bcrypt.hash(password, 10);
                console.log('Senha será atualizada (hash gerado)');
            }

            console.log('=== ANTES DO UPDATE ===');
            console.log('Verificando usuário atual no banco ANTES do update...');

            // Verificar dados atuais ANTES do update
            const currentUser = await prisma.user.findUnique({
                where: { id: parseInt(id) },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    updatedAt: true
                }
            });

            console.log('Dados ATUAIS no banco:', JSON.stringify(currentUser, null, 2));
            console.log('Dados que serão ENVIADOS:', JSON.stringify(updateData, null, 2));

            console.log('Executando update no Prisma...');

            let updatedUser;
            try {
                updatedUser = await prisma.user.update({
                    where: { id: parseInt(id) },
                    data: updateData,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        status: true,
                        updatedAt: true
                    }
                });

                console.log('=== UPDATE EXECUTADO COM SUCESSO ===');
                console.log('Usuário retornado do banco APÓS update:', JSON.stringify(updatedUser, null, 2));

                // Verificar se os dados realmente foram alterados no banco
                const verifyUser = await prisma.user.findUnique({
                    where: { id: parseInt(id) },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        status: true,
                        updatedAt: true
                    }
                });

                console.log('=== VERIFICAÇÃO FINAL NO BANCO ===');
                console.log('Dados atuais no banco APÓS update:', JSON.stringify(verifyUser, null, 2));

                // Comparar dados
                console.log('=== COMPARAÇÃO DETALHADA ===');
                console.log('Nome ANTES:', currentUser.name);
                console.log('Nome ENVIADO:', updateData.name);
                console.log('Nome APÓS:', verifyUser.name);
                console.log('Nome foi alterado?', currentUser.name !== verifyUser.name);

                if (currentUser.name === verifyUser.name) {
                    console.error('🚨 PROBLEMA: Nome não foi alterado no banco!');
                    console.error('Dados atuais:', currentUser.name);
                    console.error('Dados enviados:', updateData.name);
                    console.error('Dados após update:', verifyUser.name);
                } else {
                    console.log('✅ SUCESSO: Nome foi alterado no banco');
                }

            } catch (updateError) {
                console.error('🚨 ERRO DURANTE O UPDATE:', updateError);
                console.error('Erro completo:', JSON.stringify(updateError, null, 2));
                throw updateError;
            }

            console.log('=== FINAL ===');
            console.log('Enviando resposta para o frontend:', JSON.stringify(updatedUser, null, 2));
            res.json(updatedUser);

        } catch (error) {
            console.error('Erro geral ao atualizar usuário:', error);

            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }

            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'Este email já está em uso' });
            }

            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Remove um usuário (apenas admin)
     */
    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            // Impede a exclusão do próprio usuário
            if (req.user.id === parseInt(id)) {
                return res.status(400).json({ error: 'Você não pode remover seu próprio usuário' });
            }

            await prisma.user.delete({
                where: { id: parseInt(id) }
            });

            res.json({ message: 'Usuário removido com sucesso' });

        } catch (error) {
            console.error('Erro ao remover usuário:', error);
            
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Usuário não encontrado' });
            }
            
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Obtém as permissões de um usuário
     */
    async getUserPermissions(req, res) {
        try {
            const { id } = req.params;

            const permissions = await prisma.userPermission.findMany({
                where: { userId: parseInt(id) },
                select: {
                    module: true,
                    canView: true,
                    canCreate: true,
                    canEdit: true,
                    canDelete: true
                }
            });

            res.json(permissions);

        } catch (error) {
            console.error('Erro ao buscar permissões do usuário:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Atualiza as permissões de um usuário
     */
    async updateUserPermissions(req, res) {
        try {
            const { id } = req.params;
            const { permissions } = req.body;

            // Inicia uma transação para garantir a integridade dos dados
            const result = await prisma.$transaction(async (prisma) => {
                // Remove todas as permissões existentes do usuário
                await prisma.userPermission.deleteMany({
                    where: { userId: parseInt(id) }
                });

                // Cria as novas permissões
                const newPermissions = await prisma.userPermission.createMany({
                    data: permissions.map(perm => ({
                        userId: parseInt(id),
                        module: perm.module,
                        canView: perm.canView || false,
                        canCreate: perm.canCreate || false,
                        canEdit: perm.canEdit || false,
                        canDelete: perm.canDelete || false
                    }))
                });

                return newPermissions;
            });

            res.json({ message: 'Permissões atualizadas com sucesso', data: result });

        } catch (error) {
            console.error('Erro ao atualizar permissões do usuário:', error);
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = userController;
