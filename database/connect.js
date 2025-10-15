const { PrismaClient } = require("@prisma/client");

// Cria uma nova instância do Prisma Client
const prisma = new PrismaClient();

/**
 * Estabelece conexão com o banco de dados usando o Prisma Client
 * @returns {Promise<PrismaClient>} Instância do Prisma Client conectada
 * @throws {Error} Erro caso não consiga conectar ao banco de dados
 */
const connectToDatabase = async () => {
    try {
        // Tenta estabelecer a conexão
        await prisma.$connect();
        console.log("✅ Conectado ao banco de dados com sucesso");
        return prisma;
    } catch (error) {
        console.error("❌ Falha ao conectar ao banco de dados:", error);
        // Encerra o processo com falha em caso de erro de conexão
        process.exit(1);
    }
};

module.exports = {
    connectToDatabase, prisma
};