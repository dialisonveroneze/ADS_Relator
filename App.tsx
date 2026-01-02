
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import BalanceList from './components/BalanceList';
import BalanceCard from './components/BalanceCard';
import LineChart from './components/LineChart';
import KpiTable from './components/KpiTable';
import SummaryTiles from './components/SummaryTiles';
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
    { key: 'last_7_days', label: '7D' },
    { key: 'last_14_days', label: '14D' },
    { key: 'last_30_days', label: '30D' },
    { key: 'this_month', label: 'Mês Atual' },
    { key: 'last_month', label: 'Mês Ant.' },
];

const App: React.FC = () => {
    const [authStatus, setAuthStatus] = useState<{ meta: boolean; google: boolean; checked: boolean }>({
        meta: false, google: false, checked: false
    });
    const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'google'>('meta');
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [kpiData, setKpiData] = useState<KpiData[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<DataLevel>(DataLevel.ACCOUNT);
    const [dateRange, setDateRange] = useState<DateRangeOption>('last_14_days');
    const [chartMetric, setChartMetric] = useState<ChartMetric>('amountSpent');
    const [showChart, setShowChart] = useState(true);
    const [isLoadingKpis, setIsLoadingKpis] = useState(false);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
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
            const tagged = accounts.map(acc => ({ ...acc, provider: platform }));
            setAdAccounts(tagged);
            if (tagged.length > 0 && selectedAccountIds.length === 0) setSelectedAccountIds([tagged[0].id]);
            setAuthStatus(prev => ({ ...prev, [platform]: true }));
        } catch (err: any) {
            if (err.message === 'Unauthorized') setAuthStatus(prev => ({ ...prev, [platform]: false }));
            else setError(err.message);
        } finally { setIsLoadingAccounts(false); }
    }, [selectedAccountIds.length]);

    useEffect(() => {
        const init = async () => {
            await checkSubscription();
            await fetchAccounts(selectedPlatform);
            setAuthStatus(prev => ({ ...prev, checked: true }));
        };
        init();
    }, [selectedPlatform, fetchAccounts, checkSubscription]);

    const fetchKpiData = useCallback(async () => {
        if (selectedAccountIds.length === 0) return;
        setIsLoadingKpis(true);
        try {
            const fetchPromises = selectedAccountIds.map(id => 
                selectedPlatform === 'meta' 
                ? getKpiData(id, selectedLevel, dateRange) 
                : getGoogleKpiData(id, selectedLevel, dateRange)
            );
            const results = await Promise.all(fetchPromises);
            setKpiData(results.flat());
        } catch (err: any) { setError(err.message); } finally { setIsLoadingKpis(false); }
    }, [selectedAccountIds, selectedLevel, dateRange, selectedPlatform]);

    useEffect(() => { fetchKpiData(); }, [fetchKpiData]);

    const consolidatedAccount = useMemo(() => {
        if (selectedAccountIds.length === 0) return null;
        const selected = adAccounts.filter(acc => selectedAccountIds.includes(acc.id));
        if (selected.length === 1) return selected[0];
        return selected.reduce((acc, curr) => ({
            ...acc, name: 'Visão Consolidada', balance: acc.balance + curr.balance, amountSpent: acc.amountSpent + curr.amountSpent, spendingLimit: acc.spendingLimit + curr.spendingLimit, currency: curr.currency
        }), { id: 'summary', name: 'Resumo', balance: 0, amountSpent: 0, spendingLimit: 0, currency: 'BRL', provider: selectedPlatform });
    }, [selectedAccountIds, adAccounts, selectedPlatform]);

    const tableData = useMemo(() => {
        if (kpiData.length === 0) return [];
        const summaryData = kpiData.filter(d => d.isPeriodTotal);
        const sourceData = summaryData.length > 0 ? summaryData : kpiData.filter(d => !d.isPeriodTotal);
        const aggregated: Record<string, KpiData> = {};
        sourceData.forEach(item => {
            if (!aggregated[item.entityId]) aggregated[item.entityId] = { ...item, amountSpent: 0, impressions: 0, reach: 0, clicks: 0, results: 0 };
            const t = aggregated[item.entityId];
            t.amountSpent += item.amountSpent; t.impressions += item.impressions; t.reach += item.reach; t.clicks += item.clicks; t.results += item.results;
        });
        return Object.values(aggregated).map(t => ({
            ...t,
            cpm: t.impressions > 0 ? (t.amountSpent / t.impressions) * 1000 : 0,
            ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
            cpc: t.clicks > 0 ? t.amountSpent / t.clicks : 0,
            costPerResult: t.results > 0 ? t.amountSpent / t.results : 0
        }));
    }, [kpiData]);

    const Dashboard = () => (
        <main className="container mx-auto p-4 md:p-6 space-y-6">
            <SubscriptionGate subscription={subscription} isLoading={isLoadingSubscription} onSubscriptionUpdate={checkSubscription}>
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="bg-gray-50 dark:bg-gray-900 p-1 rounded-2xl flex border border-gray-200 dark:border-gray-700">
                            <button onClick={() => setSelectedPlatform('meta')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${selectedPlatform === 'meta' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>META</button>
                            <button onClick={() => setSelectedPlatform('google')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${selectedPlatform === 'google' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400'}`}>GOOGLE</button>
                        </div>
                        <div className="flex gap-2">
                            {dateRangeOptions.map(opt => (
                                <button key={opt.key} onClick={() => setDateRange(opt.key)} className={`px-4 py-2 text-[10px] font-black rounded-xl border transition-all ${dateRange === opt.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'}`}>{opt.label}</button>
                            ))}
                        </div>
                    </div>

                    <SummaryTiles data={tableData} currency={consolidatedAccount?.currency || 'BRL'} isLoading={isLoadingKpis} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-6">
                            <BalanceList accounts={adAccounts} selectedAccountId={null} selectedAccountIds={selectedAccountIds} onAccountSelect={(acc, all) => {
                                if (all) setSelectedAccountIds(selectedAccountIds.length === adAccounts.length ? [] : adAccounts.map(a => a.id));
                                else if (acc) setSelectedAccountIds([acc.id]);
                            }} isLoading={isLoadingAccounts} />
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            {consolidatedAccount && <BalanceCard account={consolidatedAccount as AdAccount} isSummary={selectedAccountIds.length > 1} count={selectedAccountIds.length} />}
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex gap-2">
                                        {(Object.keys(chartMetrics) as ChartMetric[]).map(m => (
                                            <button key={m} onClick={() => setChartMetric(m)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${chartMetric === m ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-gray-400 border border-transparent'}`}>{chartMetrics[m].label}</button>
                                        ))}
                                    </div>
                                    <button onClick={() => setShowChart(!showChart)} className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{showChart ? 'Recolher' : 'Expandir'}</button>
                                </div>
                                {showChart && <div className="h-[300px]"><LineChart data={kpiData.filter(d => !d.isPeriodTotal)} metric={chartMetric} label={chartMetrics[chartMetric].label} isLoading={isLoadingKpis} /></div>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">Performance por {DATA_LEVEL_LABELS[selectedLevel]}</h3>
                            <div className="flex gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl">
                                {(Object.values(DataLevel)).map(l => (
                                    <button key={l} onClick={() => setSelectedLevel(l)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${selectedLevel === l ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-400'}`}>{DATA_LEVEL_LABELS[l]}</button>
                                ))}
                            </div>
                        </div>
                        <KpiTable data={tableData} isLoading={isLoadingKpis} currency={consolidatedAccount?.currency || 'BRL'} onRowClick={(id) => setSelectedEntityIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])} selectedEntityIds={selectedEntityIds} />
                    </div>
                </>
            </SubscriptionGate>
        </main>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
            <Header isAuthenticated={authStatus.meta || authStatus.google} onLogout={logout} subscription={subscription} />
            {!authStatus.checked ? (<div className="flex items-center justify-center min-h-[calc(100vh-80px)]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>) : (!authStatus.meta && !authStatus.google) ? (<LoginScreen />) : (<Dashboard />)}
        </div>
    );
};

export default App;
