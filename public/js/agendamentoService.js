class AgendamentoService {
    static BASE_URL = '/api/agendamentos';

    // Buscar agendamentos por data
    static async buscarPorData(data) {
        try {
            const response = await fetch(`${this.BASE_URL}/por-periodo?dataInicio=${data}T00:00:00.000Z&dataFim=${data}T23:59:59.999Z`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao buscar agendamentos');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar agendamentos:', error);
            throw error;
        }
    }

    // Buscar clientes
    static async buscarClientes() {
        try {
            const response = await fetch('/api/clientes', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao buscar clientes');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            throw error;
        }
    }

    // Buscar procedimentos
    static async buscarProcedimentos() {
        try {
            const response = await fetch('/api/procedimentos', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao buscar procedimentos');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar procedimentos:', error);
            throw error;
        }
    }

    // Criar agendamento
    static async criarAgendamento(dados) {
        try {
            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erro ao criar agendamento');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao criar agendamento:', error);
            throw error;
        }
    }

    // Atualizar status do agendamento
    static async atualizarStatus(id, status) {
        try {
            const response = await fetch(`${this.BASE_URL}/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao atualizar status do agendamento');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            throw error;
        }
    }

    // Cancelar agendamento
    static async cancelarAgendamento(id) {
        try {
            const response = await fetch(`${this.BASE_URL}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao cancelar agendamento');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao cancelar agendamento:', error);
            throw error;
        }
    }
}
