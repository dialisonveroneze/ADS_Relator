import React, { useState, useEffect } from 'react';

interface LoginScreenProps {
    onLogin: () => void;
    metaAppId: string;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, metaAppId }) => {
    const [redirectUri, setRedirectUri] = useState('');

    useEffect(() => {
        // Garante que window.location.href seja lido apenas no lado do cliente
        setRedirectUri(window.location.href);
    }, []);

    const isAppIdSet = metaAppId && metaAppId !== 'YOUR_META_APP_ID_HERE';

    // Constrói a URL de autorização real que seria usada
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=ads_read,read_insights`;

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
             <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
                <svg className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo ao Meta Ads Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Conecte sua conta do Meta para visualizar seus dados de performance e saldos.</p>
                <button
                    onClick={onLogin}
                    disabled={!isAppIdSet}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 ease-in-out flex items-center justify-center gap-3 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor"><path d="M12 2.04c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm2.25 10.5h-2.25v6h-3v-6h-1.5v-2.5h1.5v-2c0-1.29.67-2.5 2.5-2.5h2.25v2.5h-1.5c-.28 0-.5.22-.5.5v1.5h2.25l-.25 2.5z"/></svg>
                    Conectar com o Meta
                </button>
                
                {!isAppIdSet && (
                    <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-400 dark:border-yellow-600 rounded-lg text-yellow-800 dark:text-yellow-200">
                        <p className="font-semibold">Configuração necessária:</p>
                        <p className="text-sm">Para habilitar o login, insira seu App ID da Meta na constante `META_APP_ID` dentro do arquivo `App.tsx`.</p>
                    </div>
                )}

                <div className="mt-6 text-xs text-left text-gray-500 dark:text-gray-400 space-y-2">
                     <p>
                        <span className="font-semibold">Como funciona:</span> Clicar no botão acima simula o fluxo de autenticação OAuth 2.0. Em uma aplicação real, você seria redirecionado para a Meta para autorizar o acesso.
                    </p>
                    <p>
                        <span className="font-semibold">URL de Autorização (Exemplo):</span>
                    </p>
                    <code className="block bg-gray-100 dark:bg-gray-900 p-2 rounded-md text-gray-700 dark:text-gray-300 break-all">
                        {authUrl}
                    </code>
                </div>
             </div>
        </div>
    );
};

export default LoginScreen;
