
import React from 'react';
import { UserSubscription } from '../types';

interface HeaderProps {
    isAuthenticated: boolean;
    onLogout: () => void;
    subscription: UserSubscription | null;
}

const Header: React.FC<HeaderProps> = ({ isAuthenticated, onLogout, subscription }) => {
    
    const handleDebugAction = async (action: 'expire' | 'reset') => {
        if (!confirm(action === 'expire' ? 'Isso vai bloquear o acesso simulando um trial vencido. Continuar?' : 'Isso vai resetar tudo como um novo usuário. Continuar?')) return;
        
        await fetch(`/api/debug-subscription?action=${action}`);
        window.location.reload();
    };

    return (
        <header className="bg-white dark:bg-gray-800 shadow-md p-4 relative z-50">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white">
                        Meta Ads Dashboard
                    </h1>
                    
                    {/* Status Badge */}
                    {subscription && (
                        <span className={`ml-4 px-2 py-1 text-xs font-bold uppercase rounded-full ${
                            subscription.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            subscription.status === 'trial_active' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                            {subscription.status === 'active' ? 'PRO' : subscription.status === 'trial_active' ? 'TRIAL' : 'EXPIRADO'}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* Botões de Debug para Teste de Pagamento */}
                    {isAuthenticated && (
                        <div className="hidden md:flex items-center gap-2 mr-4 border-r pr-4 border-gray-300 dark:border-gray-600">
                            <button 
                                onClick={() => handleDebugAction('expire')}
                                className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-1 px-2 rounded transition-colors"
                                title="Simula o fim do trial para ver o Paywall"
                            >
                                🧪 Expirar Trial
                            </button>
                            <button 
                                onClick={() => handleDebugAction('reset')}
                                className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-1 px-2 rounded transition-colors"
                                title="Reseta para novo usuário (15 dias)"
                            >
                                🧪 Resetar
                            </button>
                        </div>
                    )}

                    {isAuthenticated && (
                        <button
                            onClick={onLogout}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
                        >
                            Sair
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
