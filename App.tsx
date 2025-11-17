import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import BalanceList from './components/BalanceList';
import KpiTable from './components/KpiTable';
import { getAdAccounts, getKpiData } from './services/metaAdsService';
import { AdAccount, KpiData, DataLevel } from './types';

const App: React.FC = () => {
    // Authentication State: accessToken é a única fonte da verdade.
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
    
    // Dashboard State
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null);
    const [kpiData, setKpiData] = useState<KpiData[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<DataLevel>(DataLevel.CAMPAIGN);
    const [isLoadingKpis, setIsLoadingKpis] = useState<boolean>(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleLogin = () => {
        setIsAuthenticating(true);
        console.log("Simulating login...");
        setTimeout(() => {
            setAccessToken('SIMULATED_ACCESS_TOKEN');
            setIsAuthenticating(false);
            console.log("Login simulation successful.");
        }, 1000);
    };

    const handleLogout = () => {
        setAccessToken(null);
    };
    
    // A autenticação é derivada diretamente da existência do accessToken.
    const isAuthenticated = !!accessToken;

    useEffect(() => {
        // Limpa o estado ao deslogar
        if (!accessToken) {
             setAdAccounts([]);
             setSelectedAccount(null);
             setKpiData([]);
             setError(null);
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
                setAccessToken(null); // Desloga em caso de erro
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

    const handleAccountSelect = (account: AdAccount) => {
        setSelectedAccount(account);
    };

    const LevelSelector: React.FC<{ disabled: boolean }> = ({ disabled }) => (
        <div className="flex flex-wrap gap-2">
            {(Object.values(DataLevel)).map(level => (
                <button
                    key={level} onClick={() => setSelectedLevel(level)} disabled={disabled}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${selectedLevel === level ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >{level}</button>
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

    const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
        return (
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
        )
    };

    const Dashboard = () => (
         <main className="container mx-auto p-4 md:p-6 space-y-8">
            {error && (<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert"><strong className="font-bold">Ocorreu um erro: </strong><span className="block sm:inline">{error}</span></div>)}
            <BalanceList accounts={adAccounts} selectedAccountId={selectedAccount?.id || null} onAccountSelect={handleAccountSelect} isLoading={isLoadingAccounts}/>
            {selectedAccount ? (
                 <div>
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalhes da Conta: <span className="text-blue-600 dark:text-blue-400">{selectedAccount.name}</span></h2>
                        <p className="text-gray-500 dark:text-gray-400">Selecione um nível para visualizar os dados.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
                        <LevelSelector disabled={isLoadingKpis} />
                    </div>
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