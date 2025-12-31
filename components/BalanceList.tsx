
import React, { useState, useMemo } from 'react';
import { AdAccount } from '../types';

interface BalanceListProps {
    accounts: AdAccount[];
    selectedAccountId: string | null;
    selectedAccountIds?: string[]; // Suporte a múltiplos IDs
    onAccountSelect: (account: AdAccount | null, isAll?: boolean) => void;
    isLoading: boolean;
}

type SortableKeys = keyof Pick<AdAccount, 'name' | 'id' | 'balance'>;

const BalanceList: React.FC<BalanceListProps> = ({ accounts, selectedAccountId, selectedAccountIds = [], onAccountSelect, isLoading }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({
        key: 'name',
        direction: 'ascending'
    });

    const headers: { label: string; key: SortableKeys }[] = [
        { label: "Conta de Anúncio", key: "name" },
        { label: "ID da Conta", key: "id" },
        { label: "Saldo Atual", key: "balance" }
    ];

    const formatCurrency = (value: number, currency: string) => {
        try {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value);
        } catch(e) {
            return `R$ ${value.toFixed(2)}`;
        }
    };

    const getBalanceClassName = (balance: number) => {
        const isLowBalance = balance < 500 && balance > 0;
        const isNoBalance = balance <= 0;
        if (isNoBalance) return 'text-red-500 font-semibold';
        if (isLowBalance) return 'text-orange-400 font-semibold';
        return 'text-gray-800 dark:text-white';
    };
    
    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedAccounts = useMemo(() => {
        if (accounts.length === 0) return [];
        let sortableAccounts = [...accounts];
        if (sortConfig.key) {
            sortableAccounts.sort((a, b) => {
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
        return sortableAccounts;
    }, [accounts, sortConfig]);

    const getSortIndicator = (key: SortableKeys) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const isAllSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Visão Geral dos Saldos
                </h2>
                {!isLoading && accounts.length > 0 && (
                    <button 
                        onClick={() => onAccountSelect(null, true)}
                        className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${
                            isAllSelected 
                            ? 'bg-blue-600 text-white shadow-lg' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                    >
                        {isAllSelected ? 'Todas Selecionadas' : 'Selecionar Todas'}
                    </button>
                )}
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="border-b-2 border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                        <tr>
                            {headers.map(header => (
                                <th 
                                    key={header.key} 
                                    scope="col" 
                                    className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase cursor-pointer select-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-600"
                                    onClick={() => requestSort(header.key)}
                                >
                                    {header.label}
                                    <span className="ml-1 text-blue-500 dark:text-blue-400 align-middle">{getSortIndicator(header.key)}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, index) => (
                                <tr key={index} className="animate-pulse">
                                    <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                                    <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
                                    <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div></td>
                                </tr>
                            ))
                        ) : sortedAccounts.map(account => {
                            const isSelected = selectedAccountId === account.id || selectedAccountIds.includes(account.id);
                            return (
                                <tr
                                    key={account.id}
                                    onClick={() => onAccountSelect(account)}
                                    className={`border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors duration-200 ${
                                        isSelected 
                                            ? 'bg-blue-50 dark:bg-blue-900/30' 
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                                >
                                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-transparent'}`}></div>
                                            {account.name}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{account.id}</td>
                                    <td className={`p-4 ${getBalanceClassName(account.balance)}`}>
                                        {formatCurrency(account.balance, account.currency)}
                                    </td>
                                </tr>
                            );
                        })}
                         {!isLoading && accounts.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    Nenhuma conta de anúncio encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BalanceList;
