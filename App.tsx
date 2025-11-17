import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BalanceList from './components/BalanceList';
import BalanceCard from './components/BalanceCard';
import LineChart from './components/LineChart';
import KpiTable from './components/KpiTable';
import { getAdAccounts, getKpiData } from './services/metaAdsService';
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
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
    
    // Dashboard State
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
    const [kpiData, setKpiData] = useState<KpiData[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<DataLevel>(DataLevel.ACCOUNT);
    const [chartMetric, setChartMetric] = useState<ChartMetric>('amountSpent');
    const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleLogin = () => {
        setIsAuthenticating(true);
        setTimeout(() => {
            setAccessToken('SIMULATED_ACCESS_TOKEN');
            setIsAuthenticating(false);
        }, 1000);
    };

    const handleLogout = () => {
        setAccessToken(null);
    };
    
    const isAuthenticated = !!accessToken;

    useEffect(() => {
        if (!accessToken) {
             setAdAccounts([]);
             setSelectedAccount(null);
             setKpiData([]);
             setError(null);
             setSelectedLevel(DataLevel.ACCOUNT);
            return;
        }

        const fetchAccounts = async () => {
            setIsLoadingAccounts(true);
            setError(null);
            try {
                const accounts = await getAdAccounts(accessToken);
                setAdAccounts(accounts);
                if (accounts.length > 0) {
                    setSelectedAccount(accounts[0]);
                }
            } catch (err) {
                setError("Falha ao buscar contas. Verifique sua conexão ou token.");
                setAccessToken(null);
            } finally {
                setIsLoadingAccounts(false);
            }
        };
        fetchAccounts();
    }, [accessToken]);

    const fetchKpiData = useCallback(async () => {
        if (!selectedAccount || !accessToken) return;
        setIsLoadingKpis(true);
        try {
            const data = await getKpiData(accessToken, selectedAccount.id, selectedLevel);
            setKpiData(data);
        } catch (err) {
             setError("Falha ao buscar os dados de KPI.");
        } finally {
            setIsLoadingKpis(false);
        }
    }, [selectedAccount, selectedLevel, accessToken]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData]);
    
    const aggregatedChartData = useMemo(() => {
        if (selectedLevel === DataLevel.ACCOUNT) {
            return kpiData; // Data from service is already aggregated by day
        }
        
        const dailyTotals: { [date: string]: KpiData } = {};
        kpiData.forEach(item => {
            if (!dailyTotals[item.date]) {
                dailyTotals[item.date] = {
                    id: item.date, name: `Resumo - ${item.date}`, level: selectedLevel, date: item.date,
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


    const handleAccountSelect = (account: AdAccount) => {
        setSelectedAccount(account);
        setSelectedLevel(DataLevel.ACCOUNT); // Reset to account level on new account selection
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
        if (isAuthenticating) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Autenticando...</p>
                </div>
            );
        }
        return isAuthenticated ? <Dashboard /> : <LoginScreen onLogin={handleLogin} />;
    };

    const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
        <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
             <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-lg w-full">
                <svg className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo ao Meta Ads Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Conecte sua conta do Meta para visualizar seus dados de performance e saldos.</p>
                <button
                    onClick={onLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 ease-in-out flex items-center justify-center gap-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor"><path d="M12 2.04c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm2.25 10.5h-2.25v6h-3v-6h-1.5v-2.5h1.5v-2c0-1.29.67-2.5 2.5-2.5h2.25v2.5h-1.5c-.28 0-.5.22-.5.5v1.5h2.25l-.25 2.5z"/></svg>
                    Conectar com o Meta (Simulado)
                </button>
                <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
                    O login real com o Meta está desativado neste ambiente de desenvolvimento devido a restrições de domínio.
                </p>
             </div>
        </div>
    );

    const Dashboard = () => (
         <main className="container mx-auto p-4 md:p-6 space-y-8">
            {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert"><strong className="font-bold">Ocorreu um erro: </strong><span className="block sm:inline">{error}</span></div>)}
            <BalanceList accounts={adAccounts} selectedAccountId={selectedAccount?.id || null} onAccountSelect={handleAccountSelect} isLoading={isLoadingAccounts}/>
            {selectedAccount ? (
                 <div>
                    <BalanceCard account={selectedAccount} />
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg space-y-4">
                        <LevelSelector disabled={isLoadingKpis} />
                        <MetricSelector disabled={isLoadingKpis} />
                    </div>
                    <LineChart data={aggregatedChartData} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} />
                    <KpiTable data={kpiData} isLoading={isLoadingKpis} />
                </div>
            ) : (!isLoadingAccounts && adAccounts.length === 0 && !error && (<div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg"><p className="text-gray-500 dark:text-gray-400">Nenhuma conta de anúncio foi encontrada para este usuário.</p></div>))}
        </main>
    );
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Header isAuthenticated={isAuthenticated} onLogout={handleLogout} />
            <AuthContent />
        </div>
    );
};

export default App;