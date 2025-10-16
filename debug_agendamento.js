// Script para depuração do erro 400 na criação de agendamentos
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Rota de teste para criação de agendamento
router.post('/teste-agendamento', async (req, res) => {
    console.log('=== TESTE DE CRIAÇÃO DE AGENDAMENTO ===');
    console.log('Headers:', req.headers);
    console.log('Corpo da requisição (raw):', req.body);
    
    try {
        const { 
            clienteId, 
            profissionalId, 
            procedimentoId, 
            convenioId, 
            valorCobrado, 
            startTime, 
            endTime, 
            observacoes 
        } = req.body;

        console.log('Dados recebidos:', {
            clienteId,
            profissionalId,
            procedimentoId,
            convenioId,
            valorCobrado,
            startTime,
            endTime,
            observacoes
        });

        // Função para ajustar a data removendo o deslocamento de fuso horário
        const ajustarData = (dataString) => {
            console.log(`Ajustando data: ${dataString}`);
            if (!dataString) {
                console.log('Data vazia, retornando null');
                return null;
            }
            try {
                const data = new Date(dataString);
                if (isNaN(data.getTime())) {
                    console.error('Data inválida:', dataString);
                    return null;
                }

                // NÃO ajustar timezone — retornar exatamente o Date interpretado pelo Node
                console.log(`Data interpretada (sem ajuste): ${data.toISOString()}`);
                return data;
            } catch (error) {
                console.error('Erro ao ajustar data:', error);
                return null;
            }
        };

        // Validar dados obrigatórios
        if (!clienteId || !procedimentoId || !startTime || !endTime) {
            const errorMsg = `Campos obrigatórios faltando: ${!clienteId ? 'clienteId, ' : ''}${!procedimentoId ? 'procedimentoId, ' : ''}${!startTime ? 'startTime, ' : ''}${!endTime ? 'endTime' : ''}`;
            console.error('Erro de validação:', errorMsg);
            return res.status(400).json({
                success: false,
                error: errorMsg,
                details: {
                    clienteId: !!clienteId,
                    procedimentoId: !!procedimentoId,
                    startTime: !!startTime,
                    endTime: !!endTime
                }
            });
        }

        // Validar datas
        console.log('Validando datas...');
        const dataInicio = ajustarData(startTime);
        const dataFim = ajustarData(endTime);
        const agora = new Date();
        
        console.log('Datas processadas:', {
            dataInicio: dataInicio ? dataInicio.toISOString() : 'inválida',
            dataFim: dataFim ? dataFim.toISOString() : 'inválida',
            agora: agora.toISOString()
        });
        
        // Verificar se a data de início é válida
        if (!dataInicio || isNaN(dataInicio.getTime())) {
            console.error('Data de início inválida:', startTime);
            return res.status(400).json({
                success: false,
                error: 'Data/hora de início inválida',
                receivedValue: startTime,
                parsedValue: dataInicio
            });
        }

        // Verificar se a data de término é válida e posterior à data de início
        if (!dataFim || isNaN(dataFim.getTime()) || dataFim <= dataInicio) {
            console.error('Data de término inválida ou anterior à data de início:', {
                dataInicio: dataInicio.toISOString(),
                dataFim: dataFim ? dataFim.toISOString() : 'inválida'
            });
            return res.status(400).json({
                success: false,
                error: 'Data/hora de término inválida ou anterior à data de início',
                receivedValues: {
                    startTime,
                    endTime
                },
                parsedValues: {
                    dataInicio: dataInicio.toISOString(),
                    dataFim: dataFim ? dataFim.toISOString() : 'inválida'
                }
            });
        }

        // Verificar se a data de início não é no passado (com margem de 30 minutos)
        const margemMinima = 30 * 60 * 1000; // 30 minutos em milissegundos
        if (dataInicio.getTime() < (agora.getTime() - margemMinima)) {
            console.error('Data de início no passado:', {
                dataInicio: dataInicio.toISOString(),
                agora: agora.toISOString(),
                diferenca: agora.getTime() - dataInicio.getTime()
            });
            return res.status(400).json({
                success: false,
                error: 'Não é possível agendar para um horário que já passou. Por favor, selecione um horário futuro.'
            });
        }

        console.log('Tentando criar agendamento no banco de dados...');
        
        // Tentar criar o agendamento
        const agendamento = await prisma.agendamentos.create({
            data: {
                clienteId: parseInt(clienteId),
                profissionalId: profissionalId ? parseInt(profissionalId) : null,
                procedimentoId: parseInt(procedimentoId),
                convenioId: convenioId ? parseInt(convenioId) : null,
                valorCobrado: parseFloat(valorCobrado) || 0,
                startTime: dataInicio,
                endTime: dataFim,
                observacoes: observacoes || null,
                status: 'AGENDADO',
                updatedAt: new Date()
            },
            include: {
                clientes: true,
                profissionais: true,
                procedimentos: true,
                convenios: true
            }
        });

        console.log('Agendamento criado com sucesso:', agendamento);
        
        return res.status(201).json({
            success: true,
            message: 'Agendamento criado com sucesso',
            data: agendamento
        });
        
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno ao processar a requisição',
            details: error.message
        });
    }
});

module.exports = router;
