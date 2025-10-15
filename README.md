# Sistema de Agendamento para Clínicas

Sistema completo para gerenciamento de agendamentos de clínicas, com painel administrativo e área do cliente.

## Recursos

- Autenticação de usuários (login/registro)
- Gerenciamento de clientes
- Cadastro e gerenciamento de serviços
- Agendamento de consultas
- Painel administrativo
- API RESTful

## Pré-requisitos

- Node.js (v14 ou superior)
- PostgreSQL (v12 ou superior)
- npm ou yarn

## Configuração

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/sistema-agendamento-clinica.git
   cd sistema-agendamento-clinica
   ```

2. Instale as dependências:
   ```bash
   npm install
   # ou
   yarn
   ```

3. Configure as variáveis de ambiente:
   - Copie o arquivo `.env.example` para `.env`
   - Preencha as variáveis de acordo com o seu ambiente

4. Execute as migrações do banco de dados:
   ```bash
   npx prisma migrate dev --name init
   ```

5. (Opcional) Popule o banco de dados com dados iniciais:
   ```bash
   npx prisma db seed
   ```

## Executando a aplicação

Para iniciar o servidor em modo de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
```

Para iniciar em produção:

```bash
npm start
# ou
yarn start
```

A API estará disponível em `http://localhost:3001`

## Estrutura do Projeto

```
.
├── config/               # Configurações da aplicação
├── constants/            # Constantes e mensagens
├── controllers/          # Lógica de negócios
├── database/             # Configuração do banco de dados
├── middlewares/          # Middlewares do Express
├── models/               # Modelos do banco de dados (gerados pelo Prisma)
├── prisma/               # Schema do Prisma e migrações
├── routes/               # Definição das rotas da API
├── .env                  # Variáveis de ambiente
├── .env.example          # Exemplo de variáveis de ambiente
├── app.js                # Configuração do Express
├── index.js              # Ponto de entrada da aplicação
└── package.json          # Dependências e scripts
```

## Documentação da API

A documentação da API está disponível em `/api-docs` quando a aplicação estiver rodando em modo de desenvolvimento.

## Testes

Para executar os testes:

```bash
npm test
# ou
yarn test
```

## Deploy

1. Configure as variáveis de ambiente no servidor de produção
2. Instale as dependências em produção:
   ```bash
   npm install --production
   ```
3. Execute as migrações no banco de produção:
   ```bash
   npx prisma migrate deploy
   ```
4. Inicie o servidor com PM2 ou similar:
   ```bash
   pm2 start index.js --name "sistema-agendamento"
   ```

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Contato

Seu Nome - [@seu_twitter](https://twitter.com/seu_twitter)

Link do Projeto: [https://github.com/seu-usuario/sistema-agendamento-clinica](https://github.com/seu-usuario/sistema-agendamento-clinica)
