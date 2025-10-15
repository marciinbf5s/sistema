// API Service - Centraliza todas as chamadas para a API do backend

const API_BASE_URL = 'http://127.0.0.1:3000/api';

// Helper para fazer requisições autenticadas
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // Configura os headers padrão
    const headers = new Headers({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
    });
    
    // Adiciona o token de autenticação se existir
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        console.log('Token JWT encontrado e adicionado ao header');
    } else {
        console.warn('Nenhum token JWT encontrado no localStorage');
    }
    
    // Prepara as opções da requisição
    const requestOptions = {
        ...options,
        headers,
        credentials: 'include', // Importante para enviar cookies
        mode: 'cors', // Garante que o CORS seja tratado corretamente
        cache: 'no-store' // Evita cache nas requisições
    };
    
    // Se tiver body e não for uma string, converte para JSON
    if (options.body) {
        if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
            requestOptions.body = JSON.stringify(options.body);
        } else {
            // Se for uma string ou FormData, usa diretamente
            requestOptions.body = options.body;
        }
    }
    
    try {
        const fullUrl = `${API_BASE_URL}${url}`;
        console.log(`Fazendo requisição para: ${requestOptions.method || 'GET'} ${fullUrl}`);
        
        const response = await fetch(fullUrl, requestOptions);
        console.log(`Resposta recebida: ${response.status} ${response.statusText}`);
        
        // Handle 204 No Content responses
        if (response.status === 204) {
            return [];
        }

        // Verifica se a resposta é um JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text);
            throw new Error('Resposta inválida do servidor');
        }

        const data = await response.json();
        
        // Se a resposta indicar erro de autenticação, força o logout
        if (response.status === 401 || (data && data.error === 'AUTH_ERROR')) {
            console.error('Erro de autenticação, fazendo logout...');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Redirect to login page with error message
            const currentPath = window.location.pathname;
            if (!currentPath.includes('index.html')) {
                window.location.href = 'index.html?error=session_expired';
            }
            
            return null;
        }
        
        // Handle other errors
        if (!response.ok) {
            console.error('Erro na resposta da API:', data);
            const errorMessage = data?.message || data?.error || `Erro na requisição: ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        return data.success !== undefined ? data : { ...data, success: true };
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Autenticação
const authAPI = {
    login: async (email, password) => {
        return fetchWithAuth('/auth/login', {
            method: 'POST',
            body: { email, password },
            headers: {
                'Content-Type': 'application/json'
            }
        });
    },
    
    register: async (userData) => {
        return fetchWithAuth('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    
    getMe: async () => {
        return fetchWithAuth('/auth/me');
    }
};

// Usuários
const userAPI = {
    listUsers: async () => {
        return fetchWithAuth('/users');
    },
    
    getUserById: async (id) => {
        return fetchWithAuth(`/users/${id}`);
    }
};
// Clientes
const clientAPI = {
    createClient: async (clientData) => {
        console.log('Criando cliente...');
        try {
            const response = await fetchWithAuth('/clients', {
                method: 'POST',
                body: clientData
            });
            console.log('Resposta da API (criar cliente):', response);
            return response;
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            throw error;
        }
    },
    listMyClients: async () => {
        console.log('Buscando clientes...');
        try {
            const response = await fetchWithAuth('/clientes/my-clients');
            console.log('Resposta da API (clientes):', response);
            return response;
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            throw error;
        }
    },
    listAllClients: () => fetchWithAuth('/clientes'),
    getClientById: (id) => fetchWithAuth(`/clientes/${id}`),
    updateClient: (id, clientData) => {
        console.log(`Atualizando cliente ${id}...`);
        return fetchWithAuth(`/clientes/${id}`, {
            method: 'PUT',
            body: clientData
        });
    },
    deleteClient: (id) => {
        console.log(`Deletando cliente ${id}...`);
        return fetchWithAuth(`/clientes/${id}`, {
            method: 'DELETE'
        });
    }
};
// Serviços
const serviceAPI = {
    listServices: async () => {
        return await fetchWithAuth('/services');
    },
    
    getServiceById: async (id) => {
        return await fetchWithAuth(`/services/${id}`);
    },
    
    createService: async (serviceData) => {
        return await fetchWithAuth('/services', {
            method: 'POST',
            body: serviceData
        });
    },
    
    updateService: async (id, serviceData) => {
        return await fetchWithAuth(`/services/${id}`, {
            method: 'PUT',
            body: serviceData
        });
    },
    
    deleteService: async (id) => {
        return await fetchWithAuth(`/services/${id}`, {
            method: 'DELETE'
        });
    }
};

// Procedimentos
const procedureAPI = {
    listProcedures: async () => {
        return await fetchWithAuth('/procedimentos');
    },
    
    getProcedureById: async (id) => {
        return await fetchWithAuth(`/procedimentos/${id}`);
    },
    
    createProcedure: async (procedureData) => {
        return await fetchWithAuth('/procedimentos', {
            method: 'POST',
            body: procedureData
        });
    },
    
    updateProcedure: async (id, procedureData) => {
        return await fetchWithAuth(`/procedimentos/${id}`, {
            method: 'PUT',
            body: procedureData
        });
    },
    
    deleteProcedure: async (id) => {
        return await fetchWithAuth(`/procedimentos/${id}`, {
            method: 'DELETE'
        });
    },
    
    getProcedureById: async (id) => {
        return await fetchWithAuth(`/procedimentos/${id}`);
    }
};

// Agendamentos
const appointmentAPI = {
    createAppointment: async (appointmentData) => {
        return fetchWithAuth('/agendamentos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(appointmentData)
        });
    },
    
    checkAvailability: async (params) => {
        const queryParams = new URLSearchParams(params);
        return fetchWithAuth(`/agendamentos/disponibilidade?${queryParams}`);
    },
    
    listMyAppointments: async () => {
        return fetchWithAuth('/agendamentos/meus-agendamentos');
    },
    
    listAppointments: async (params = {}) => {
        const queryParams = new URLSearchParams(params);
        return fetchWithAuth(`/agendamentos?${queryParams}`);
    },
    
    updateAppointmentStatus: async (id, status) => {
        return fetchWithAuth(`/agendamentos/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
    },
    
    updateAppointment: async (id, data) => {
        return fetchWithAuth(`/agendamentos/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
    },
    
    cancelAppointment: async (id) => {
        return fetchWithAuth(`/agendamentos/${id}`, {
            method: 'DELETE'
        });
    },
    
    getAppointmentById: async (id) => {
        return fetchWithAuth(`/agendamentos/${id}`);
    }
};

// Exporta todas as APIs
const api = {
    auth: authAPI,
    users: userAPI,
    clients: clientAPI,
    services: serviceAPI,
    procedures: procedureAPI,
    appointments: appointmentAPI
};

// Export para testes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchWithAuth,
        ...api
    };
} else {
    // Define globalmente no navegador
    window.api = api;
}
