
import React, { useState } from 'react';
import { UserSubscription } from '../types';

interface SubscriptionGateProps {
    subscription: UserSubscription | null;
    isLoading: boolean;
    onSubscriptionUpdate: () => void;
    children: React.ReactNode;
}

const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ subscription, isLoading, onSubscriptionUpdate, children }) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubscribe = async () => {
        setIsProcessing(true);
        try {
            // Chama nossa API que cria a sessão no Stripe
            const response = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.url) {
                // Redireciona o usuário para o Stripe
                window.location.href = data.url;
            } else {
                alert('Erro ao iniciar pagamento: ' + (data.message || 'Erro desconhecido'));
                setIsProcessing(false);
            }
        } catch (err) {
            console.error(err);
            alert('Erro de conexão ao iniciar pagamento.');
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Se ativo ou em trial, mostra o app (com banner se for trial)
    if (subscription && (subscription.status === 'active' || subscription.status === 'trial_active')) {
        return (
            <>
                {subscription.status === 'trial_active' && (
                    <div className="bg-blue-600 text-white text-sm py-2 px-4 text-center flex justify-center items-center flex-wrap gap-2">
                        <span>Você tem <strong>{subscription.daysRemaining} dias</strong> restantes no seu teste gratuito.</span>
                        <button 
                            onClick={handleSubscribe} 
                            disabled={isProcessing}
                            className="underline hover:text-blue-100 font-bold disabled:opacity-50"
                        >
                            {isProcessing ? 'Carregando...' : 'Assinar agora'}
                        </button>
                    </div>
                )}
                {children}
            </>
        );
    }

    // Se expirado, mostra o Paywall (Bloqueio)
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row">
                
                {/* Lado Esquerdo: Proposta de Valor */}
                <div className="md:w-1/2 bg-blue-600 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Desbloqueie todo o potencial dos seus anúncios.</h2>
                        <p className="text-blue-100 text-lg mb-8">Seu período de teste gratuito terminou. Continue otimizando suas campanhas com dados precisos.</p>
                        
                        <ul className="space-y-4">
                            {[
                                'Relatórios detalhados de performance',
                                'Algoritmo de correção de resultados Meta',
                                'Gráficos de evolução diária',
                                'Suporte a múltiplas contas de anúncio',
                                'Dashboards ilimitados'
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3">
                                    <div className="bg-blue-500/50 p-1 rounded-full">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500 rounded-full opacity-30 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-400 rounded-full opacity-30 blur-3xl"></div>
                </div>

                {/* Lado Direito: Checkout Action */}
                <div className="md:w-1/2 p-8 md:p-12 bg-white dark:bg-gray-800 flex flex-col justify-center">
                    <div className="mb-8 text-center md:text-left">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Assinatura Pro</h3>
                        <div className="flex items-baseline gap-1 justify-center md:justify-start">
                            <span className="text-4xl font-extrabold text-blue-600">R$ 19,90</span>
                            <span className="text-gray-500 dark:text-gray-400">/ mês</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            Cancele a qualquer momento. Sem fidelidade.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleSubscribe}
                            disabled={isProcessing}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-lg transition-transform transform hover:scale-[1.02] duration-200 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    Assinar com Segurança
                                </>
                            )}
                        </button>
                        
                        <div className="flex items-center justify-center gap-4 opacity-60 grayscale">
                             {/* Ícones de Bandeiras de Cartão (Simulados visualmente) */}
                             <div className="h-8 w-12 bg-gray-200 rounded"></div>
                             <div className="h-8 w-12 bg-gray-200 rounded"></div>
                             <div className="h-8 w-12 bg-gray-200 rounded"></div>
                        </div>

                        <p className="text-xs text-center text-gray-400 mt-6">
                            O pagamento é processado pelo Stripe. Seus dados financeiros nunca tocam nossos servidores.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionGate;
