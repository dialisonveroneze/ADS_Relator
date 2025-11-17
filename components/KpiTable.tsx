import React from 'react';
import { KpiData } from '../types';

interface KpiTableProps {
    data: KpiData[];
    isLoading: boolean;
    currency: string;
}

const KpiTable: React.FC<KpiTableProps> = ({ data, isLoading, currency }) => {

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
    const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

    const headers = [
        "Nome", "Valor Gasto", "Impressões", "Alcance", "Cliques",
        "Cliques no Link", "Resultados", "Custo por Resultado", "CTR", "CPC", "CPM"
    ];

    const renderSkeletonRows = () => {
        return Array.from({ length: 5 }).map((_, index) => (
            <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                {headers.map(h => (
                  <td key={h} className="py-3 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </td>
                ))}
            </tr>
        ));
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg mt-6 overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Métricas Detalhadas</h3>
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-400 uppercase">
                    <tr>
                        {headers.map(header => (
                            <th key={header} scope="col" className="py-3 px-4 font-semibold">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? renderSkeletonRows() : data.map(item => (
                        <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-3 px-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{item.name}</td>
                            <td className="py-3 px-4">{formatCurrency(item.amountSpent)}</td>
                            <td className="py-3 px-4">{formatNumber(item.impressions)}</td>
                            <td className="py-3 px-4">{formatNumber(item.reach)}</td>
                            <td className="py-3 px-4">{formatNumber(item.clicks)}</td>
                            <td className="py-3 px-4">{formatNumber(item.linkClicks)}</td>
                            <td className="py-3 px-4 font-semibold">{formatNumber(item.results)}</td>
                            <td className="py-3 px-4">{formatCurrency(item.costPerResult)}</td>
                            <td className="py-3 px-4">{item.ctr.toFixed(2)}%</td>
                            <td className="py-3 px-4">{formatCurrency(item.cpc)}</td>
                            <td className="py-3 px-4">{formatCurrency(item.cpm)}</td>
                        </tr>
                    ))}
                    {!isLoading && data.length === 0 && (
                        <tr>
                            <td colSpan={headers.length} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                Nenhum dado encontrado.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default KpiTable;