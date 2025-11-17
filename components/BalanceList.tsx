import React from 'react';
import { AdAccount } from '../types';

interface BalanceListProps {
    accounts: AdAccount[];
    selectedAccountId: string | null;
    onAccountSelect: (account: AdAccount) => void;
    isLoading: boolean;
}

const BalanceList: React.FC<BalanceListProps> = ({ accounts, selectedAccountId, onAccountSelect, isLoading }) => {
    
    const formatCurrency = (value: number, currency: string) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
    };

    const getBalanceClassName = (balance: number) => {
        const isLowBalance = balance < 500 && balance > 0;
        const isNoBalance = balance <= 0;
        if (isNoBalance) return 'text-red-500 font-semibold';
        if (isLowBalance) return 'text-orange-400 font-semibold';
        return 'text-gray-800 dark:text-white';
    };

    const renderSkeletonRows = () => {
        return Array.from({ length: 4 }).map((_, index) => (
            <tr key={index} className="animate-pulse">
                <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
                <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div></td>
                <td className="p-4"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div></td>
            </tr>
        ));
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg">
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                Visão Geral dos Saldos
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">Conta de Anúncio</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">ID da Conta</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">Saldo Atual</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? renderSkeletonRows() : accounts.map(account => (
                            <tr
                                key={account.id}
                                onClick={() => onAccountSelect(account)}
                                className={`border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors duration-200 ${
                                    selectedAccountId === account.id 
                                        ? 'bg-blue-100 dark:bg-blue-900/50' 
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <td className="p-4 font-medium text-gray-900 dark:text-white">{account.name}</td>
                                <td className="p-4 text-gray-500 dark:text-gray-400">{account.id}</td>
                                <td className={`p-4 ${getBalanceClassName(account.balance)}`}>
                                    {formatCurrency(account.balance, account.currency)}
                                </td>
                            </tr>
                        ))}
                         {!isLoading && accounts.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-8 text-gray-500 dark:text-gray-400">
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
