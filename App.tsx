
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
    const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
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
        setSelectedAccount(null);
        
        try {
            const accounts = platform === 'meta' ? await getAdAccounts() : await getGoogleAdAccounts();
            const taggedAccounts = accounts.map(acc => ({ ...acc, provider: platform }));
            setAdAccounts(taggedAccounts);
            if (taggedAccounts.length > 0) setSelectedAccount(taggedAccounts[0]);
            setAuthStatus(prev => ({ ...prev, [platform]: true }));
        } catch (err: any) {
            if (err.message === 'Unauthorized') setAuthStatus(prev => ({ ...prev, [platform]: false }));
            else setError(err.message);
        } finally { setIsLoadingAccounts(false); }
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            await checkSubscription();
            try {
                await fetchAccounts(selectedPlatform);
                setAuthStatus(prev => ({ ...prev, checked: true }));
            } catch (e) { setAuthStatus(prev => ({ ...prev, checked: true })); }
        };
        checkAuth();
    }, [selectedPlatform, fetchAccounts, checkSubscription]);

    const handlePlatformSwitch = (platform: 'meta' | 'google') => {
        setSelectedPlatform(platform);
        fetchAccounts(platform);
        setKpiData([]);
        setSelectedEntityIds([]);
    };
    
    const handleLogout = async () => {
        await logout();
        setAuthStatus({ meta: false, google: false, checked: true });
        window.location.href = `/?logged_out=true`;
    };

    const fetchKpiData = useCallback(async () => {
        if (!selectedAccount) return;
        setIsLoadingKpis(true);
        setError(null);
        setSelectedEntityIds([]);
        try {
            const data = selectedPlatform === 'meta' 
                ? await getKpiData(selectedAccount.id, selectedLevel, dateRange)
                : await getGoogleKpiData(selectedAccount.id, selectedLevel, dateRange);
            setKpiData(data);
        } catch (err: any) { setError(err.message); } finally { setIsLoadingKpis(false); }
    }, [selectedAccount, selectedLevel, dateRange, selectedPlatform]);

    useEffect(() => { fetchKpiData(); }, [fetchKpiData]);

    // Lógica corrigida para garantir agrupamento por data no gráfico
    const aggregatedChartData = useMemo(() => {
        let dailyData = kpiData.filter(d => !d.isPeriodTotal);
        
        // Se houver itens específicos selecionados na tabela, filtra o gráfico por eles
        if (selectedEntityIds.length > 0) {
            dailyData = dailyData.filter(d => selectedEntityIds.includes(d.entityId));
        }

        // Agrupa SEMPRE por data para o gráfico, somando as métricas de todas as entidades do mesmo dia
        const dailyTotals: { [date: string]: KpiData } = {};
        
        dailyData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = { 
                    ...item, 
                    id: item.date, 
                    entityId: item.date, 
                    name: `Resumo - ${item.date}`, 
                    amountSpent: 0, 
                    impressions: 0, 
                    reach: 0, 
                    clicks: 0, 
                    results: 0,
                    inlineLinkClicks: 0 
                };
            }
            const t = dailyTotals[item.date];
            t.amountSpent += item.amountSpent;
            t.impressions += item.impressions;
            t.reach += item.reach;
            t.clicks += item.clicks;
            t.results += item.results;
            t.inlineLinkClicks += (item.inlineLinkClicks || 0);
        });

        // Retorna o array ordenado por data crescente
        return Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
    }, [kpiData, selectedLevel, selectedEntityIds]);
    
    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        if (selectedLevel === DataLevel.ACCOUNT) return kpiData.filter(d => !d.isPeriodTotal).map(d => ({ ...d, name: new Date(d.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }));
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        if (summaryData.length > 0) return summaryData;
        
        const aggregated: Record<string, KpiData> = {};
        kpiData.forEach(item => {
            if (item.isPeriodTotal) return;
            if (!aggregated[item.entityId]) aggregated[item.entityId] = { ...item, amountSpent: 0, impressions: 0, reach: 0, clicks: 0, results: 0, inlineLinkClicks: 0 };
            const t = aggregated[item.entityId];
            t.amountSpent += item.amountSpent; 
            t.impressions += item.impressions; 
            t.reach += item.reach; 
            t.clicks += item.clicks; 
            t.results += item.results;
            t.inlineLinkClicks += (item.inlineLinkClicks || 0);
        });
        return Object.values(aggregated);
    }, [kpiData, selectedLevel]);

    const handleRowClick = (entityId: string, isMultiSelect: boolean) => {
        if (selectedLevel === DataLevel.ACCOUNT) return;
        setSelectedEntityIds(prev => isMultiSelect ? (prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]) : (prev.length === 1 && prev[0] === entityId ? [] : [entityId]));
    };

    const Dashboard = () => {
        const isPlatformAuthenticated = selectedPlatform === 'meta' ? authStatus.meta : authStatus.google;
        
        const FilterButton = ({ active, onClick, children }: any) => (
            <button onClick={onClick} className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all ${active ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>{children}</button>
        );

        return (
            <main className="container mx-auto p-4 md:p-6 space-y-8">
                <SubscriptionGate subscription={subscription} isLoading={isLoadingSubscription} onSubscriptionUpdate={checkSubscription}>
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-md inline-flex border border-gray-100 dark:border-gray-700">
                                <button onClick={() => handlePlatformSwitch('meta')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${selectedPlatform === 'meta' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}>Meta Ads</button>
                                <button onClick={() => handlePlatformSwitch('google')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${selectedPlatform === 'google' ? 'bg-green-600 text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}>Google Ads</button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl mb-6 shadow-sm">
                                <p className="text-amber-800 font-bold text-sm">{error}</p>
                            </div>
                        )}
                        
                        {!isPlatformAuthenticated ? (
                            <LoginScreen />
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{selectedPlatform === 'meta' ? 'Contas Meta' : 'Contas Google Ads'}</h2>
                                    <button onClick={() => setShowBalanceList(!showBalanceList)} className="text-[10px] font-black uppercase tracking-widest text-blue-600">{showBalanceList ? 'Ocultar Lista' : 'Mostrar Lista'}</button>
                                </div>

                                {showBalanceList && <BalanceList accounts={adAccounts} selectedAccountId={selectedAccount?.id || null} onAccountSelect={setSelectedAccount} isLoading={isLoadingAccounts}/>}
                                
                                {selectedAccount && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <BalanceCard account={selectedAccount} />

                                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg space-y-6 border border-gray-100 dark:border-gray-700">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-3">Nível de Dados:</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(Object.values(DataLevel)).map(level => (
                                                            <FilterButton key={level} active={selectedLevel === level} onClick={() => { setSelectedLevel(level); setSelectedEntityIds([]); }}>{DATA_LEVEL_LABELS[level]}</FilterButton>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-3">Período:</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {dateRangeOptions.map(opt => (
                                                            <FilterButton key={opt.key} active={dateRange === opt.key} onClick={() => setDateRange(opt.key)}>{opt.label}</FilterButton>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-end gap-4">
                                                <div className="w-full">
                                                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-3">Métrica do Gráfico:</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(Object.keys(chartMetrics) as ChartMetric[]).map(metric => (
                                                            <FilterButton key={metric} active={chartMetric === metric} onClick={() => setChartMetric(metric)}>{chartMetrics[metric].label}</FilterButton>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button onClick={() => setShowChart(!showChart)} className="whitespace-nowrap text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">{showChart ? "Recolher Gráfico" : "Expandir Gráfico"}</button>
                                            </div>
                                        </div>

                                        {showChart && <LineChart data={aggregatedChartData} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} />}
                                        
                                        <KpiTable data={tableData} isLoading={isLoadingKpis} currency={selectedAccount.currency} selectedEntityIds={selectedEntityIds} onRowClick={handleRowClick} />
                                    </div>
                                )}
                            </>
                        )}
                    </>
                </SubscriptionGate>
            </main>
        );
    };
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <Header isAuthenticated={authStatus.meta || authStatus.google} onLogout={handleLogout} subscription={subscription} />
            {!authStatus.checked ? (<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>) : <Dashboard />}
        </div>
    );
};

export default App;
