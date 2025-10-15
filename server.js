require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const http = require('http');
const { connectToDatabase, prisma } = require('./database/connect');

// Importação das rotas
const authRoutes = require('./routes/auth.routes');
const agendamentoRoutes = require('./routes/agendamento.routes');
const clientRoutes = require('./routes/client.routes');
const userRoutes = require('./routes/user.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const procedimentoRoutes = require('./routes/procedimento.routes');
const convenioRoutes = require('./routes/convenio.routes');
const professionalRoutes = require('./routes/professional.routes');

// Inicializa o aplicativo Express
const app = express();

// Middlewares
const allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost',
    'http://127.0.0.1'
];

// Configuração CORS para requisições com credenciais
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Verifica se a origem está na lista de permitidas
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Responde imediatamente para requisições OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Configuração do body parser para JSON
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.use(cookieParser());

// Configuração de sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Conecta ao banco de dados
connectToDatabase()
    .then(() => console.log('✅ Conexão com o banco de dados estabelecida'))
    .catch(err => console.error('❌ Erro na conexão com o banco de dados:', err));

// Configuração para servir arquivos estáticos
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Rotas estáticas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/clientes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'clientes.html'));
});

app.get('/servicos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'servicos.html'));
});

app.get('/procedimentos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'procedimentos.html'));
});

app.get('/agendamentos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'agendamentos.html'));
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/agendamentos', agendamentoRoutes);
app.use('/api/clientes', clientRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/procedimentos', procedimentoRoutes);
app.use('/api/convenios', convenioRoutes);
app.use('/api/profissionais', professionalRoutes);

// Endpoint de verificação de saúde
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('❌ Erro:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Configuração do servidor HTTP
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Função para tratamento de erros do servidor
const onError = (error) => {
    if (error.syscall !== 'listen') {
        throw error;
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requer privilégios elevados');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' já está em uso');
            process.exit(1);
            break;
        default:
            throw error;
    }
};

// Função para quando o servidor inicia
const onListening = () => {
    const addr = server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
};

// Inicia o servidor
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// Função para desligamento gracioso
const shutdown = () => {
    console.log('\n🛑 Recebido sinal de desligamento. Encerrando servidor...');
    
    server.close(async () => {
        console.log('✅ Servidor HTTP encerrado');
        
        try {
            // Fecha a conexão com o Prisma
            await prisma.$disconnect();
            console.log('✅ Conexão com o banco de dados encerrada');
        } catch (err) {
            console.error('❌ Erro ao encerrar a conexão com o banco de dados:', err);
            process.exit(1);
        }
        
        process.exit(0);
    });

    // Força o encerramento após 10 segundos se não conseguir encerrar graciosamente
    setTimeout(() => {
        console.error('❌ Forçando encerramento...');
        process.exit(1);
    }, 10000);
};

// Escuta por sinais de desligamento
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não capturado:', err);
    // Não encerrar o processo em desenvolvimento para permitir a depuração
    if (process.env.NODE_ENV === 'production') process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Rejeição não tratada em:', promise, 'motivo:', reason);
    // Não encerrar o processo em desenvolvimento para permitir a depuração
    if (process.env.NODE_ENV === 'production') process.exit(1);
});

// Mensagem de boas-vindas
console.log('🔄 Iniciando o servidor...');
