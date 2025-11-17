import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BalanceList from './components/BalanceList';
import BalanceCard from './components/BalanceCard';
import LineChart from './components/LineChart';
import KpiTable from './components/KpiTable';
import LoginScreen from './components/LoginScreen';
import { getAdAccounts, getKpiData, logout } from './services/metaAdsService';
import { AdAccount, KpiData, DataLevel } from './types';

const chartMetrics = {
    amountSpent: { label: 'Valor Gasto' },
    impressions: { label: 'Impressões' },
    results: { label: 'Resultados' },
    ctr: { label: 'CTR (%)' },
};
type ChartMetric = keyof typeof chartMetrics;

const App: React.FC = () => {
    // Authentication State
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null means "checking"
    
    // Dashboard State
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
    const [kpiData, setKpiData] = useState<KpiData[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<DataLevel>(DataLevel.ACCOUNT);
    const [chartMetric, setChartMetric] = useState<ChartMetric>('amountSpent');
    const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

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
    }, [handleAuthenticationError]);
    
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
        try {
            const data = await getKpiData(selectedAccount.id, selectedLevel);
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
    }, [selectedAccount, selectedLevel, isAuthenticated, handleAuthenticationError]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData]);
    
    const aggregatedChartData = useMemo(() => {
        if (selectedLevel === DataLevel.ACCOUNT) {
            return kpiData;
        }
        
        const dailyTotals: { [date: string]: KpiData } = {};
        kpiData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = {
                    id: item.date, entityId: item.date, name: `Resumo - ${item.date}`, level: selectedLevel, date: item.date,
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
        
        return Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));
    }, [kpiData, selectedLevel]);
    
    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        
        if (selectedLevel === DataLevel.ACCOUNT) {
            return kpiData.map(d => ({ ...d, name: new Date(d.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }));
        }
        
        const aggregated: { [id: string]: KpiData } = {};
        kpiData.forEach(item => {
            if (!aggregated[item.entityId]) {
                aggregated[item.entityId] = {
                    id: item.entityId,
                    entityId: item.entityId,
                    name: item.name,
                    level: item.level,
                    date: '', // Aggregated, so no single date
                    amountSpent: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, results: 0,
                    costPerResult: 0, ctr: 0, cpc: 0, cpm: 0
                };
            }
            
            const totals = aggregated[item.entityId];
            totals.amountSpent += item.amountSpent;
            totals.impressions += item.impressions;
            totals.reach += item.reach; // Summing reach is not perfectly accurate but a common simplification
            totals.clicks += item.clicks;
            totals.linkClicks += item.linkClicks;
            totals.results += item.results;
        });
    
        Object.values(aggregated).forEach(totals => {
            totals.costPerResult = totals.results > 0 ? parseFloat((totals.amountSpent / totals.results).toFixed(2)) : 0;
            totals.ctr = totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;
            totals.cpc = totals.clicks > 0 ? parseFloat((totals.amountSpent / totals.clicks).toFixed(2)) : 0;
            totals.cpm = totals.impressions > 0 ? parseFloat(((totals.amountSpent / totals.impressions) * 1000).toFixed(2)) : 0;
        });
    
        return Object.values(aggregated);
    }, [kpiData, selectedLevel]);


    const handleAccountSelect = (account: AdAccount) => {
        setSelectedAccount(account);
        setSelectedLevel(DataLevel.ACCOUNT);
        setKpiData([]); // Clear old data immediately
    };

    const LevelSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-2">Nível:</span>
            {(Object.values(DataLevel)).map(level => (
                <button
                    key={level} onClick={() => setSelectedLevel(level)} disabled={disabled}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${selectedLevel === level ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >{level}</button>
            ))}
        </div>
    );
    
    const MetricSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => (
         <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 mr-2">Métrica do Gráfico:</span>
            {(Object.keys(chartMetrics) as ChartMetric[]).map(metric => (
                <button
                    key={metric} onClick={() => setChartMetric(metric)} disabled={disabled}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${chartMetric === metric ? 'bg-blue-600 text-white shadow' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >{chartMetrics[metric].label}</button>
            ))}
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
            {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert"><strong className="font-bold">Ocorreu um erro: </strong><span className="block sm:inline">{error}</span></div>)}
            <BalanceList accounts={adAccounts} selectedAccountId={selectedAccount?.id || null} onAccountSelect={handleAccountSelect} isLoading={isLoadingAccounts}/>
            {isLoadingAccounts ? (
                 <div className="text-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div></div>
            ) : selectedAccount ? (
                 <div>
                    <BalanceCard account={selectedAccount} />
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg space-y-4">
                        <LevelSelector disabled={isLoadingKpis} />
                        <MetricSelector disabled={isLoadingKpis} />
                    </div>
                    <LineChart data={aggregatedChartData} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} />
                    <KpiTable data={tableData} isLoading={isLoadingKpis} currency={selectedAccount.currency} />
                </div>
            ) : (adAccounts.length === 0 && !error && (<div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"><p className="text-gray-500 dark:text-gray-400">Nenhuma conta de anúncio foi encontrada para este usuário.</p></div>))}
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