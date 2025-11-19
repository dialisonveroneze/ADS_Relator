
import React from 'react';

// Estas constantes seriam idealmente carregadas de variáveis de ambiente do build,
// mas para este projeto sem build, elas são definidas aqui.
const META_APP_ID = '897058925982042'; 

const LoginScreen: React.FC = () => {
    
    // Lógica para definir a URL base de redirecionamento:
    // 1. Se estivermos em localhost (desenvolvimento), usa o próprio localhost.
    // 2. Se estivermos em QUALQUER outro lugar (Vercel Preview, Produção, etc),
    //    FORÇAMOS o uso do domínio oficial.
    // Isso evita o erro "URL Bloqueada" do Facebook ao acessar por links temporários da Vercel,
    // pois o Facebook exige que a URL de redirecionamento esteja na lista de permissões (Allowlist).
    
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    // Substitua pela sua URL de produção final configurada no Facebook
    const PRODUCTION_DOMAIN = 'https://dashboard.mindfulmarketing.com.br';
    
    const ROOT_URL = isLocalhost ? window.location.origin : PRODUCTION_DOMAIN;

    // A URL de redirecionamento DEVE apontar para o nosso endpoint de backend.
    const redirectUri = `${ROOT_URL}/api/auth`;
    
    // Constrói a URL de autorização real.
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=ads_read`;

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
             <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
                <svg className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo ao Meta Ads Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Conecte sua conta do Meta para visualizar seus dados de performance e saldos.</p>
                <a
                    href={authUrl}
                    className="w-full inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 ease-in-out flex items-center justify-center gap-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor"><path d="M12 2.04c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm2.25 10.5h-2.25v6h-3v-6h-1.5v-2.5h1.5v-2c0-1.29.67-2.5 2.5-2.5h2.25v2.5h-1.5c-.28 0-.5.22-.5.5v1.5h2.25l-.25 2.5z"/></svg>
                    Conectar com o Meta
                </a>
                
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <a href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Política de Privacidade</a>
                    <span className="hidden sm:inline">•</span>
                    <a href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Termos de Serviço</a>
                </div>
             </div>
        </div>
    );
};

export default LoginScreen;
