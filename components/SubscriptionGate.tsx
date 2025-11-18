
import React, { useState } from 'react';
import { UserSubscription } from '../types';
import { performCheckout } from '../services/subscriptionService';

interface SubscriptionGateProps {
    subscription: UserSubscription | null;
    isLoading: boolean;
    onSubscriptionUpdate: () => void;
    children: React.ReactNode;
}

const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ subscription, isLoading, onSubscriptionUpdate, children }) => {
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card');
    const [isProcessing, setIsProcessing] = useState(false);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // If active or in trial, show the app (with a small banner if in trial)
    if (subscription && (subscription.status === 'active' || subscription.status === 'trial_active')) {
        return (
            <>
                {subscription.status === 'trial_active' && (
                    <div className="bg-blue-600 text-white text-sm py-2 px-4 text-center">
                        Você tem <strong>{subscription.daysRemaining} dias</strong> restantes no seu teste gratuito. 
                        <button 
                            onClick={() => setIsCheckingOut(true)} 
                            className="ml-2 underline hover:text-blue-100 font-bold"
                        >
                            Assinar agora
                        </button>
                    </div>
                )}
                
                {/* If user clicked "Subscribe Now" even during trial */}
                {isCheckingOut ? (
                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col md:flex-row relative">
                             <button 
                                onClick={() => setIsCheckingOut(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <CheckoutFlow 
                                onCancel={() => setIsCheckingOut(false)} 
                                onSuccess={onSubscriptionUpdate}
                                isProcessing={isProcessing}
                                setIsProcessing={setIsProcessing}
                                paymentMethod={paymentMethod}
                                setPaymentMethod={setPaymentMethod}
                            />
                        </div>
                    </div>
                ) : null}

                {children}
            </>
        );
    }

    // If expired, show the Paywall (Blocking)
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row">
                <CheckoutFlow 
                    onCancel={null} // Cannot cancel if expired
                    onSuccess={onSubscriptionUpdate}
                    isProcessing={isProcessing}
                    setIsProcessing={setIsProcessing}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                />
            </div>
        </div>
    );
};

const CheckoutFlow: React.FC<{
    onCancel: (() => void) | null;
    onSuccess: () => void;
    isProcessing: boolean;
    setIsProcessing: (v: boolean) => void;
    paymentMethod: 'credit_card' | 'pix';
    setPaymentMethod: (v: 'credit_card' | 'pix') => void;
}> = ({ onCancel, onSuccess, isProcessing, setIsProcessing, paymentMethod, setPaymentMethod }) => {
    
    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            await performCheckout(paymentMethod, {});
            onSuccess();
        } catch (err) {
            alert('Erro ao processar pagamento. Tente novamente.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            {/* Left Side: Value Proposition */}
            <div className="md:w-1/2 bg-blue-600 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Desbloqueie todo o potencial dos seus anúncios.</h2>
                    <p className="text-blue-100 text-lg mb-8">Seu período de teste gratuito terminou. Continue otimizando suas campanhas com dados precisos.</p>
                    
                    <ul className="space-y-4">
                        {[
                            'Relatórios detalhados de performance',
                            'Análise de custo por resultado real',
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
                
                {/* Decorative background circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500 rounded-full opacity-30 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-400 rounded-full opacity-30 blur-3xl"></div>
            </div>

            {/* Right Side: Checkout Form */}
            <div className="md:w-1/2 p-8 md:p-12 bg-white dark:bg-gray-800">
                <div className="mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Assinatura Mensal</h3>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-blue-600">R$ 19,90</span>
                        <span className="text-gray-500 dark:text-gray-400">/ mês</span>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <button
                            onClick={() => setPaymentMethod('credit_card')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                paymentMethod === 'credit_card' 
                                ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            Cartão de Crédito
                        </button>
                        <button
                            onClick={() => setPaymentMethod('pix')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                                paymentMethod === 'pix' 
                                ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            Pix (Instantâneo)
                        </button>
                    </div>
                </div>

                <form onSubmit={handlePay} className="space-y-4">
                    {paymentMethod === 'credit_card' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número do Cartão</label>
                                <input type="text" placeholder="0000 0000 0000 0000" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validade</label>
                                    <input type="text" placeholder="MM/AA" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CVV</label>
                                    <input type="text" placeholder="123" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome no Cartão</label>
                                <input type="text" placeholder="Como aparece no cartão" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" required />
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-2">QR Code Pix Gerado</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">O QR Code será exibido na próxima etapa após confirmação.</p>
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isProcessing}
                        className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg text-lg transition-transform transform hover:scale-[1.02] duration-200 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Processando...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Pagar R$ 19,90
                            </>
                        )}
                    </button>
                    
                    <p className="text-xs text-center text-gray-500 mt-4">
                        Pagamento seguro via Stripe. Cancele a qualquer momento.
                    </p>
                    
                    {onCancel && (
                        <button type="button" onClick={onCancel} className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mt-2">
                            Voltar para Dashboard (apenas visualização)
                        </button>
                    )}
                </form>
            </div>
        </>
    );
};

export default SubscriptionGate;
