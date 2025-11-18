
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

    // ORDEM ESTRITA DAS COLUNAS
    const headers: { label: string; key: SortableKeys; align?: 'left' | 'right' | 'center'; minWidth?: string }[] = [
        { label: "Nome", key: "name", align: 'left', minWidth: 'min-w-[250px]' },
        { label: "Valor Gasto", key: "amountSpent", align: 'right', minWidth: 'min-w-[120px]' },
        { label: "Impressões", key: "impressions", align: 'right', minWidth: 'min-w-[100px]' },
        { label: "Alcance", key: "reach", align: 'right', minWidth: 'min-w-[100px]' },
        { label: "Cliques (Todos)", key: "clicks", align: 'right', minWidth: 'min-w-[100px]' },
        { label: "Cliques no Link", key: "inlineLinkClicks", align: 'right', minWidth: 'min-w-[120px]' },
        { label: "Resultados", key: "results", align: 'right', minWidth: 'min-w-[100px]' },
        { label: "Custo p/ Resultado", key: "costPerResult", align: 'right', minWidth: 'min-w-[140px]' },
        { label: "CTR", key: "ctr", align: 'right', minWidth: 'min-w-[80px]' },
        { label: "CPM", key: "cpm", align: 'right', minWidth: 'min-w-[100px]' },
        { label: "CPC", key: "cpc", align: 'right', minWidth: 'min-w-[100px]' },
        { label: "CPC (Link)", key: "costPerInlineLinkClick", align: 'right', minWidth: 'min-w-[100px]' },
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
                    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
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
            amountSpent: 0, impressions: 0, reach: 0, clicks: 0, inlineLinkClicks: 0, results: 0
        });

        const cpm = sum.impressions > 0 ? (sum.amountSpent / sum.impressions) * 1000 : 0;
        const ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
        const cpc = sum.clicks > 0 ? sum.amountSpent / sum.clicks : 0;
        const costPerInlineLinkClick = sum.inlineLinkClicks > 0 ? sum.amountSpent / sum.inlineLinkClicks : 0;
        const costPerResult = sum.results > 0 ? sum.amountSpent / sum.results : 0;

        return { ...sum, cpm, ctr, cpc, costPerInlineLinkClick, costPerResult, name: "Total Geral" };
    }, [data]);

    const getSortIndicator = (key: SortableKeys) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
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

    const getCellClass = (key: SortableKeys, isSticky: boolean = false) => {
        let base = "py-3 px-4 whitespace-nowrap text-sm transition-colors duration-200 ";
        
        if (key === 'name') {
            base += "font-medium text-gray-900 dark:text-white text-left ";
        } else if (key === 'results') {
            base += "font-semibold text-blue-600 dark:text-blue-400 text-right ";
        } else {
            base += "text-gray-600 dark:text-gray-300 text-right ";
        }

        if (isSticky) {
            // Classes para fixar a primeira coluna
            base += "sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)] ";
        }

        return base;
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg mt-6 flex flex-col h-full">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Métricas Detalhadas</h3>
            
            <div className="flex-grow overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg relative">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-20 shadow-sm">
                        <tr>
                            {headers.map((header, index) => (
                                <th 
                                    key={header.key} 
                                    scope="col" 
                                    className={`
                                        py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer select-none 
                                        hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap ${header.minWidth}
                                        ${index === 0 ? 'sticky left-0 z-30 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
                                    `}
                                    style={{ textAlign: header.align || 'left' }}
                                    onClick={() => requestSort(header.key)}
                                >
                                    <div className={`flex items-center ${header.align === 'right' ? 'justify-end' : 'justify-start'} gap-1`}>
                                        {header.label}
                                        <span className="text-blue-500 dark:text-blue-400 w-3">{getSortIndicator(header.key)}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse bg-white dark:bg-gray-800">
                                    {headers.map((h, i) => (
                                        <td key={h.key} className={`p-4 ${i === 0 ? 'sticky left-0 bg-white dark:bg-gray-800' : ''}`}>
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    Nenhum dado encontrado para o período selecionado.
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((item) => (
                                <tr 
                                    key={item.id} 
                                    onClick={() => onRowClick && onRowClick(item.entityId)}
                                    className={`
                                        transition-colors duration-150 group
                                        ${onRowClick ? 'cursor-pointer' : ''}
                                        ${selectedEntityId === item.entityId 
                                            ? 'bg-blue-50 dark:bg-blue-900/30' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }
                                    `}
                                >
                                    {headers.map((header, index) => (
                                        <td 
                                            key={header.key} 
                                            className={`${getCellClass(header.key, index === 0)} ${selectedEntityId === item.entityId && index === 0 ? '!bg-blue-50 dark:!bg-gray-800' : ''}`}
                                        >
                                            {renderCell(item, header.key)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                    {!isLoading && totals && (
                        <tfoot className="bg-gray-100 dark:bg-gray-900 font-bold text-gray-900 dark:text-white sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <tr>
                                {headers.map((header, index) => (
                                    <td 
                                        key={header.key} 
                                        className={`py-4 px-4 whitespace-nowrap border-t-2 border-gray-300 dark:border-gray-600 ${header.align === 'right' ? 'text-right' : 'text-left'}
                                            ${index === 0 ? 'sticky left-0 z-30 bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-600 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
                                        `}
                                    >
                                        {header.key === 'name' ? 'Total Geral' : renderCell(totals, header.key)}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default KpiTable;
