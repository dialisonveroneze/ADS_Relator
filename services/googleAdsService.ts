
import { AdAccount, KpiData, DataLevel, DateRangeOption } from '../types';

const handleApiResponse = async (response: Response) => {
    if (response.ok) {
        return response.json();
    }
    if (response.status === 401) {
        throw new Error('Unauthorized');
    }
    const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido na API do Google.' }));
    throw new Error(errorData.message || `Erro ${response.status}`);
};

export const getGoogleAdAccounts = async (): Promise<AdAccount[]> => {
    const response = await fetch('/api/google/accounts');
    return handleApiResponse(response);
};

export const getGoogleKpiData = (accountId: string, level: DataLevel, dateRange: DateRangeOption): Promise<KpiData[]> => {
    const params = new URLSearchParams({ accountId, level, dateRange });
    const response = fetch(`/api/google/kpis?${params.toString()}`);
    return response.then(handleApiResponse);
};
