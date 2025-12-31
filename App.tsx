
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BalanceList from './components/BalanceList';
import BalanceCard from './components/BalanceCard';
import LineChart from './components/LineChart';
import KpiTable from './components/KpiTable';
import LoginScreen from './components/LoginScreen';
import SubscriptionGate from './components/SubscriptionGate';
import { getAdAccounts, getKpiData, logout } from './services/metaAdsService';
import { getGoogleAdAccounts, getGoogleKpiData } from './services/googleAdsService';
import { getSubscriptionStatus } from './services/subscriptionService';
import { AdAccount, KpiData, DataLevel, DATA_LEVEL_LABELS, DateRangeOption, UserSubscription } from './types';

const chartMetrics = {
    amountSpent: { label: 'Valor Gasto' },
    impressions: { label: 'Impressões' },
    reach: { label: 'Alcance' },
    results: { label: 'Resultados' },
    clicks: { label: 'Cliques (Todos)' },
    inlineLinkClicks: { label: 'Cliques no Link' },
};
type ChartMetric = keyof typeof chartMetrics;

const dateRangeOptions: { key: DateRangeOption; label: string }[] = [
    { key: 'last_7_days', label: 'Últimos 7 dias' },
    { key: 'last_14_days', label: 'Últimos 14 dias' },
    { key: 'last_30_days', label: 'Últimos 30 dias' },
    { key: 'this_month', label: 'Este Mês' },
    { key: 'last_month', label: 'Mês Passado' },
];

const App: React.FC = () => {
    const [authStatus, setAuthStatus] = useState<{ meta: boolean; google: boolean; checked: boolean }>({
        meta: false,
        google: false,
        checked: false
    });
    
    const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'google'>('meta');
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState<boolean>(false);
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [kpiData, setKpiData] = useState<KpiData[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<DataLevel>(DataLevel.ACCOUNT);
    const [dateRange, setDateRange] = useState<DateRangeOption>('last_14_days');
    const [chartMetric, setChartMetric] = useState<ChartMetric>('amountSpent');
    const [showChart, setShowChart] = useState<boolean>(true);
    const [showBalanceList, setShowBalanceList] = useState<boolean>(true);
    const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);

    const checkSubscription = useCallback(async () => {
        setIsLoadingSubscription(true);
        try {
            const subData = await getSubscriptionStatus();
            setSubscription(subData);
        } catch (e) { console.error(e); } finally { setIsLoadingSubscription(false); }
    }, []);

    const fetchAccounts = useCallback(async (platform: 'meta' | 'google') => {
        setIsLoadingAccounts(true);
        setError(null);
        setAdAccounts([]);
        setSelectedAccountIds([]);
        
        try {
            let accounts: AdAccount[] = [];
            if (platform === 'meta') {
                accounts = await getAdAccounts();
            } else {
                accounts = await getGoogleAdAccounts();
            }

            const taggedAccounts = accounts.map(acc => ({ ...acc, provider: platform }));
            setAdAccounts(taggedAccounts);
            if (taggedAccounts.length > 0) setSelectedAccountIds([taggedAccounts[0].id]);
            setAuthStatus(prev => ({ ...prev, [platform]: true }));

        } catch (err: any) {
            if (err.message === 'Unauthorized') {
                setAuthStatus(prev => ({ ...prev, [platform]: false }));
            } else {
                setError(err.message);
            }
        } finally { setIsLoadingAccounts(false); }
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            await checkSubscription();
            try {
                await fetchAccounts(selectedPlatform);
                const otherPlatform = selectedPlatform === 'meta' ? 'google' : 'meta';
                try {
                    if (otherPlatform === 'meta') await getAdAccounts();
                    else await getGoogleAdAccounts();
                    setAuthStatus(prev => ({ ...prev, [otherPlatform]: true, checked: true }));
                } catch (e) { setAuthStatus(prev => ({ ...prev, [otherPlatform]: false, checked: true })); }
            } catch (e) { setAuthStatus(prev => ({ ...prev, checked: true })); }
        };
        checkAuth();
    }, [selectedPlatform, fetchAccounts, checkSubscription]);

    const handlePlatformSwitch = (platform: 'meta' | 'google') => {
        setError(null);
        setSelectedPlatform(platform);
        setKpiData([]);
        setSelectedAccountIds([]);
        setSelectedEntityIds([]);
        fetchAccounts(platform);
    };
    
    const handleLogout = async () => {
        await logout();
        setAuthStatus({ meta: false, google: false, checked: true });
        window.location.href = `/?logged_out=true`;
    };

    const fetchKpiData = useCallback(async () => {
        if (selectedAccountIds.length === 0) return;
        setIsLoadingKpis(true);
        setError(null);
        setSelectedEntityIds([]);
        try {
            let allKpis: KpiData[] = [];
            const fetchPromises = selectedAccountIds.map(async (id) => {
                return selectedPlatform === 'meta' 
                    ? getKpiData(id, selectedLevel, dateRange) 
                    : getGoogleKpiData(id, selectedLevel, dateRange);
            });
            const results = await Promise.all(fetchPromises);
            results.forEach(data => { allKpis = [...allKpis, ...data]; });
            setKpiData(allKpis);
        } catch (err: any) { setError(err.message); } finally { setIsLoadingKpis(false); }
    }, [selectedAccountIds, selectedLevel, dateRange, selectedPlatform]);

    useEffect(() => { if (selectedAccountIds.length > 0) fetchKpiData(); }, [fetchKpiData, selectedAccountIds]);

    const consolidatedAccount = useMemo(() => {
        if (selectedAccountIds.length === 0) return null;
        const selected = adAccounts.filter(acc => selectedAccountIds.includes(acc.id));
        if (selected.length === 1) return selected[0];
        return selected.reduce((acc, curr) => ({
            ...acc, name: 'Resumo Consolidado', balance: acc.balance + curr.balance, amountSpent: acc.amountSpent + curr.amountSpent, spendingLimit: acc.spendingLimit + curr.spendingLimit, currency: curr.currency
        }), { id: 'summary', name: 'Resumo', balance: 0, amountSpent: 0, spendingLimit: 0, currency: 'BRL', provider: selectedPlatform });
    }, [selectedAccountIds, adAccounts, selectedPlatform]);
    
    const aggregatedChartData = useMemo(() => {
        let dailyData = kpiData.filter(d => !d.isPeriodTotal);
        if (selectedEntityIds.length > 0) dailyData = dailyData.filter(d => selectedEntityIds.includes(d.entityId));
        const dailyTotals: { [date: string]: KpiData } = {};
        dailyData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = { id: item.date, entityId: item.date, name: `Total - ${item.date}`, level: selectedLevel, date: item.date, amountSpent: 0, impressions: 0, cpm: 0, reach: 0, clicks: 0, inlineLinkClicks: 0, ctr: 0, cpc: 0, costPerInlineLinkClick: 0, results: 0, costPerResult: 0 };
            }
            const totals = dailyTotals[item.date];
            totals.amountSpent += item.amountSpent; totals.impressions += item.impressions; totals.reach += item.reach; totals.clicks += item.clicks; totals.inlineLinkClicks += item.inlineLinkClicks; totals.results += item.results;
        });
        return Object.values(dailyTotals).map(totals => {
            totals.cpm = totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0; totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0; totals.cpc = totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0; totals.costPerResult = totals.results > 0 ? (totals.amountSpent / totals.results) : 0;
            return totals;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [kpiData, selectedLevel, selectedEntityIds]);
    
    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        if (selectedLevel === DataLevel.ACCOUNT) return aggregatedChartData.map(d => ({ ...d, name: new Date(d.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }));
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        const sourceData = summaryData.length > 0 ? summaryData : kpiData.filter(d => !d.isPeriodTotal);
        const aggregated: { [id: string]: KpiData } = {};
        sourceData.forEach(item => {
            if (!aggregated[item.entityId]) aggregated[item.entityId] = { ...item, amountSpent: 0, impressions: 0, reach: 0, clicks: 0, inlineLinkClicks: 0, results: 0 };
            const totals = aggregated[item.entityId];
            totals.amountSpent += item.amountSpent; totals.impressions += item.impressions; totals.reach += item.reach; totals.clicks += item.clicks; totals.inlineLinkClicks += item.inlineLinkClicks; totals.results += item.results;
        });
        return Object.values(aggregated).map(totals => {
            totals.cpm = totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0; totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0; totals.cpc = totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0; totals.costPerResult = totals.results > 0 ? (totals.amountSpent / totals.results) : 0;
            return totals;
        });
    }, [kpiData, selectedLevel, aggregatedChartData]);

    const handleAccountSelect = (account: AdAccount | null, isAll?: boolean) => {
        if (isAll) {
            const allIds = adAccounts.map(a => a.id);
            setSelectedAccountIds(selectedAccountIds.length === adAccounts.length ? [adAccounts[0]?.id] : allIds);
        } else if (account) setSelectedAccountIds([account.id]);
        setKpiData([]); setSelectedEntityIds([]);
    };

    const Dashboard = () => {
        const isPlatformAuthenticated = selectedPlatform === 'meta' ? authStatus.meta : authStatus.google;
        const isTokenError = error && (error.includes('TOKEN FALTANDO') || error.includes('CONFIGURAÇÃO PENDENTE') || error.includes('supported'));

        const usageText = "O objetivo desta API é alimentar um dashboard interno de monitoramento de performance para a Mindful Agência de Marketing. Utilizaremos a API exclusivamente para a leitura de métricas (gastos, cliques, impressões e conversões) de contas gerenciadas em nossa MCC. O sistema servirá para consolidar dados financeiros e acompanhar KPIs em tempo real para controle de saldo e otimização manual de campanhas. Não utilizaremos a API para criação automatizada de anúncios ou gerenciamento de lances em massa.";

        return (
            <main className="container mx-auto p-4 md:p-6 space-y-8">
                <SubscriptionGate subscription={subscription} isLoading={isLoadingSubscription} onSubscriptionUpdate={checkSubscription}>
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl inline-flex border border-gray-100 dark:border-gray-700">
                                <button onClick={() => handlePlatformSwitch('meta')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedPlatform === 'meta' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>META ADS</button>
                                <button onClick={() => handlePlatformSwitch('google')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedPlatform === 'google' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>GOOGLE ADS</button>
                            </div>
                        </div>

                        {error && (
                            <div className={`border-l-4 p-8 rounded-r-2xl mb-8 shadow-2xl animate-in fade-in slide-in-from-top-4 ${isTokenError ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-red-50 border-red-500 text-red-900'}`}>
                                <div className="flex gap-6 flex-col md:flex-row">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${isTokenError ? 'bg-amber-200' : 'bg-red-200'}`}>
                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    </div>
                                    <div className="flex-grow">
                                        <h4 className="font-black text-xl mb-3">{isTokenError ? 'Checklist de Configuração Google' : 'Atenção'}</h4>
                                        <div className="prose prose-amber max-w-none text-sm leading-relaxed mb-6">
                                            {isTokenError ? (
                                                <div className="space-y-4">
                                                    <p>O Google retornou um erro de permissão ou configuração. Verifique as 3 variáveis na sua Vercel:</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                                        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                                            <div className="text-amber-600 font-bold mb-1">GOOGLE_CLIENT_ID</div>
                                                            <div className="text-[10px] text-gray-400 break-all">Vem do Google Cloud (OAuth 2.0)</div>
                                                        </div>
                                                        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                                            <div className="text-amber-600 font-bold mb-1">GOOGLE_CLIENT_SECRET</div>
                                                            <div className="text-[10px] text-gray-400">Vem do Google Cloud (Segredo)</div>
                                                        </div>
                                                        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                                                            <div className="text-amber-600 font-bold mb-1">GOOGLE_DEVELOPER_TOKEN</div>
                                                            <div className="text-[10px] text-gray-400">Vem do Centro de API da MCC</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-6 bg-amber-100 p-6 rounded-2xl border border-amber-200">
                                                        <p className="font-bold text-amber-800 mb-2">💡 Texto para o campo "Uso Pretendido":</p>
                                                        <div className="bg-white p-3 rounded border border-amber-300 font-mono text-[10px] relative group">
                                                            {usageText}
                                                            <button 
                                                                onClick={() => { navigator.clipboard.writeText(usageText); alert('Copiado!'); }}
                                                                className="absolute top-2 right-2 bg-amber-600 text-white px-2 py-1 rounded text-[10px] hover:bg-amber-700"
                                                            >Copiar</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p>{error}</p>
                                            )}
                                        </div>
                                        {isTokenError && (
                                            <div className="flex flex-wrap gap-4">
                                                <a href="https://ads.google.com/home/tools/manager-accounts/" target="_blank" rel="noreferrer" className="bg-amber-600 text-white px-6 py-3 rounded-xl text-sm font-black shadow-lg hover:bg-amber-700 transition-all transform hover:scale-105">Abrir Google Ads MCC</a>
                                                <button onClick={() => window.location.reload()} className="bg-white border-2 border-amber-300 px-6 py-3 rounded-xl text-sm font-black text-amber-700 hover:bg-amber-50 transition-all">Já Configurei, Recarregar</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!isPlatformAuthenticated ? (
                            <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-[2rem] shadow-2xl max-w-2xl mx-auto border border-gray-100 dark:border-gray-700">
                                <div className={`w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center ${selectedPlatform === 'google' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {selectedPlatform === 'google' ? (
                                        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12.545 11.027L21.114 11.027C21.303 11.254 21.397 11.536 21.397 11.872C21.397 12.345 21.272 12.854 21.022 13.4C20.454 14.654 19.563 15.727 18.35 16.618C16.85 17.727 15.093 18.282 13.08 18.282C11.127 18.282 9.408 17.818 7.923 16.891C6.438 15.964 5.253 14.673 4.367 13.018C3.481 11.363 3.038 9.545 3.038 7.563C3.038 5.581 3.481 3.763 4.367 2.108C5.253 0.453 6.438 -0.838 7.923 -1.765C9.408 -2.692 11.127 -3.156 13.08 -3.156C15.227 -3.156 17.154 -2.547 18.861 -1.329L16.03 1.503C15.193 1.011 14.211 0.765 13.08 0.765C11.536 0.765 10.199 1.182 9.07 2.016C7.94 2.85 7.14 3.991 6.67 5.441C6.2 6.89 5.965 8.441 5.965 10.091C5.965 11.741 6.2 13.291 6.67 14.741C7.14 16.19 7.94 17.332 9.07 18.165C10.199 18.999 11.536 19.416 13.08 19.416C14.172 19.416 15.143 19.227 15.996 18.85C16.85 18.473 17.513 17.973 17.983 17.35C18.453 16.727 18.773 16.045 18.943 15.304L13.08 15.304L13.08 11.027L12.545 11.027Z"/></svg>
                                    ) : (
                                        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                    )}
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Conectar {selectedPlatform === 'google' ? 'Google Ads' : 'Meta Ads'}</h3>
                                <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm leading-relaxed">Conecte sua conta para começar a monitorar o saldo e a performance de suas campanhas em tempo real.</p>
                                <a href={selectedPlatform === 'google' ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=880633493696-3m5f7ks5rk534tomks1fmihir6qqph3a.apps.googleusercontent.com&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/google-callback')}&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent` : `https://www.facebook.com/v19.0/dialog/oauth?client_id=897058925982042&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth')}&scope=ads_read`} className={`inline-flex items-center justify-center gap-3 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl w-full max-w-xs transform hover:-translate-y-1 ${selectedPlatform === 'google' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}>Fazer Login Agora</a>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{selectedPlatform === 'meta' ? 'Contas Meta' : 'Contas Google'}</h2>
                                    <button onClick={() => setShowBalanceList(!showBalanceList)} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">{showBalanceList ? 'Ocultar Lista' : 'Mostrar Lista'}</button>
                                </div>
                                {showBalanceList && <BalanceList accounts={adAccounts} selectedAccountId={selectedAccountIds.length === 1 ? selectedAccountIds[0] : null} selectedAccountIds={selectedAccountIds} onAccountSelect={handleAccountSelect} isLoading={isLoadingAccounts} />}
                                {isLoadingAccounts ? (<div className="text-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>) : consolidatedAccount ? (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <BalanceCard account={consolidatedAccount as AdAccount} isSummary={selectedAccountIds.length > 1} count={selectedAccountIds.length} />
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nível de Agregação</span>
                                                <div className="flex flex-wrap gap-2">{(Object.values(DataLevel)).map(level => (<button key={level} onClick={() => { setSelectedLevel(level); setSelectedEntityIds([]); }} className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${selectedLevel === level ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}>{DATA_LEVEL_LABELS[level]}</button>))}</div>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Período de Análise</span>
                                                <div className="flex flex-wrap gap-2">{dateRangeOptions.map(option => (<button key={option.key} onClick={() => setDateRange(option.key)} className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${dateRange === option.key ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}>{option.label}</button>))}</div>
                                            </div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                            <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                                                <div className="flex flex-wrap gap-2">{(Object.keys(chartMetrics) as ChartMetric[]).map(metric => (<button key={metric} onClick={() => setChartMetric(metric)} className={`px-5 py-2.5 text-xs font-bold rounded-xl border transition-all ${chartMetric === metric ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-transparent border-gray-100 text-gray-400 hover:text-gray-600'}`}>{chartMetrics[metric].label}</button>))}</div>
                                                <button onClick={() => setShowChart(!showChart)} className="text-[10px] font-black text-gray-300 uppercase hover:text-blue-500 transition-colors tracking-widest">{showChart ? "Ocultar Gráfico" : "Ver Gráfico"} </button>
                                            </div>
                                            {showChart && <div className="h-[400px]"><LineChart data={aggregatedChartData} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} /></div>}
                                        </div>
                                        <KpiTable data={tableData} isLoading={isLoadingKpis} currency={consolidatedAccount.currency} selectedEntityIds={selectedEntityIds} onRowClick={(id, multi) => setSelectedEntityIds(multi ? (selectedEntityIds.includes(id) ? selectedEntityIds.filter(i => i !== id) : [...selectedEntityIds, id]) : (selectedEntityIds.length === 1 && selectedEntityIds[0] === id ? [] : [id]))} />
                                    </div>
                                ) : (adAccounts.length === 0 && !error && (<div className="text-center bg-white dark:bg-gray-800 p-12 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-gray-500 font-medium">Nenhuma conta ativa foi localizada.</p></div>))}
                            </>
                        )}
                    </>
                </SubscriptionGate>
            </main>
        );
    };
    
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <Header isAuthenticated={authStatus.meta || authStatus.google} onLogout={handleLogout} subscription={subscription} />
            {!authStatus.checked ? (<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>) : (!authStatus.meta && !authStatus.google) ? (<LoginScreen />) : (<Dashboard />)}
        </div>
    );
};

export default App;
