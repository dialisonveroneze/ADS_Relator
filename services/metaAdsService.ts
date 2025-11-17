import { AdAccount, KpiData, DataLevel } from '../types';

// --- ARQUITETURA DE PRODUÇÃO ---
// Em um aplicativo real, este arquivo não faria chamadas diretas para a API da Meta.
// Em vez disso, ele faria chamadas para o seu próprio servidor backend (ex: /api/accounts).
// O seu backend, então, faria a chamada segura para a API da Meta, adicionando a Chave Secreta
// ou um Access Token de servidor, protegendo assim suas credenciais.

const adAccounts: AdAccount[] = [
  { id: 'act_101', name: 'E-commerce de Moda - Vendas', balance: 450.75, spendingLimit: 5000, amountSpent: 4549.25, currency: 'BRL' },
  { id: 'act_102', name: 'App de Delivery - Instalações', balance: 3420.50, spendingLimit: 10000, amountSpent: 6579.50, currency: 'BRL' },
  { id: 'act_103', name: 'Imobiliária - Leads', balance: 0.00, spendingLimit: 2500, amountSpent: 2500.00, currency: 'BRL' },
  { id: 'act_104', name: 'Curso Online - Inscrições', balance: 5330.10, spendingLimit: 8000, amountSpent: 2669.90, currency: 'BRL' },
];

const generateKpiData = (level: DataLevel, count: number, prefix: string): KpiData[] => {
    const data: KpiData[] = [];
    const today = new Date().toISOString().split('T')[0];
    for (let i = 1; i <= count; i++) {
        const amountSpent = Math.random() * 200 + 50;
        const impressions = Math.floor(Math.random() * 40000 + 10000);
        const clicks = Math.floor(impressions * (Math.random() * 0.015 + 0.005));
        const results = Math.floor(clicks * (Math.random() * 0.1 + 0.02));
        data.push({
            id: `${prefix}_${i}`,
            name: `${level} ${i}`,
            level: level,
            date: today,
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
    // Em uma implementação real, o 'accessToken' seria usado para chamar a API da Meta.
    // Para a simulação, simplesmente retornamos os dados mocados.
    return fakeApiCall(adAccounts);
};

// Em um app real, o accessToken seria enviado ao seu backend no header 'Authorization'.
export const getKpiData = (accessToken: string | null, accountId: string, level: DataLevel): Promise<KpiData[]> => {
     if (!accessToken) {
        return Promise.reject(new Error("Authentication required."));
    }
    console.log(`Fetching KPIs for account ${accountId} at ${level} level...`);

    const accountData = kpiDatabase[accountId] || [];
    
    if (level === DataLevel.ACCOUNT) {
        const accountSummary = adAccounts.find(acc => acc.id === accountId);
        if (!accountSummary) return fakeApiCall([]);

        const totals: KpiData = {
            id: accountId, name: accountSummary.name, level: DataLevel.ACCOUNT, date: new Date().toISOString().split('T')[0],
            amountSpent: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, results: 0,
            costPerResult: 0, ctr: 0, cpc: 0, cpm: 0
        };

        accountData.forEach(item => {
            totals.amountSpent += item.amountSpent;
            totals.impressions += item.impressions;
            totals.reach += item.reach;
            totals.clicks += item.clicks;
            totals.linkClicks += item.linkClicks;
            totals.results += item.results;
        });

        totals.costPerResult = totals.results > 0 ? parseFloat((totals.amountSpent / totals.results).toFixed(2)) : 0;
        totals.ctr = totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
        totals.cpc = totals.clicks > 0 ? parseFloat((totals.amountSpent / totals.clicks).toFixed(2)) : 0;
        totals.cpm = totals.impressions > 0 ? parseFloat(((totals.amountSpent / totals.impressions) * 1000).toFixed(2)) : 0;
        
        return fakeApiCall([totals]);
    }
    
    const filteredData = accountData.filter(item => item.level === level);
    return fakeApiCall(filteredData);
};