
import React from 'react';
import { UserSubscription } from '../types';

interface HeaderProps {
    isAuthenticated: boolean;
    onLogout: () => void;
    subscription: UserSubscription | null;
}

const Header: React.FC<HeaderProps> = ({ isAuthenticated, onLogout, subscription }) => {
    
    // SUBSTITUA PELO SEU NÚMERO DE WHATSAPP REAL (DD + NÚMERO)
    const WHATSAPP_NUMBER = '5544991162288'; 
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20o%20ADS%20Relator.`;

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
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white cursor-pointer" onClick={() => window.location.href = '/'}>
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
                    {/* Botão de Ajuda (WhatsApp) */}
                    <a 
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium bg-green-50 hover:bg-green-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-green-700 dark:text-green-400 py-2 px-4 rounded-lg transition-colors border border-green-200 dark:border-gray-600 mr-2 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        Ajuda
                    </a>

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
