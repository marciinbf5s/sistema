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
            const { name, email, password, role, status } = req.body;

            console.log('=== INÍCIO DA ATUALIZAÇÃO ===');
            console.log('Dados brutos recebidos (req.body):', JSON.stringify(req.body, null, 2));
            console.log('Headers:', JSON.stringify(req.headers, null, 2));
            
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

            // Garantir que o status seja uma string e esteja em maiúsculas
            const normalizedStatus = status ? String(status).toUpperCase() : 'ATIVO';
            
            const updateData = { 
                name, 
                email, 
                role, 
                status: normalizedStatus
            };

            console.log('Dados que serão atualizados:', JSON.stringify(updateData, null, 2));

            // Se uma nova senha for fornecida, criptografa
            if (password) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            const user = await prisma.user.update({
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

            res.json(user);

        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            
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
