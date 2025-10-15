const { PrismaClient, RoleName, UserStatus, StatusCliente } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Função para gerar CPF fictício (apenas para testes)
function gerarCPF() {
  const n = 9;
  let n1 = Math.round(Math.random() * n);
  let n2 = Math.round(Math.random() * n);
  let n3 = Math.round(Math.random() * n);
  let n4 = Math.round(Math.random() * n);
  let n5 = Math.round(Math.random() * n);
  let n6 = Math.round(Math.random() * n);
  let n7 = Math.round(Math.random() * n);
  let n8 = Math.round(Math.random() * n);
  let n9 = Math.round(Math.random() * n);
  let d1 = n9*2 + n8*3 + n7*4 + n6*5 + n5*6 + n4*7 + n3*8 + n2*9 + n1*10;
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  let d2 = d1*2 + n9*3 + n8*4 + n7*5 + n6*6 + n5*7 + n4*8 + n3*9 + n2*10 + n1*11;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  return `${n1}${n2}${n3}.${n4}${n5}${n6}.${n7}${n8}${n9}-${d1}${d2}`;
}

// Função para gerar telefone
function gerarTelefone() {
  const ddd = Math.floor(Math.random() * 90) + 10; // 10 a 99
  const numero = Math.floor(Math.random() * 900000000) + 100000000; // 9 dígitos
  return `(${ddd}) 9${numero.toString().substring(0, 4)}-${numero.toString().substring(4)}`;
}

// Função para gerar data de nascimento (entre 18 e 80 anos atrás)
function gerarDataNascimento() {
  const hoje = new Date();
  const dataMin = new Date(hoje.getFullYear() - 80, 0, 1);
  const dataMax = new Date(hoje.getFullYear() - 18, 0, 1);
  return new Date(dataMin.getTime() + Math.random() * (dataMax.getTime() - dataMin.getTime()));
}

// Dados estáticos
const nomes = [
  'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Julia', 'Marcos', 'Carla', 'Ricardo', 'Fernanda',
  'Gustavo', 'Patricia', 'Rodrigo', 'Amanda', 'Felipe', 'Larissa', 'Diego', 'Camila', 'Rafael', 'Isabela'
];

const sobrenomes = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Costa', 'Ferreira', 'Almeida', 'Carvalho',
  'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Cardoso', 'Dias', 'Fernandes', 'Gonçalves', 'Lopes', 'Nunes'
];

const especialidades = [
  'Cardiologia', 'Dermatologia', 'Endocrinologia', 'Gastroenterologia', 'Ginecologia',
  'Neurologia', 'Oftalmologia', 'Ortopedia', 'Pediatria', 'Psiquiatria'
];

const procedimentos = [
  { nome: 'Consulta Clínica', duracao: 30, preco: 150.00 },
  { nome: 'Exame de Sangue', duracao: 15, preco: 80.00 },
  { nome: 'Raio-X', duracao: 20, preco: 120.00 },
  { nome: 'Ultrassonografia', duracao: 30, preco: 200.00 },
  { nome: 'Eletrocardiograma', duracao: 25, preco: 180.00 },
  { nome: 'Endoscopia', duracao: 45, preco: 350.00 },
  { nome: 'Colonoscopia', duracao: 60, preco: 500.00 },
  { nome: 'Ressecção de Lesão de Pele', duracao: 40, preco: 400.00 },
  { nome: 'Aplicação de Botox', duracao: 30, preco: 600.00 },
  { nome: 'Biópsia', duracao: 35, preco: 450.00 },
  { nome: 'Punção Aspirativa', duracao: 25, preco: 300.00 },
  { nome: 'Avaliação Psicológica', duracao: 50, preco: 250.00 },
  { nome: 'Fisioterapia', duracao: 45, preco: 120.00 },
  { nome: 'Pequena Cirurgia', duracao: 90, preco: 800.00 },
  { nome: 'Retorno', duracao: 15, preco: 100.00 },
  { nome: 'Vacinação', duracao: 10, preco: 80.00 },
  { nome: 'Curativo', duracao: 15, preco: 50.00 },
  { nome: 'Avaliação Nutricional', duracao: 40, preco: 180.00 },
  { nome: 'Acompanhamento Pré-Natal', duracao: 30, preco: 200.00 },
  { nome: 'Avaliação Cardiológica', duracao: 45, preco: 350.00 }
];

const cidades = [
  { cidade: 'São Paulo', estado: 'SP' },
  { cidade: 'Rio de Janeiro', estado: 'RJ' },
  { cidade: 'Belo Horizonte', estado: 'MG' },
  { cidade: 'Porto Alegre', estado: 'RS' },
  { cidade: 'Curitiba', estado: 'PR' },
  { cidade: 'Salvador', estado: 'BA' },
  { cidade: 'Recife', estado: 'PE' },
  { cidade: 'Fortaleza', estado: 'CE' },
  { cidade: 'Brasília', estado: 'DF' },
  { cidade: 'Manaus', estado: 'AM' }
];

async function criarUsuarios() {
  console.log('Criando usuários...');
  
  // Criar usuário admin se não existir
  const adminExists = await prisma.user.findUnique({
    where: { email: 'admin@clinica.com' },
  });

  if (!adminExists) {
    await prisma.user.create({
      data: {
        name: 'Administrador do Sistema',
        email: 'admin@clinica.com',
        password: await bcrypt.hash('admin123', 10),
        role: RoleName.ADMIN,
        status: UserStatus.ATIVO,
      },
    });
    console.log('✅ Usuário administrador criado com sucesso!');
  } else {
    console.log('ℹ️  Usuário administrador já existe.');
  }

  // Criar 10 usuários comuns
  let usuariosCriados = 0;
  const totalUsuarios = 10;
  
  while (usuariosCriados < totalUsuarios) {
    const nome = `${nomes[Math.floor(Math.random() * nomes.length)]} ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}`;
    const email = `usuario${usuariosCriados + 1}@clinica.com`;
    
    try {
      // Verificar se o e-mail já existe
      const usuarioExistente = await prisma.user.findUnique({
        where: { email: email },
      });
      
      if (!usuarioExistente) {
        await prisma.user.create({
          data: {
            name: nome,
            email: email,
            password: await bcrypt.hash('senha123', 10),
            role: RoleName.USER,
            status: UserStatus.ATIVO,
          },
        });
        usuariosCriados++;
        console.log(`✅ Usuário ${usuariosCriados}/${totalUsuarios} criado: ${email}`);
      }
    } catch (error) {
      console.warn(`⚠️ Aviso ao criar usuário: ${error.message}`);
    }
  }
  
  console.log(`✅ ${usuariosCriados} usuários comuns criados com sucesso!`);
  return usuariosCriados;
}

async function criarClientes() {
  console.log('Criando clientes...');
  
  // Pegar todos os usuários para associar aos clientes
  const usuarios = await prisma.user.findMany();
  
  // Criar 20 clientes
  for (let i = 0; i < 20; i++) {
    try {
      const nome = `${nomes[Math.floor(Math.random() * nomes.length)]} ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}`;
      const cidade = cidades[Math.floor(Math.random() * cidades.length)];
      const cpf = gerarCPF();
      
      // Verificar se o CPF já existe
      const clienteExistente = await prisma.cliente.findUnique({
        where: { cpf: cpf },
      });
      
      if (!clienteExistente) {
        await prisma.cliente.create({
          data: {
            nome: nome,
            cpf: cpf,
            telefone: gerarTelefone(),
            email: `cliente${i + 1}@exemplo.com`,
            dataNascimento: gerarDataNascimento(),
            rua: `Rua ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}, ${Math.floor(Math.random() * 1000)}`,
            numero: String(Math.floor(Math.random() * 1000) + 1),
            bairro: `Bairro ${nomes[Math.floor(Math.random() * nomes.length)]}`,
            cidade: cidade.cidade,
            estado: cidade.estado,
            cep: `${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(100 + Math.random() * 900)}`,
            status: Object.values(StatusCliente)[Math.floor(Math.random() * Object.values(StatusCliente).length)],
            usuario: {
              connect: { id: usuarios[Math.floor(Math.random() * usuarios.length)].id }
            },
            criadoEm: new Date(),
            atualizadoEm: new Date()
          },
        });
        console.log(`✅ Cliente ${i + 1}/20 criado: ${nome}`);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao criar cliente: ${error.message}`);
    }
  }
  console.log('✅ Clientes criados com sucesso!');
}

async function criarProcedimentos() {
  console.log('Criando procedimentos...');
  
  for (let i = 0; i < procedimentos.length; i++) {
    const proc = procedimentos[i];
    try {
      await prisma.procedimentos.create({
        data: {
          name: proc.nome,
          descricao: `Descrição do procedimento de ${proc.nome.toLowerCase()}`,
          durationMins: proc.duracao,
          defaultPrice: proc.preco,
          ativo: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
      });
      console.log(`✅ Procedimento ${i + 1}/${procedimentos.length} criado: ${proc.nome}`);
    } catch (error) {
      console.warn(`⚠️ Erro ao criar procedimento ${proc.nome}: ${error.message}`);
    }
  }
  console.log(`✅ ${procedimentos.length} procedimentos criados com sucesso!`);
}

async function criarProfissionais() {
  console.log('Criando profissionais...');
  
  // Pegar todos os usuários disponíveis
  const usuarios = await prisma.user.findMany();
  const usuariosDisponiveis = [...usuarios];
  
  // Criar 20 profissionais
  for (let i = 0; i < 20; i++) {
    try {
      const nome = `Dr(a). ${nomes[Math.floor(Math.random() * nomes.length)]} ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}`;
      const especialidade = especialidades[Math.floor(Math.random() * especialidades.length)];
      const cidade = cidades[Math.floor(Math.random() * cidades.length)];
      const cpf = gerarCPF();
      
      // Verificar se o CPF já existe
      const profissionalExistente = await prisma.profissional.findUnique({
        where: { cpf: cpf },
      });
      
      if (!profissionalExistente) {
        // Se não houver mais usuários disponíveis, criar um novo
        let usuarioId;
        if (usuariosDisponiveis.length > 0) {
          const usuarioIndex = Math.floor(Math.random() * usuariosDisponiveis.length);
          usuarioId = usuariosDisponiveis[usuarioIndex].id;
          usuariosDisponiveis.splice(usuarioIndex, 1); // Remover o usuário da lista de disponíveis
        } else {
          const novoUsuario = await prisma.user.create({
            data: {
              name: nome,
              email: `profissional${i + 1}@clinica.com`,
              password: await bcrypt.hash('senha123', 10),
              role: RoleName.USER,
              status: UserStatus.ATIVO,
            },
          });
          usuarioId = novoUsuario.id;
        }
        
        await prisma.profissional.create({
          data: {
            nome: nome,
            cpf: cpf,
            rg: `${Math.floor(1000000 + Math.random() * 9000000)}`,
            telefone: gerarTelefone(),
            celular: gerarTelefone(),
            email: `profissional${i + 1}@clinica.com`,
            dataNascimento: gerarDataNascimento(),
            especialidade: especialidade,
            registro: `CRM-${Math.floor(10000 + Math.random() * 90000)}`,
            rua: `Rua ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}, ${Math.floor(Math.random() * 1000)}`,
            numero: String(Math.floor(Math.random() * 1000) + 1),
            bairro: `Bairro ${nomes[Math.floor(Math.random() * nomes.length)]}`,
            cidade: cidade.cidade,
            estado: cidade.estado,
            cep: `${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(100 + Math.random() * 900)}`,
            status: StatusCliente.ATIVO,
            especialidades: [especialidade],
            usuario: {
              connect: { id: usuarioId }
            },
            criadoEm: new Date(),
            atualizadoEm: new Date()
          },
        });
        console.log(`✅ Profissional ${i + 1}/20 criado: ${nome}`);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao criar profissional: ${error.message}`);
    }
  }
  console.log('✅ Profissionais criados com sucesso!');
}

async function criarConvenios() {
  console.log('Criando convênios...');
  
  const convenios = [
    { nome: 'Amil', descricao: 'Convênio Amil Saúde' },
    { nome: 'Bradesco Saúde', descricao: 'Convênio Bradesco Saúde' },
    { nome: 'SulAmérica', descricao: 'Convênio SulAmérica Saúde' },
    { nome: 'Unimed', descricao: 'Sistema Unimed' },
    { nome: 'Hapvida', descricao: 'Plano de Saúde Hapvida' },
    { nome: 'NotreDame Intermédica', descricao: 'NotreDame Intermédica Saúde' },
    { nome: 'São Francisco Saúde', descricao: 'Sistema São Francisco de Saúde' },
    { nome: 'Golden Cross', descricao: 'Golden Cross Assistência Internacional' },
    { nome: 'Allianz Saúde', descricao: 'Allianz Saúde' },
    { nome: 'Porto Seguro Saúde', descricao: 'Porto Seguro Saúde' }
  ];

  for (let i = 0; i < convenios.length; i++) {
    const convenio = convenios[i];
    try {
      await prisma.convenios.create({
        data: {
          nome: convenio.nome,
          descricao: convenio.descricao,
          ativo: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
      });
      console.log(`✅ Convênio ${i + 1}/${convenios.length} criado: ${convenio.nome}`);
    } catch (error) {
      console.warn(`⚠️ Erro ao criar convênio ${convenio.nome}: ${error.message}`);
    }
  }
  console.log(`✅ ${convenios.length} convênios criados com sucesso!`);
}

async function main() {
  try {
    console.log('🚀 Iniciando seed do banco de dados...\n');
    
    // Executar as funções de criação
    await criarUsuarios();
    await criarProcedimentos();
    await criarConvenios();
    await criarProfissionais();
    await criarClientes();
    
    console.log('\n✨ Seed concluído com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar o seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executa a função principal
main();
