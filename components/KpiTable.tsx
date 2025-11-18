
import React, { useState, useMemo } from 'react';
import { KpiData } from '../types';

interface KpiTableProps {
    data: KpiData[];
    isLoading: boolean;
    currency: string;
    selectedEntityId?: string | null;
    onRowClick?: (entityId: string) => void;
}

type SortableKeys = keyof Omit<KpiData, 'id' | 'level' | 'date' | 'entityId'>;

const KpiTable: React.FC<KpiTableProps> = ({ data, isLoading, currency, selectedEntityId, onRowClick }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({
        key: 'amountSpent',
        direction: 'descending'
    });

    const formatCurrency = (value: number) => {
        // If value is very small (like cost per reach), show more decimals
        if (value > 0 && value < 0.01) {
            return new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency, 
                minimumFractionDigits: 4, 
                maximumFractionDigits: 4 
            }).format(value);
        }
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
    };
    const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
    const formatPercent = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(value / 100);

    // Column Order: Name, AmountSpent, Impressions, Reach, Clicks (All), Link Clicks, Results, Cost Per Result, CTR, CPM, CPC
    const headers: { label: string; key: SortableKeys }[] = [
        { label: "Nome", key: "name" },
        { label: "Valor Gasto", key: "amountSpent" },
        { label: "Impressões", key: "impressions" },
        { label: "Alcance", key: "reach" },
        { label: "Cliques (Todos)", key: "clicks" },
        { label: "Cliques no Link", key: "inlineLinkClicks" },
        { label: "Resultados", key: "results" },
        { label: "Custo p/ Resultado", key: "costPerResult" },
        { label: "CTR (Todos)", key: "ctr" },
        { label: "CPM", key: "cpm" },
        { label: "CPC (Todos)", key: "cpc" },
        { label: "Custo p/ Clique (Link)", key: "costPerInlineLinkClick" }
    ];

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        if (data.length === 0) return [];
        let sortableData = [...data];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    if (aValue < bValue) {
                        return sortConfig.direction === 'ascending' ? -1 : 1;
                    }
                    if (aValue > bValue) {
                        return sortConfig.direction === 'ascending' ? 1 : -1;
                    }
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'ascending'
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                }
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    // Calculate Totals
    const totals = useMemo(() => {
        if (data.length === 0) return null;

        const sum = data.reduce((acc, item) => {
            acc.amountSpent += item.amountSpent;
            acc.impressions += item.impressions;
            acc.reach += item.reach;
            acc.clicks += item.clicks;
            acc.inlineLinkClicks += item.inlineLinkClicks;
            acc.results += item.results;
            return acc;
        }, {
            amountSpent: 0,
            impressions: 0,
            reach: 0,
            clicks: 0,
            inlineLinkClicks: 0,
            results: 0
        });

        // Calculate weighted averages for rates
        const cpm = sum.impressions > 0 ? (sum.amountSpent / sum.impressions) * 1000 : 0;
        const ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
        const cpc = sum.clicks > 0 ? sum.amountSpent / sum.clicks : 0;
        const costPerInlineLinkClick = sum.inlineLinkClicks > 0 ? sum.amountSpent / sum.inlineLinkClicks : 0;
        const costPerResult = sum.results > 0 ? sum.amountSpent / sum.results : 0;

        return {
            ...sum,
            cpm,
            ctr,
            cpc,
            costPerInlineLinkClick,
            costPerResult,
            name: "Total Geral"
        };
    }, [data]);

    const getSortIndicator = (key: SortableKeys) => {
        if (sortConfig.key !== key) {
            return null;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const renderSkeletonRows = () => {
        return Array.from({ length: 5 }).map((_, index) => (
            <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                {headers.map(h => (
                  <td key={h.key} className="py-3 px-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </td>
                ))}
            </tr>
        ));
    };

    const renderCell = (item: any, key: SortableKeys) => {
         switch(key) {
            case 'amountSpent':
            case 'cpm':
            case 'cpc':
            case 'costPerInlineLinkClick':
            case 'costPerResult':
                return formatCurrency(item[key]);
            case 'impressions':
            case 'reach':
            case 'clicks':
            case 'inlineLinkClicks':
            case 'results':
                return formatNumber(item[key]);
            case 'ctr':
                return formatPercent(item[key]);
            default:
                return item[key];
         }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg mt-6 overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Métricas Detalhadas</h3>
            <div className="min-w-full inline-block align-middle">
                <div className="overflow-hidden">
                    <table className="min-w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-400 uppercase">
                            <tr>
                                {headers.map(header => (
                                    <th 
                                        key={header.key} 
                                        scope="col" 
                                        className="py-3 px-4 font-semibold cursor-pointer select-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap"
                                        onClick={() => requestSort(header.key)}
                                    >
                                        {header.label}
                                        <span className="ml-1 text-blue-500 dark:text-blue-400 align-middle">{getSortIndicator(header.key)}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? renderSkeletonRows() : sortedData.map(item => (
                                <tr 
                                    key={item.id} 
                                    onClick={() => onRowClick && onRowClick(item.entityId)}
                                    className={`border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 
                                        ${onRowClick ? 'cursor-pointer' : ''}
                                        ${selectedEntityId === item.entityId 
                                            ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }
                                    `}
                                >
                                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{item.name}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatCurrency(item.amountSpent)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatNumber(item.impressions)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatNumber(item.reach)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatNumber(item.clicks)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatNumber(item.inlineLinkClicks)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400">{formatNumber(item.results)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatCurrency(item.costPerResult)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatPercent(item.ctr)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatCurrency(item.cpm)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatCurrency(item.cpc)}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">{formatCurrency(item.costPerInlineLinkClick)}</td>
                                </tr>
                            ))}
                            {!isLoading && sortedData.length === 0 && (
                                <tr>
                                    <td colSpan={headers.length} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        Nenhum dado encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {!isLoading && totals && (
                            <tfoot className="bg-gray-100 dark:bg-gray-900 font-bold text-gray-900 dark:text-white border-t-2 border-gray-300 dark:border-gray-600">
                                <tr>
                                    {headers.map(header => (
                                        <td key={header.key} className="py-3 px-4 whitespace-nowrap">
                                            {header.key === 'name' ? 'Total Geral' : renderCell(totals, header.key)}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default KpiTable;
