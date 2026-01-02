
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
        try {
            const accounts = platform === 'meta' ? await getAdAccounts() : await getGoogleAdAccounts();
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
                setAuthStatus(prev => ({ ...prev, checked: true }));
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

    const fetchKpiData = useCallback(async () => {
        if (selectedAccountIds.length === 0) return;
        setIsLoadingKpis(true);
        setError(null);
        try {
            const fetchPromises = selectedAccountIds.map(async (id) => {
                return selectedPlatform === 'meta' 
                    ? getKpiData(id, selectedLevel, dateRange) 
                    : getGoogleKpiData(id, selectedLevel, dateRange);
            });
            const results = await Promise.all(fetchPromises);
            setKpiData(results.flat());
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

    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        const sourceData = summaryData.length > 0 ? summaryData : kpiData.filter(d => !d.isPeriodTotal);
        const aggregated: { [id: string]: KpiData } = {};
        sourceData.forEach(item => {
            if (!aggregated[item.entityId]) aggregated[item.entityId] = { ...item, amountSpent: 0, impressions: 0, reach: 0, clicks: 0, results: 0 };
            const totals = aggregated[item.entityId];
            totals.amountSpent += item.amountSpent; totals.impressions += item.impressions; totals.reach += item.reach; totals.clicks += item.clicks; totals.results += item.results;
        });
        return Object.values(aggregated).map(totals => ({
            ...totals,
            cpm: totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0,
            ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            cpc: totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0,
            costPerResult: totals.results > 0 ? totals.amountSpent / totals.results : 0,
        }));
    }, [kpiData]);

    const Dashboard = () => {
        const isPlatformAuthenticated = selectedPlatform === 'meta' ? authStatus.meta : authStatus.google;

        return (
            <main className="container mx-auto p-4 md:p-6 space-y-8">
                <SubscriptionGate subscription={subscription} isLoading={isLoadingSubscription} onSubscriptionUpdate={checkSubscription}>
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl inline-flex border border-gray-100 dark:border-gray-700">
                                <button onClick={() => handlePlatformSwitch('meta')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${selectedPlatform === 'meta' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>META ADS</button>
                                <button onClick={() => handlePlatformSwitch('google')} className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all ${selectedPlatform === 'google' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>GOOGLE ADS</button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6 shadow-sm">
                                <p className="text-red-700 font-bold">{error}</p>
                            </div>
                        )}
                        
                        {!isPlatformAuthenticated ? (
                            <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-[2rem] shadow-2xl max-w-2xl mx-auto border border-gray-100 dark:border-gray-700">
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Conectar {selectedPlatform === 'google' ? 'Google Ads' : 'Meta Ads'}</h3>
                                <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm leading-relaxed">Conecte sua conta para começar a monitorar o saldo e a performance em tempo real.</p>
                                <a href={selectedPlatform === 'google' ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=880633493696-3m5f7ks5rk534tomks1fmihir6qqph3a.apps.googleusercontent.com&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/google-callback')}&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent` : `https://www.facebook.com/v19.0/dialog/oauth?client_id=897058925982042&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth')}&scope=ads_read`} className={`inline-flex items-center justify-center gap-3 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl w-full max-w-xs ${selectedPlatform === 'google' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Fazer Login</a>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{selectedPlatform === 'meta' ? 'Contas Meta' : 'Contas Google'}</h2>
                                    <button onClick={() => setShowBalanceList(!showBalanceList)} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">{showBalanceList ? 'Ocultar Lista' : 'Mostrar Lista'}</button>
                                </div>
                                {showBalanceList && <BalanceList accounts={adAccounts} selectedAccountId={null} selectedAccountIds={selectedAccountIds} onAccountSelect={(acc, all) => {
                                    if (all) setSelectedAccountIds(selectedAccountIds.length === adAccounts.length ? [] : adAccounts.map(a => a.id));
                                    else if (acc) setSelectedAccountIds([acc.id]);
                                }} isLoading={isLoadingAccounts} />}
                                
                                {consolidatedAccount && (
                                    <div className="space-y-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <BalanceCard account={consolidatedAccount as AdAccount} isSummary={selectedAccountIds.length > 1} count={selectedAccountIds.length} />
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nível de Agregação</span>
                                                <div className="flex flex-wrap gap-2">{(Object.values(DataLevel)).map(level => (<button key={level} onClick={() => setSelectedLevel(level)} className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${selectedLevel === level ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}>{DATA_LEVEL_LABELS[level]}</button>))}</div>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Período de Análise</span>
                                                <div className="flex flex-wrap gap-2">{dateRangeOptions.map(option => (<button key={option.key} onClick={() => setDateRange(option.key)} className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${dateRange === option.key ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}>{option.label}</button>))}</div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                            <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                                                <div className="flex flex-wrap gap-2">{(Object.keys(chartMetrics) as ChartMetric[]).map(metric => (<button key={metric} onClick={() => setChartMetric(metric)} className={`px-5 py-2.5 text-xs font-bold rounded-xl border transition-all ${chartMetric === metric ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-transparent border-gray-100 text-gray-400 hover:text-gray-600'}`}>{chartMetrics[metric].label}</button>))}</div>
                                                <button onClick={() => setShowChart(!showChart)} className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{showChart ? "Ocultar Gráfico" : "Ver Gráfico"} </button>
                                            </div>
                                            {showChart && <div className="h-[400px]"><LineChart data={kpiData.filter(d => !d.isPeriodTotal)} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} /></div>}
                                        </div>

                                        <KpiTable data={tableData} isLoading={isLoadingKpis} currency={consolidatedAccount.currency} selectedEntityIds={selectedEntityIds} onRowClick={(id) => setSelectedEntityIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} />
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <Header isAuthenticated={authStatus.meta || authStatus.google} onLogout={logout} subscription={subscription} />
            {!authStatus.checked ? (<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>) : (!authStatus.meta && !authStatus.google) ? (<LoginScreen />) : (<Dashboard />)}
        </div>
    );
};

export default App;
