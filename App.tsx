
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

const GOOGLE_CLIENT_ID = '880633493696-3m5f7ks5rk534tomks1fmihir6qqph3a.apps.googleusercontent.com';
const META_APP_ID = '897058925982042';

const App: React.FC = () => {
    // Authentication State
    const [authStatus, setAuthStatus] = useState<{ meta: boolean; google: boolean; checked: boolean }>({
        meta: false,
        google: false,
        checked: false
    });
    
    // Platform State
    const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'google'>('meta');

    // Subscription State
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState<boolean>(false);

    // Dashboard State
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
        } catch (e) {
            console.error("Failed to check subscription", e);
        } finally {
            setIsLoadingSubscription(false);
        }
    }, []);

    const fetchAccounts = useCallback(async (platform: 'meta' | 'google') => {
        setIsLoadingAccounts(true);
        setError(null);
        setAdAccounts([]);
        setSelectedAccount(null);
        
        try {
            let accounts: AdAccount[] = [];
            if (platform === 'meta') {
                accounts = await getAdAccounts();
            } else {
                try {
                    accounts = await getGoogleAdAccounts();
                } catch (e) {
                    setAuthStatus(prev => ({ ...prev, google: false }));
                    throw e;
                }
            }

            const taggedAccounts = accounts.map(acc => ({ ...acc, provider: platform }));
            
            setAdAccounts(taggedAccounts);
            if (taggedAccounts.length > 0) {
                setSelectedAccount(taggedAccounts[0]);
            }
            
            setAuthStatus(prev => ({ ...prev, [platform]: true }));

        } catch (err: any) {
            if (err.message === 'Unauthorized') {
                setAuthStatus(prev => ({ ...prev, [platform]: false }));
            } else {
                setError(`Falha ao carregar contas ${platform === 'meta' ? 'Meta' : 'Google'}.`);
            }
        } finally {
            setIsLoadingAccounts(false);
        }
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            await checkSubscription();
            try {
                // Try to load initial Meta accounts (default)
                await fetchAccounts('meta');
                
                // Silent check for Google auth status
                try {
                    await getGoogleAdAccounts();
                    setAuthStatus(prev => ({ ...prev, google: true, checked: true }));
                } catch (e) {
                    setAuthStatus(prev => ({ ...prev, google: false, checked: true }));
                }
            } catch (e) {
                setAuthStatus(prev => ({ ...prev, checked: true }));
            }
        };
        checkAuth();
    }, [fetchAccounts, checkSubscription]);

    const handlePlatformSwitch = (platform: 'meta' | 'google') => {
        setSelectedPlatform(platform);
        setKpiData([]);
        setSelectedEntityIds([]);
        setDateRange('last_14_days');
        fetchAccounts(platform);
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
            let data: KpiData[] = [];
            if (selectedPlatform === 'meta') {
                data = await getKpiData(selectedAccount.id, selectedLevel, dateRange);
            } else {
                data = await getGoogleKpiData(selectedAccount.id, selectedLevel, dateRange);
            }
            setKpiData(data);
        } catch (err: any) {
             setError("Falha ao buscar os dados de KPI.");
        } finally {
            setIsLoadingKpis(false);
        }
    }, [selectedAccount, selectedLevel, dateRange, selectedPlatform]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData]);
    
    const aggregatedChartData = useMemo(() => {
        let dailyData = kpiData.filter(d => !d.isPeriodTotal);
        if (selectedEntityIds.length > 0) {
            dailyData = dailyData.filter(d => selectedEntityIds.includes(d.entityId));
        }
        if (selectedLevel === DataLevel.ACCOUNT) {
            return dailyData.sort((a, b) => a.date.localeCompare(b.date));
        }
        const dailyTotals: { [date: string]: KpiData } = {};
        dailyData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = {
                    id: item.date, entityId: item.date, name: `Resumo - ${item.date}`, level: selectedLevel, date: item.date,
                    amountSpent: 0, impressions: 0, cpm: 0, reach: 0, clicks: 0, inlineLinkClicks: 0, ctr: 0, cpc: 0, costPerInlineLinkClick: 0,
                    results: 0, costPerResult: 0, objective: item.objective 
                };
            }
            const totals = dailyTotals[item.date];
            totals.amountSpent += item.amountSpent;
            totals.impressions += item.impressions;
            totals.reach += item.reach; 
            totals.clicks += item.clicks;
            totals.inlineLinkClicks += item.inlineLinkClicks;
            totals.results += item.results;
        });
        Object.values(dailyTotals).forEach(totals => {
            totals.cpm = totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0;
            totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            totals.cpc = totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0;
            totals.costPerInlineLinkClick = totals.inlineLinkClicks > 0 ? totals.amountSpent / totals.inlineLinkClicks : 0;
            totals.costPerResult = totals.results > 0 ? (totals.amountSpent / totals.results) : 0;
        });
        return Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
    }, [kpiData, selectedLevel, selectedEntityIds]);
    
    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        if (selectedLevel === DataLevel.ACCOUNT) {
            return kpiData.filter(d => !d.isPeriodTotal).map(d => ({ ...d, name: new Date(d.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }));
        }
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        if (summaryData.length > 0) return summaryData;
        const aggregated: { [id: string]: KpiData } = {};
        kpiData.forEach(item => {
            if (item.isPeriodTotal) return; 
            if (!aggregated[item.entityId]) {
                aggregated[item.entityId] = { ...item, date: '', amountSpent: 0, impressions: 0, cpm: 0, reach: 0, clicks: 0, inlineLinkClicks: 0, ctr: 0, cpc: 0, costPerInlineLinkClick: 0, results: 0, costPerResult: 0 };
            }
            const totals = aggregated[item.entityId];
            totals.amountSpent += item.amountSpent;
            totals.impressions += item.impressions;
            totals.reach += item.reach;
            totals.clicks += item.clicks;
            totals.inlineLinkClicks += item.inlineLinkClicks;
            totals.results += item.results;
        });
        return Object.values(aggregated).map(totals => {
            totals.cpm = totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0;
            totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            totals.cpc = totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0;
            totals.costPerInlineLinkClick = totals.inlineLinkClicks > 0 ? totals.amountSpent / totals.inlineLinkClicks : 0;
            totals.costPerResult = totals.results > 0 ? (totals.amountSpent / totals.results) : 0;
            return totals;
        });
    }, [kpiData, selectedLevel]);

    const handleAccountSelect = (account: AdAccount) => {
        setSelectedAccount(account);
        setSelectedLevel(DataLevel.ACCOUNT);
        setKpiData([]); 
        setSelectedEntityIds([]);
    };

    const handleRowClick = (entityId: string, isMultiSelect: boolean) => {
        if (selectedLevel === DataLevel.ACCOUNT) return;
        setSelectedEntityIds(prev => {
            if (isMultiSelect) {
                return prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId];
            } else {
                return prev.length === 1 && prev[0] === entityId ? [] : [entityId];
            }
        });
    };

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const PRODUCTION_DOMAIN = 'https://dashboard.mindfulmarketing.com.br';
    const ROOT_URL = isLocalhost ? window.location.origin : PRODUCTION_DOMAIN;

    const metaRedirectUri = `${ROOT_URL}/api/auth`;
    const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(metaRedirectUri)}&scope=ads_read`;

    const googleRedirectUri = `${ROOT_URL}/api/auth/google-callback`;
    const googleScope = 'https://www.googleapis.com/auth/adwords';
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(googleRedirectUri)}&response_type=code&scope=${encodeURIComponent(googleScope)}&access_type=offline&prompt=consent`;

    const AuthContent = () => {
        if (!authStatus.checked) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Autenticando...</p>
                </div>
            );
        }
        if (!authStatus.meta && !authStatus.google) {
            return <LoginScreen />;
        }
        return <Dashboard />;
    };

    const Dashboard = () => {
        const isPlatformAuthenticated = selectedPlatform === 'meta' ? authStatus.meta : authStatus.google;

        return (
            <main className="container mx-auto p-4 md:p-6 space-y-8">
                <SubscriptionGate subscription={subscription} isLoading={isLoadingSubscription} onSubscriptionUpdate={checkSubscription}>
                    <>
                        {/* Platform Switcher */}
                        <div className="flex justify-center mb-6">
                            <div className="bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-xl inline-flex border border-gray-100 dark:border-gray-700">
                                <button
                                    onClick={() => handlePlatformSwitch('meta')}
                                    className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedPlatform === 'meta' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                >
                                    META ADS
                                </button>
                                <button
                                    onClick={() => handlePlatformSwitch('google')}
                                    className={`px-8 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedPlatform === 'google' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                >
                                    GOOGLE ADS
                                </button>
                            </div>
                        </div>

                        {error && (<div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg mb-4 flex items-center gap-3"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg><span>{error}</span></div>)}
                        
                        {!isPlatformAuthenticated ? (
                            <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-[2rem] shadow-2xl max-w-2xl mx-auto border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in duration-500">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl ${selectedPlatform === 'google' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {selectedPlatform === 'google' ? (
                                        <svg className="w-10 h-10" viewBox="0 0 48 48">
                                            <path fill="currentColor" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                                        </svg>
                                    ) : (
                                        <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2.04c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm2.25 10.5h-2.25v6h-3v-6h-1.5v-2.5h1.5v-2c0-1.29.67-2.5 2.5-2.5h2.25v2.5h-1.5c-.28 0-.5.22-.5.5v1.5h2.25l-.25 2.5z"/>
                                        </svg>
                                    )}
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Conectar {selectedPlatform === 'google' ? 'Google Ads' : 'Meta Ads'}</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-sm mx-auto font-medium">
                                    {selectedPlatform === 'google' 
                                        ? 'Conecte sua conta do Google Ads para começar a analisar sua performance de pesquisa e vídeo.' 
                                        : 'Vincule seu perfil da Meta para visualizar métricas de Facebook e Instagram em tempo real.'}
                                </p>
                                
                                <a
                                    href={selectedPlatform === 'google' ? googleAuthUrl : metaAuthUrl}
                                    className={`inline-flex items-center justify-center gap-3 text-white font-black py-4 px-10 rounded-2xl transition-all shadow-xl active:scale-95 uppercase tracking-wide w-full max-w-xs ${selectedPlatform === 'google' ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
                                >
                                    {selectedPlatform === 'google' ? 'Conectar Google Ads' : 'Conectar Meta Ads'}
                                </a>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                        {selectedPlatform === 'meta' ? 'Contas Facebook/Instagram' : 'Contas Google Ads'}
                                    </h2>
                                    <button
                                        onClick={() => setShowBalanceList(!showBalanceList)}
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        {showBalanceList ? 'Ocultar Lista' : 'Mostrar Lista'}
                                    </button>
                                </div>

                                {showBalanceList && (
                                    <BalanceList accounts={adAccounts} selectedAccountId={selectedAccount?.id || null} onAccountSelect={handleAccountSelect} isLoading={isLoadingAccounts}/>
                                )}
                                
                                {isLoadingAccounts ? (
                                    <div className="text-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
                                ) : selectedAccount ? (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <BalanceCard account={selectedAccount} />
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nível de Agregação</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {(Object.values(DataLevel)).map(level => (
                                                        <button
                                                            key={level} 
                                                            onClick={() => { setSelectedLevel(level); setSelectedEntityIds([]); }} 
                                                            className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all ${selectedLevel === level ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}
                                                        >{DATA_LEVEL_LABELS[level]}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Período de Análise</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {dateRangeOptions.map(option => (
                                                        <button
                                                            key={option.key} onClick={() => setDateRange(option.key)}
                                                            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${dateRange === option.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 hover:bg-gray-100'}`}
                                                        >{option.label}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                            <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {(Object.keys(chartMetrics) as ChartMetric[]).map(metric => (
                                                        <button
                                                            key={metric} onClick={() => setChartMetric(metric)}
                                                            className={`px-5 py-2.5 text-xs font-bold rounded-xl border transition-all ${chartMetric === metric ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-transparent border-gray-100 text-gray-400 hover:text-gray-600'}`}
                                                        >{chartMetrics[metric].label}</button>
                                                    ))}
                                                </div>
                                                <button onClick={() => setShowChart(!showChart)} className="text-[10px] font-black text-gray-300 uppercase hover:text-blue-500 transition-colors tracking-widest">
                                                    {showChart ? "Ocultar Gráfico" : "Ver Gráfico"}
                                                </button>
                                            </div>
                                            
                                            {showChart && (
                                                <div className="h-[400px]">
                                                    <LineChart data={aggregatedChartData} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} />
                                                </div>
                                            )}
                                        </div>

                                        <KpiTable 
                                            data={tableData} 
                                            isLoading={isLoadingKpis} 
                                            currency={selectedAccount.currency}
                                            selectedEntityIds={selectedEntityIds}
                                            onRowClick={handleRowClick}
                                        />
                                    </div>
                                ) : (adAccounts.length === 0 && !error && (
                                    <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                        <p className="text-gray-500 font-medium">Nenhuma conta de anúncio ativa foi localizada para este perfil.</p>
                                    </div>
                                ))}
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
            <AuthContent />
        </div>
    );
};

export default App;
