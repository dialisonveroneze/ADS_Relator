
import React from 'react';
import { KpiData } from '../types';

interface SummaryTilesProps {
    data: KpiData[];
    currency: string;
    isLoading: boolean;
}

const SummaryTiles: React.FC<SummaryTilesProps> = ({ data, currency, isLoading }) => {
    const totals = React.useMemo(() => {
        return data.reduce((acc, curr) => ({
            spend: acc.spend + curr.amountSpent,
            results: acc.results + curr.results,
            impressions: acc.impressions + curr.impressions
        }), { spend: 0, results: 0, impressions: 0 });
    }, [data]);

    const cpa = totals.results > 0 ? totals.spend / totals.results : 0;
    const ctr = totals.impressions > 0 ? (data.reduce((a, c) => a + c.clicks, 0) / totals.impressions) * 100 : 0;

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(val);

    const Tile = ({ label, value, sub }: { label: string, value: string, sub?: string }) => (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</span>
            <div className="flex flex-col">
                <span className="text-2xl font-black text-gray-900 dark:text-white">{isLoading ? '---' : value}</span>
                {sub && <span className="text-[10px] text-gray-500 mt-1 font-medium">{sub}</span>}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Investimento Total" value={formatCurrency(totals.spend)} sub="Gasto no período selecionado" />
            <Tile label="Resultados Totais" value={new Intl.NumberFormat('pt-BR').format(totals.results)} sub="Conversões agregadas" />
            <Tile label="CPA Médio" value={formatCurrency(cpa)} sub="Custo por resultado real" />
            <Tile label="CTR Médio" value={`${ctr.toFixed(2)}%`} sub="Taxa de cliques global" />
        </div>
    );
};

export default SummaryTiles;
