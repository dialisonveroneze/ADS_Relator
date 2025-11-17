import { AdAccount, KpiData, DataLevel } from '../types';

// --- ARQUITETURA DE PRODUÇÃO - FLUXO DE AUTENTICAÇÃO OAUTH 2.0 ---
//
// O fluxo de dados em uma aplicação real e segura seria o seguinte:
//
// 1. FRONTEND: O usuário clica em "Conectar com o Meta".
//    - O app redireciona o usuário para a URL de autorização da Meta, incluindo:
//      - `client_id`: O seu App ID (público).
//      - `redirect_uri`: A URL para onde a Meta deve enviar o usuário de volta (ex: https://dashboard.mindfulmarketing.com.br/).
//      - `scope`: As permissões que o app está solicitando (ex: 'ads_read', 'read_insights').
//
// 2. META: O usuário vê a tela de permissão, aceita e é redirecionado de volta para a sua `redirect_uri`.
//    - A Meta adiciona um `code` (código de autorização temporário) como parâmetro na URL.
//
// 3. FRONTEND: A página carrega e extrai o `code` da URL.
//    - O frontend envia este `code` para o seu backend através de uma chamada de API segura (ex: POST /api/auth/meta).
//
// 4. BACKEND: O seu servidor recebe o `code`.
//    - O backend faz uma chamada de servidor-para-servidor para a API da Meta, enviando:
//      - `client_id`: Seu App ID.
//      - `client_secret`: Sua Chave Secreta do App (MANTIDA EM SEGURANÇA NO BACKEND).
//      - `code`: O código recebido do frontend.
//    - A Meta verifica tudo e retorna um `access_token` de longa duração para o seu backend.
//
// 5. BACKEND: O backend armazena o `access_token` de forma segura, associado ao usuário.
//    - Ele retorna uma resposta de sucesso para o frontend (ex: um cookie de sessão ou um token JWT).
//
// 6. FRONTEND: O frontend agora está "logado". Para buscar dados de anúncios:
//    - Ele faz chamadas para o seu próprio backend (ex: GET /api/accounts).
//    - O frontend NUNCA envia o `access_token` da Meta diretamente.
//
// 7. BACKEND: Ao receber uma chamada do frontend (ex: /api/accounts):
//    - O backend recupera o `access_token` do usuário.
//    - Ele faz a chamada para a API da Meta (Graph API), adicionando o `access_token` no header.
//    - Ele recebe os dados da Meta, formata se necessário, e os envia de volta para o frontend.
//
// Este serviço simulado abaixo representa o passo 7, pulando todo o fluxo de autenticação.

const adAccounts: AdAccount[] = [
  { id: 'act_101', name: 'E-commerce de Moda - Vendas', balance: 450.75, spendingLimit: 5000, amountSpent: 4549.25, currency: 'BRL' },
  { id: 'act_102', name: 'App de Delivery - Instalações', balance: 3420.50, spendingLimit: 10000, amountSpent: 6579.50, currency: 'BRL' },
  { id: 'act_103', name: 'Imobiliária - Leads', balance: 0.00, spendingLimit: 2500, amountSpent: 2500.00, currency: 'BRL' },
  { id: 'act_104', name: 'Curso Online - Inscrições', balance: 5330.10, spendingLimit: 8000, amountSpent: 2669.90, currency: 'BRL' },
];

const generateKpiData = (level: DataLevel, count: number, prefix: string): KpiData[] => {
    const data: KpiData[] = [];
    const baseDate = new Date();

    for (let day = 13; day >= 0; day--) { // Generate data for the last 14 days
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() - day);
        const dateString = date.toISOString().split('T')[0];

        for (let i = 1; i <= count; i++) {
            // Add some variation based on day to make chart look more real
            const dayFactor = 1 - (day / 20); // slight upward trend
            const randomFactor = Math.random() * 0.4 + 0.8; // +/- 20% randomness
            
            const amountSpent = (Math.random() * 100 + 20) * dayFactor * randomFactor;
            const impressions = Math.floor((Math.random() * 20000 + 5000) * dayFactor * randomFactor);
            const clicks = Math.floor(impressions * (Math.random() * 0.015 + 0.005));
            const results = Math.floor(clicks * (Math.random() * 0.1 + 0.02));

            data.push({
                id: `${prefix}_${i}_${dateString}`,
                name: `${level} ${i}`,
                level: level,
                date: dateString,
                amountSpent: parseFloat(amountSpent.toFixed(2)),
                impressions: impressions,
                reach: Math.floor(impressions * (Math.random() * 0.2 + 0.7)),
                clicks: clicks,
                linkClicks: Math.floor(clicks * (Math.random() * 0.2 + 0.75)),
                results: results > 0 ? results : 0,
                costPerResult: results > 0 ? parseFloat((amountSpent / results).toFixed(2)) : 0,
                ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
                cpc: clicks > 0 ? parseFloat((amountSpent / clicks).toFixed(2)) : 0,
                cpm: impressions > 0 ? parseFloat(((amountSpent / impressions) * 1000).toFixed(2)) : 0,
            });
        }
    }
    return data;
};


const kpiDatabase: Record<string, KpiData[]> = {
    'act_101': [
        ...generateKpiData(DataLevel.CAMPAIGN, 3, 'camp_101'),
        ...generateKpiData(DataLevel.AD_SET, 6, 'adset_101'),
        ...generateKpiData(DataLevel.AD, 12, 'ad_101'),
    ],
    'act_102': [
        ...generateKpiData(DataLevel.CAMPAIGN, 2, 'camp_102'),
        ...generateKpiData(DataLevel.AD_SET, 4, 'adset_102'),
        ...generateKpiData(DataLevel.AD, 8, 'ad_102'),
    ],
     'act_103': [
        ...generateKpiData(DataLevel.CAMPAIGN, 4, 'camp_103'),
        ...generateKpiData(DataLevel.AD_SET, 8, 'adset_103'),
        ...generateKpiData(DataLevel.AD, 16, 'ad_103'),
    ],
     'act_104': [
        ...generateKpiData(DataLevel.CAMPAIGN, 1, 'camp_104'),
        ...generateKpiData(DataLevel.AD_SET, 2, 'adset_104'),
        ...generateKpiData(DataLevel.AD, 4, 'ad_104'),
    ],
};

const fakeApiCall = <T,>(data: T): Promise<T> => {
    return new Promise(resolve => setTimeout(() => resolve(data), 500));
}

export const getAdAccounts = async (accessToken: string | null): Promise<AdAccount[]> => {
    if (!accessToken) {
         return Promise.reject(new Error("Authentication required."));
    }
    console.log("Fetching ad accounts with token...");
    // Em uma implementação real, o backend usaria o 'accessToken' para chamar a API da Meta.
    return fakeApiCall(adAccounts);
};

export const getKpiData = (accessToken: string | null, accountId: string, level: DataLevel): Promise<KpiData[]> => {
     if (!accessToken) {
        return Promise.reject(new Error("Authentication required."));
    }
    console.log(`Fetching KPIs for account ${accountId} at ${level} level...`);

    const accountData = kpiDatabase[accountId] || [];
    
    if (level === DataLevel.ACCOUNT) {
        const accountSummary = adAccounts.find(acc => acc.id === accountId);
        if (!accountSummary) return fakeApiCall([]);

        const dailyTotals: { [date: string]: KpiData } = {};

        accountData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = {
                    id: `${accountId}_${item.date}`, name: `Resumo Diário - ${item.date}`, level: DataLevel.ACCOUNT, date: item.date,
                    amountSpent: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, results: 0,
                    costPerResult: 0, ctr: 0, cpc: 0, cpm: 0
                };
            }
            const totals = dailyTotals[item.date];
            totals.amountSpent += item.amountSpent;
            totals.impressions += item.impressions;
            totals.reach += item.reach;
            totals.clicks += item.clicks;
            totals.linkClicks += item.linkClicks;
            totals.results += item.results;
        });

        Object.values(dailyTotals).forEach(totals => {
            totals.costPerResult = totals.results > 0 ? parseFloat((totals.amountSpent / totals.results).toFixed(2)) : 0;
            totals.ctr = totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
            totals.cpc = totals.clicks > 0 ? parseFloat((totals.amountSpent / totals.clicks).toFixed(2)) : 0;
            totals.cpm = totals.impressions > 0 ? parseFloat(((totals.amountSpent / totals.impressions) * 1000).toFixed(2)) : 0;
        });

        const sortedTotals = Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
        return fakeApiCall(sortedTotals);
    }
    
    const filteredData = accountData.filter(item => item.level === level);
    return fakeApiCall(filteredData);
};