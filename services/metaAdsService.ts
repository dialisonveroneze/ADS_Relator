import { AdAccount, KpiData, DataLevel, DateRangeOption } from '../types';

/**
 * Lida com a resposta de uma chamada fetch para a nossa API backend.
 * Converte a resposta para JSON se for bem-sucedida.
 * Lança um erro 'Unauthorized' para respostas 401.
 * Lança um erro genérico para outras falhas.
 * @param response A resposta do fetch.
 * @returns Uma promessa que resolve com os dados JSON.
 */
const handleApiResponse = async (response: Response) => {
    if (response.ok) {
        return response.json();
    }
    if (response.status === 401) {
        throw new Error('Unauthorized');
    }
    const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido na API.' }));
    throw new Error(errorData.message || `Erro ${response.status}`);
};


/**
 * Busca as contas de anúncio do usuário através do nosso backend.
 * @returns Uma promessa que resolve com um array de AdAccount.
 */
export const getAdAccounts = async (): Promise<AdAccount[]> => {
    const response = await fetch('/api/accounts');
    return handleApiResponse(response);
};

/**
 * Busca os dados de KPI para uma conta de anúncio, nível e período específicos.
 * @param accountId O ID da conta de anúncio.
 * @param level O nível de agregação dos dados (Conta, Campanha, etc.).
 * @param dateRange O período de tempo para a busca dos dados.
 * @returns Uma promessa que resolve com um array de KpiData.
 */
export const getKpiData = (accountId: string, level: DataLevel, dateRange: DateRangeOption): Promise<KpiData[]> => {
    const params = new URLSearchParams({ accountId, level, dateRange });
    const response = fetch(`/api/kpis?${params.toString()}`);
    return response.then(handleApiResponse);
};


/**
 * Envia uma requisição ao backend para encerrar a sessão do usuário.
 */
export const logout = async (): Promise<void> => {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
        console.error("Falha ao fazer logout:", error);
    }
};
