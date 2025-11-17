import React from 'react';
import { AdAccount } from '../types';

interface BalanceCardProps {
    account: AdAccount | null;
}

const BalanceCard: React.FC<BalanceCardProps> = ({ account }) => {
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
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
    };

    const getProgressBarColor = () => {
        if (spentPercentage >= 90) return 'bg-red-500';
        if (spentPercentage >= 75) return 'bg-orange-400';
        return 'bg-blue-600';
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                {name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Saldo Atual</p>
                    <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(balance)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Valor Gasto</p>
                    <p className="text-2xl font-semibold text-gray-800 dark:text-white">{formatCurrency(amountSpent)}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Limite de Gastos</p>
                    <p className="text-2xl font-semibold text-gray-800 dark:text-white">{formatCurrency(spendingLimit)}</p>
                </div>
            </div>
            <div className="mt-6">
                <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progresso de Gastos</span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{spentPercentage.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${getProgressBarColor()}`}
                        style={{ width: `${spentPercentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default BalanceCard;
