
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BalanceList from './components/BalanceList';
import BalanceCard from './components/BalanceCard';
import LineChart from './components/LineChart';
import KpiTable from './components/KpiTable';
import LoginScreen from './components/LoginScreen';
import SubscriptionGate from './components/SubscriptionGate';
import { getAdAccounts, getKpiData, logout } from './services/metaAdsService';
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
    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null means "checking"
    
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
    
    // New State for Drill-down
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

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

    const handleAuthenticationError = useCallback(() => {
        setIsAuthenticated(false);
        setAdAccounts([]);
        setSelectedAccount(null);
        setKpiData([]);
    }, []);

    // Check authentication status on initial load
    useEffect(() => {
        const checkAuthStatus = async () => {
            setIsLoadingAccounts(true);
            setError(null);
            try {
                const accounts = await getAdAccounts();
                setAdAccounts(accounts);
                if (accounts.length > 0) {
                    setSelectedAccount(accounts[0]);
                }
                setIsAuthenticated(true);
                // Check subscription after auth is confirmed
                checkSubscription();
            } catch (err: any) {
                if (err.message === 'Unauthorized') {
                    handleAuthenticationError();
                } else {
                    setError("Falha ao verificar o status da autenticação.");
                    setIsAuthenticated(false);
                }
            } finally {
                setIsLoadingAccounts(false);
            }
        };
        checkAuthStatus();
    }, [handleAuthenticationError, checkSubscription]);
    
    const handleLogout = async () => {
        await logout();
        handleAuthenticationError();
        // Adiciona um parâmetro para evitar cache e forçar a verificação no servidor
        window.location.href = `/?logged_out=true`;
    };

    const fetchKpiData = useCallback(async () => {
        if (!selectedAccount || !isAuthenticated) return;
        setIsLoadingKpis(true);
        setError(null);
        // Reset selection when fetching new data
        setSelectedEntityId(null);
        try {
            const data = await getKpiData(selectedAccount.id, selectedLevel, dateRange);
            setKpiData(data);
        } catch (err: any) {
            if (err.message === 'Unauthorized') {
                handleAuthenticationError();
            } else {
                setError("Falha ao buscar os dados de KPI.");
            }
        } finally {
            setIsLoadingKpis(false);
        }
    }, [selectedAccount, selectedLevel, dateRange, isAuthenticated, handleAuthenticationError]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData]);
    
    const aggregatedChartData = useMemo(() => {
        // For charts, we ONLY want daily breakdowns, not the period summaries
        let dailyData = kpiData.filter(d => !d.isPeriodTotal);

        // Filter by selected entity if one is clicked in the table
        if (selectedEntityId) {
            dailyData = dailyData.filter(d => d.entityId === selectedEntityId);
        }

        if (selectedLevel === DataLevel.ACCOUNT) {
            // Account level already comes sorted by date from API logic usually, but sort to be safe
            return dailyData.sort((a, b) => a.date.localeCompare(b.date));
        }
        
        // For levels like Campaign/AdSet, dailyData has multiple rows per day (one per entity).
        // We must aggregate them by date to show the TOTAL trend line on the chart.
        const dailyTotals: { [date: string]: KpiData } = {};
        dailyData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = {
                    id: item.date, entityId: item.date, name: `Resumo - ${item.date}`, level: selectedLevel, date: item.date,
                    amountSpent: 0, impressions: 0, cpm: 0,
                    reach: 0, clicks: 0, inlineLinkClicks: 0, ctr: 0, cpc: 0, costPerInlineLinkClick: 0,
                    results: 0, costPerResult: 0
                };
            }
            const totals = dailyTotals[item.date];
            totals.amountSpent += item.amountSpent;
            totals.impressions += item.impressions;
            totals.reach += item.reach; // Note: Summing reach here is visually approximate for charts, but technically overlapping. 
            totals.clicks += item.clicks;
            totals.inlineLinkClicks += item.inlineLinkClicks;
            totals.results += item.results;
        });

        // Recalculate rates for chart
        Object.values(dailyTotals).forEach(totals => {
            // Removed toFixed(2) to keep precision in data processing
            totals.cpm = totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0;
            totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            totals.cpc = totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0;
            totals.costPerInlineLinkClick = totals.inlineLinkClicks > 0 ? totals.amountSpent / totals.inlineLinkClicks : 0;
            
            // FIX: Apply 1000x multiplier for Awareness campaigns in Chart as well
            // If user selected results metric for chart, logic handles aggregation. 
            // For derived metrics like CPR, we recalculate.
            // Since aggregated data loses granular 'objective', we use basic CPR logic here for charts,
            // relying on the user to interpret context.
            totals.costPerResult = totals.results > 0 ? totals.amountSpent / totals.results : 0;
            
            // Heuristic: if results approximate reach and CPM is low, it might be Awareness.
            // But without explicit objective on aggregated data, safe to leave as standard CPR for trend lines.
            // The table provides the precise breakdown.
        });
        
        return Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
    }, [kpiData, selectedLevel, selectedEntityId]);
    
    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        
        // If selected level is ACCOUNT, we usually want to see the day-by-day breakdown in the table
        // matching the chart.
        if (selectedLevel === DataLevel.ACCOUNT) {
            return kpiData
                .filter(d => !d.isPeriodTotal)
                .map(d => ({ ...d, name: new Date(d.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }));
        }
        
        // For Campaign/AdSet/Ad levels, we want the "Period Summary" rows.
        // We use the data where isPeriodTotal is true. This data comes directly from Meta with correct Reach/Result deduplication.
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        
        // If for some reason summary is missing but we have daily data (fallback case), we aggregate manually.
        if (summaryData.length > 0) {
            return summaryData;
        }

        // Fallback manual aggregation (only runs if API fails to return summary)
        const aggregated: { [id: string]: KpiData } = {};
        kpiData.forEach(item => {
            if (item.isPeriodTotal) return; // Skip summary items if we are aggregating daily manually
            
            if (!aggregated[item.entityId]) {
                aggregated[item.entityId] = {
                    id: item.entityId,
                    entityId: item.entityId,
                    name: item.name,
                    level: item.level,
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
    
        // Recalculate rates based on aggregated totals
        Object.values(aggregated).forEach(totals => {
            // Removed toFixed(2) to keep precision
            totals.cpm = totals.impressions > 0 ? (totals.amountSpent / totals.impressions) * 1000 : 0;
            totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            totals.cpc = totals.clicks > 0 ? totals.amountSpent / totals.clicks : 0;
            totals.costPerInlineLinkClick = totals.inlineLinkClicks > 0 ? totals.amountSpent / totals.inlineLinkClicks : 0;
            totals.costPerResult = totals.results > 0 ? totals.amountSpent / totals.results : 0;
        });
    
        return Object.values(aggregated);
    }, [kpiData, selectedLevel]);


    const handleAccountSelect = (account: AdAccount) => {
        setSelectedAccount(account);
        setSelectedLevel(DataLevel.ACCOUNT);
        setDateRange('last_14_days');
        setKpiData([]); // Clear old data immediately
        setSelectedEntityId(null);
    };

    const handleRowClick = (entityId: string) => {
        // Disable drill-down on Account level since rows are dates, not distinct entities to filter by
        if (selectedLevel === DataLevel.ACCOUNT) return;

        setSelectedEntityId(prev => prev === entityId ? null : entityId);
    };

    const getChartLabel = () => {
        const baseLabel = chartMetrics[chartMetric].label;
        if (selectedEntityId) {
            const entity = kpiData.find(d => d.entityId === selectedEntityId);
            return entity ? `${baseLabel} - ${entity.name}` : baseLabel;
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
                        onClick={() => { setSelectedLevel(level); setSelectedEntityId(null); }} 
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
        if (isAuthenticated === null) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Verificando sessão...</p>
                </div>
            );
        }
        return isAuthenticated ? <Dashboard /> : <LoginScreen />;
    };

    const Dashboard = () => (
         <main className="container mx-auto p-4 md:p-6 space-y-8">
             <SubscriptionGate 
                subscription={subscription} 
                isLoading={isLoadingSubscription} 
                onSubscriptionUpdate={checkSubscription}
             >
                {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert"><strong className="font-bold">Ocorreu um erro: </strong><span className="block sm:inline">{error}</span></div>)}
                
                {/* Controls for Balance List Visibility */}
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowBalanceList(!showBalanceList)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:border-gray-700 transition-colors"
                    >
                        {showBalanceList ? (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                                Ocultar Saldos
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                                Mostrar Saldos
                            </>
                        )}
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
                                    title={showChart ? "Ocultar Gráfico" : "Mostrar Gráfico"}
                                >
                                    {showChart ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                                            Ocultar Gráfico
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                            Mostrar Gráfico
                                        </>
                                    )}
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
                            selectedEntityId={selectedEntityId}
                            onRowClick={handleRowClick}
                        />
                    </div>
                ) : (adAccounts.length === 0 && !error && (<div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"><p className="text-gray-500 dark:text-gray-400">Nenhuma conta de anúncio foi encontrada para este usuário.</p></div>))}
            </SubscriptionGate>
        </main>
    );
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Header isAuthenticated={!!isAuthenticated} onLogout={handleLogout} />
            <AuthContent />
        </div>
    );
};

export default App;
