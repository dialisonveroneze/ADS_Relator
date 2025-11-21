
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { KpiData } from '../types';

interface KpiTableProps {
    data: KpiData[];
    isLoading: boolean;
    currency: string;
    selectedEntityIds?: string[];
    onRowClick?: (entityId: string, isMultiSelect: boolean) => void;
}

type SortableKeys = keyof Omit<KpiData, 'id' | 'level' | 'date' | 'entityId'>;

// CONFIGURAÇÃO DE CABEÇALHO FORA DO COMPONENTE (ESTÁTICA)
// ORDEM ESTRITA DAS COLUNAS - NÃO ALTERAR A SEQUÊNCIA
const HEADERS_CONFIG: { label: string; key: SortableKeys; align?: 'left' | 'right' | 'center'; minWidth: string }[] = [
    { label: "Nome", key: "name", align: 'left', minWidth: 'min-w-[160px] md:min-w-[250px]' },
    { label: "Valor Gasto", key: "amountSpent", align: 'right', minWidth: 'min-w-[110px] md:min-w-[120px]' },
    { label: "Impressões", key: "impressions", align: 'right', minWidth: 'min-w-[90px] md:min-w-[110px]' },
    { label: "Alcance", key: "reach", align: 'right', minWidth: 'min-w-[90px] md:min-w-[110px]' },
    { label: "Cliques (Todos)", key: "clicks", align: 'right', minWidth: 'min-w-[90px] md:min-w-[110px]' },
    { label: "Cliques no Link", key: "inlineLinkClicks", align: 'right', minWidth: 'min-w-[110px] md:min-w-[130px]' },
    { label: "Resultados", key: "results", align: 'right', minWidth: 'min-w-[90px] md:min-w-[110px]' },
    { label: "Custo p/ Resultado", key: "costPerResult", align: 'right', minWidth: 'min-w-[130px] md:min-w-[150px]' },
    { label: "CTR", key: "ctr", align: 'right', minWidth: 'min-w-[70px] md:min-w-[90px]' },
    { label: "CPM", key: "cpm", align: 'right', minWidth: 'min-w-[90px] md:min-w-[100px]' },
    { label: "CPC", key: "cpc", align: 'right', minWidth: 'min-w-[90px] md:min-w-[100px]' },
    { label: "CPC (Link)", key: "costPerInlineLinkClick", align: 'right', minWidth: 'min-w-[100px] md:min-w-[120px]' },
];

const KpiTable: React.FC<KpiTableProps> = ({ data, isLoading, currency, selectedEntityIds = [], onRowClick }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({
        key: 'amountSpent',
        direction: 'descending'
    });

    const [visibleKeys, setVisibleKeys] = useState<Set<SortableKeys>>(
        new Set(HEADERS_CONFIG.map(h => h.key))
    );
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowColumnSelector(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleColumn = (key: SortableKeys) => {
        if (key === 'name') return; 
        const newSet = new Set(visibleKeys);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setVisibleKeys(newSet);
    };

    const visibleHeaders = HEADERS_CONFIG.filter(h => visibleKeys.has(h.key));

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
            case 'name':
                return (
                    <div className="truncate max-w-[180px] md:max-w-[350px]" title={item[key]}>
                        {item[key]}
                    </div>
                );
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

    // Função auxiliar para lidar com o clique, verificando se Ctrl está pressionado
    const handleRowClick = (e: React.MouseEvent, entityId: string) => {
        if (onRowClick) {
            // Detecta Ctrl (Windows) ou Command (Mac)
            const isMultiSelect = e.ctrlKey || e.metaKey;
            onRowClick(entityId, isMultiSelect);
        }
    };

    // Helper para verificar se está selecionado
    const isSelected = (id: string) => selectedEntityIds.includes(id);

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg mt-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Métricas Detalhadas</h3>
                
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setShowColumnSelector(!showColumnSelector)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Colunas
                    </button>
                    
                    {showColumnSelector && (
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
                            <div className="p-2 max-h-[300px] overflow-y-auto">
                                {HEADERS_CONFIG.map(h => (
                                    <label key={h.key} className={`flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded text-sm ${h.key === 'name' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={visibleKeys.has(h.key)} 
                                            onChange={() => toggleColumn(h.key)}
                                            disabled={h.key === 'name'}
                                            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"
                                        />
                                        <span className="ml-2 text-gray-700 dark:text-gray-200">{h.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex-grow overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg relative">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-20 shadow-sm">
                        <tr>
                            {/* Coluna de Seleção (Checkbox) */}
                            {onRowClick && (
                                <th className="py-3 px-4 sticky left-0 z-30 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)] w-[40px]">
                                    <span className="sr-only">Selecionar</span>
                                </th>
                            )}

                            {visibleHeaders.map((header, index) => (
                                <th 
                                    key={header.key} 
                                    scope="col" 
                                    className={`
                                        py-3 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 tracking-wider cursor-pointer select-none 
                                        hover:bg-gray-100 dark:hover:bg-gray-600 whitespace-nowrap ${header.minWidth}
                                        ${index === 0 && !onRowClick ? 'sticky left-0 z-30 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
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
                                    {onRowClick && <td className="p-4 sticky left-0 bg-white dark:bg-gray-800"><div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div></td>}
                                    {visibleHeaders.map((h, i) => (
                                        <td key={h.key} className={`p-4 ${i === 0 && !onRowClick ? 'sticky left-0 bg-white dark:bg-gray-800' : ''}`}>
                                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={visibleHeaders.length + (onRowClick ? 1 : 0)} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    Nenhum dado encontrado para o período selecionado.
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((item) => (
                                <tr 
                                    key={item.id} 
                                    onClick={(e) => handleRowClick(e, item.entityId)}
                                    className={`
                                        transition-colors duration-150 group
                                        ${onRowClick ? 'cursor-pointer' : ''}
                                        ${isSelected(item.entityId) 
                                            ? 'bg-blue-50 dark:bg-blue-900/30' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }
                                    `}
                                >
                                    {/* Célula de Checkbox */}
                                    {onRowClick && (
                                        <td className={`py-3 px-4 sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]
                                            ${isSelected(item.entityId) ? 'bg-blue-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50'}
                                        `}>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected(item.entityId)} 
                                                onChange={() => {}} // Controlado pelo onClick da TR
                                                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                            />
                                        </td>
                                    )}

                                    {visibleHeaders.map((header, index) => (
                                        <td 
                                            key={header.key} 
                                            className={`
                                                py-3 px-4 whitespace-nowrap text-sm transition-colors duration-200
                                                ${header.key === 'name' ? "font-medium text-gray-900 dark:text-white text-left" : 
                                                  header.key === 'results' ? "font-semibold text-blue-600 dark:text-blue-400 text-right" : 
                                                  "text-gray-600 dark:text-gray-300 text-right"}
                                                
                                                ${index === 0 && !onRowClick ? 'sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
                                                ${isSelected(item.entityId) && index === 0 && !onRowClick ? '!bg-blue-50 dark:!bg-gray-800' : ''}
                                            `}
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
                                {onRowClick && (
                                    <td className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-600 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]"></td>
                                )}
                                {visibleHeaders.map((header, index) => (
                                    <td 
                                        key={header.key} 
                                        className={`py-4 px-4 whitespace-nowrap border-t-2 border-gray-300 dark:border-gray-600 ${header.align === 'right' ? 'text-right' : 'text-left'}
                                            ${index === 0 && !onRowClick ? 'sticky left-0 z-30 bg-gray-100 dark:bg-gray-900 border-r border-gray-300 dark:border-gray-600 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}
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
