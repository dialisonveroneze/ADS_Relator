
import React from 'react';
import { AdAccount } from '../types';

interface BalanceCardProps {
    account: AdAccount | null;
    isSummary?: boolean;
    count?: number;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ account, isSummary, count }) => {
    if (!account) {
        return (
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                </div>
            </div>
        );
    }

    const { name, balance, amountSpent, spendingLimit, currency } = account;
    const spentPercentage = spendingLimit > 0 ? (amountSpent / spendingLimit) * 100 : 0;

    const formatCurrency = (value: number) => {
        try {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(value);
        } catch (e) {
            return `R$ ${value.toFixed(2)}`;
        }
    };

    const getProgressBarColor = () => {
        if (spentPercentage >= 90) return 'bg-red-500';
        if (spentPercentage >= 75) return 'bg-orange-400';
        return 'bg-blue-600';
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6 border-l-4 border-blue-600">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {isSummary ? `Resumo Geral (${count} contas)` : name}
                </h2>
                {isSummary && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-bold uppercase tracking-widest">
                        Consolidado
                    </span>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Atual Total</p>
                    <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(balance)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Gasto</p>
                    <p className="text-2xl font-semibold text-gray-800 dark:text-white">{formatCurrency(amountSpent)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Limite de Gastos Global</p>
                    <p className="text-2xl font-semibold text-gray-800 dark:text-white">{formatCurrency(spendingLimit)}</p>
                </div>
            </div>
            {spendingLimit > 0 && (
                <div className="mt-6">
                    <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Uso do Orçamento Consolidado</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{spentPercentage.toFixed(2)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${getProgressBarColor()}`}
                            style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                        ></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BalanceCard;
