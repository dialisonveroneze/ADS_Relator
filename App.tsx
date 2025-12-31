
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
    
    // New State for Multi-Select Drill-down
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
                    console.warn("Google API error or not connected", e);
                    setAuthStatus(prev => ({ ...prev, google: false }));
                    throw e;
                }
            }

            // Tag accounts with provider
            const taggedAccounts = accounts.map(acc => ({ ...acc, provider: platform }));
            
            setAdAccounts(taggedAccounts);
            if (taggedAccounts.length > 0) {
                setSelectedAccount(taggedAccounts[0]);
            }
            
            // Assume if fetch works or returns empty array without throw, auth is OK for that platform
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

    // Initial Auth Check
    useEffect(() => {
        const checkAuth = async () => {
            // Check both sequentially to update auth status
            try {
                // We check Meta first as default
                await fetchAccounts('meta');
                
                // Then try to check Google status silently
                try {
                    await getGoogleAdAccounts();
                    setAuthStatus(prev => ({ ...prev, google: true, checked: true }));
                } catch (e) {
                    // Google not connected is fine
                    setAuthStatus(prev => ({ ...prev, google: false, checked: true }));
                }
            } catch (e) {
                setAuthStatus(prev => ({ ...prev, checked: true }));
            }
        };
        checkAuth();
    }, [fetchAccounts, checkSubscription]);

    // Handle Tab Switch
    const handlePlatformSwitch = (platform: 'meta' | 'google') => {
        setSelectedPlatform(platform);
        fetchAccounts(platform);
        setKpiData([]);
        setSelectedEntityIds([]);
        setDateRange('last_14_days');
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
    
    // Aggregation Logic (Shared between Meta and Google)
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
                    amountSpent: 0, impressions: 0, cpm: 0,
                    reach: 0, clicks: 0, inlineLinkClicks: 0, ctr: 0, cpc: 0, costPerInlineLinkClick: 0,
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
            return kpiData
                .filter(d => !d.isPeriodTotal)
                .map(d => ({ ...d, name: new Date(d.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }));
        }
        
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        if (summaryData.length > 0) return summaryData;

        // Fallback aggregation
        const aggregated: { [id: string]: KpiData } = {};
        kpiData.forEach(item => {
            if (item.isPeriodTotal) return; 
            if (!aggregated[item.entityId]) {
                aggregated[item.entityId] = {
                    ...item,
                    date: '', 
                    amountSpent: 0, impressions: 0, cpm: 0,
                    reach: 0, clicks: 0, inlineLinkClicks: 0, ctr: 0, cpc: 0, costPerInlineLinkClick: 0,
                    results: 0, costPerResult: 0
                };
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
        setDateRange('last_14_days');
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

    const getChartLabel = () => {
        const baseLabel = chartMetrics[chartMetric].label;
        if (selectedEntityIds.length === 1) {
            const entity = kpiData.find(d => d.entityId === selectedEntityIds[0]);
            return entity ? `${baseLabel} - ${entity.name}` : baseLabel;
        } else if (selectedEntityIds.length > 1) {
            return `${baseLabel} - ${selectedEntityIds.length} itens selecionados`;
        }
        return baseLabel;
    };

    const LevelSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => (
        <div>
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-2 block mb-2">Nível:</span>
            <div className="flex flex-wrap items-center gap-2">
                {(Object.values(DataLevel)).map(level => (
                    <button
                        key={level} 
                        onClick={() => { setSelectedLevel(level); setSelectedEntityIds([]); }} 
                        disabled={disabled}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${selectedLevel === level ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >{DATA_LEVEL_LABELS[level]}</button>
                ))}
            </div>
        </div>
    );
    
     const DateRangeSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => (
        <div>
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-2 block mb-2">Período:</span>
            <div className="flex flex-wrap items-center gap-2">
                {dateRangeOptions.map(option => (
                    <button
                        key={option.key} onClick={() => setDateRange(option.key)} disabled={disabled}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${dateRange === option.key ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >{option.label}</button>
                ))}
            </div>
        </div>
    );
    
    const MetricSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => (
         <div className="flex-grow">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-2 block mb-2">Métrica do Gráfico:</span>
            <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(chartMetrics) as ChartMetric[]).map(metric => (
                    <button
                        key={metric} onClick={() => setChartMetric(metric)} disabled={disabled}
                        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${chartMetric === metric ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >{chartMetrics[metric].label}</button>
                ))}
            </div>
        </div>
    );

    const AuthContent = () => {
        if (!authStatus.checked) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Carregando...</p>
                </div>
            );
        }
        
        // Show login screen if neither is authenticated
        if (!authStatus.meta && !authStatus.google) {
            return <LoginScreen />;
        }
        
        return <Dashboard />;
    };

    const Dashboard = () => {
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const PRODUCTION_DOMAIN = 'https://dashboard.mindfulmarketing.com.br';
        const ROOT_URL = isLocalhost ? window.location.origin : PRODUCTION_DOMAIN;

        // Meta Auth Config
        const metaRedirectUri = `${ROOT_URL}/api/auth`;
        const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=897058925982042&redirect_uri=${encodeURIComponent(metaRedirectUri)}&scope=ads_read`;

        // Google Auth Config
        const googleRedirectUri = `${ROOT_URL}/api/auth/google-callback`;
        const googleScope = 'https://www.googleapis.com/auth/adwords';
        const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(googleRedirectUri)}&response_type=code&scope=${encodeURIComponent(googleScope)}&access_type=offline&prompt=consent`;

        return (
            <main className="container mx-auto p-4 md:p-6 space-y-8">
                <SubscriptionGate 
                    subscription={subscription} 
                    isLoading={isLoadingSubscription} 
                    onSubscriptionUpdate={checkSubscription}
                >
                    <>
                        {/* Platform Switcher */}
                        <div className="flex justify-center mb-6">
                            <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-md inline-flex">
                                <button
                                    onClick={() => handlePlatformSwitch('meta')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${selectedPlatform === 'meta' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    Meta Ads
                                </button>
                                <button
                                    onClick={() => handlePlatformSwitch('google')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${selectedPlatform === 'google' ? 'bg-green-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                    Google Ads
                                </button>
                            </div>
                        </div>

                        {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert"><strong className="font-bold">Ocorreu um erro: </strong><span className="block sm:inline">{error}</span></div>)}
                        
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                {selectedPlatform === 'meta' ? 'Contas do Facebook/Instagram' : 'Contas do Google Ads'}
                            </h2>
                            <button
                                onClick={() => setShowBalanceList(!showBalanceList)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700 transition-colors"
                            >
                                {showBalanceList ? 'Ocultar Lista' : 'Mostrar Lista'}
                            </button>
                        </div>

                        {showBalanceList && (
                            <BalanceList accounts={adAccounts} selectedAccountId={selectedAccount?.id || null} onAccountSelect={handleAccountSelect} isLoading={isLoadingAccounts}/>
                        )}
                        
                        {isLoadingAccounts ? (
                            <div className="text-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
                        ) : selectedAccount ? (
                            <div>
                                <BalanceCard account={selectedAccount} />
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg space-y-4 mb-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
                                    <LevelSelector disabled={isLoadingKpis} />
                                    <DateRangeSelector disabled={isLoadingKpis} />
                                    </div>
                                    
                                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                        <MetricSelector disabled={isLoadingKpis || !showChart} />
                                        <button
                                            onClick={() => setShowChart(!showChart)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap self-end md:self-auto"
                                        >
                                            {showChart ? "Ocultar Gráfico" : "Mostrar Gráfico"}
                                        </button>
                                    </div>
                                </div>
                                
                                {showChart && (
                                    <LineChart 
                                        data={aggregatedChartData} 
                                        metric={chartMetric} 
                                        label={getChartLabel()} 
                                        isLoading={isLoadingKpis} 
                                    />
                                )}
                                <KpiTable 
                                    data={tableData} 
                                    isLoading={isLoadingKpis} 
                                    currency={selectedAccount.currency}
                                    selectedEntityIds={selectedEntityIds}
                                    onRowClick={handleRowClick}
                                />
                            </div>
                        ) : (adAccounts.length === 0 && !error && (
                            <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-lg shadow-lg max-w-2xl mx-auto border border-gray-100 dark:border-gray-700">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">Nenhuma conta encontrada</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                                    {selectedPlatform === 'google' 
                                        ? 'Não conseguimos localizar nenhuma conta vinculada. Certifique-se de que sua conta do Google Ads está ativa ou conecte-se novamente.' 
                                        : 'Não localizamos contas vinculadas ao seu perfil Meta. Verifique suas permissões no painel da Meta.'}
                                </p>
                                
                                {selectedPlatform === 'google' && !authStatus.google ? (
                                    <a
                                        href={googleAuthUrl}
                                        className="inline-flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white font-bold py-3 px-8 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-md active:scale-95"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 48 48">
                                            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                                        </svg>
                                        CONECTAR COM GOOGLE ADS
                                    </a>
                                ) : selectedPlatform === 'meta' && !authStatus.meta ? (
                                    <a
                                        href={metaAuthUrl}
                                        className="inline-flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md active:scale-95"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2.04c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm2.25 10.5h-2.25v6h-3v-6h-1.5v-2.5h1.5v-2c0-1.29.67-2.5 2.5-2.5h2.25v2.5h-1.5c-.28 0-.5.22-.5.5v1.5h2.25l-.25 2.5z"/>
                                        </svg>
                                        CONECTAR COM META ADS
                                    </a>
                                ) : null}
                            </div>
                        ))}
                    </>
                </SubscriptionGate>
            </main>
        );
    };
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Header 
                isAuthenticated={authStatus.meta || authStatus.google} 
                onLogout={handleLogout}
                subscription={subscription}
            />
            <AuthContent />
        </div>
    );
};

export default App;
