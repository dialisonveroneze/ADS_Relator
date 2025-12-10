
import React from 'react';

const META_APP_ID = '897058925982042'; 
// Google Client ID should technically come from env, using a placeholder if strict env not available
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; 

const LoginScreen: React.FC = () => {
    
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const PRODUCTION_DOMAIN = 'https://dashboard.mindfulmarketing.com.br';
    const ROOT_URL = isLocalhost ? window.location.origin : PRODUCTION_DOMAIN;

    // Meta Auth Config
    const metaRedirectUri = `${ROOT_URL}/api/auth`;
    const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(metaRedirectUri)}&scope=ads_read`;

    // Google Auth Config
    const googleRedirectUri = `${ROOT_URL}/api/auth/google-callback`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(googleRedirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent`;

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 min-h-[calc(100vh-80px)]">
             <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo ao ADS Relator</h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Conecte suas contas de anúncio para visualizar seus dados unificados.</p>
                
                <div className="flex flex-col gap-4">
                    <a
                        href={metaAuthUrl}
                        className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-[1.02] duration-300 ease-in-out flex items-center justify-center gap-3"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="currentColor"><path d="M12 2.04c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm2.25 10.5h-2.25v6h-3v-6h-1.5v-2.5h1.5v-2c0-1.29.67-2.5 2.5-2.5h2.25v2.5h-1.5c-.28 0-.5.22-.5.5v1.5h2.25l-.25 2.5z"/></svg>
                        Entrar com Meta Ads
                    </a>

                    <a
                        href={googleAuthUrl}
                        className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-[1.02] duration-300 ease-in-out flex items-center justify-center gap-3"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
                        Entrar com Google Ads
                    </a>
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <a href="https://www.mindfulmarketing.com.br/lgpd-mind-dash" target="_blank" rel="noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Política de Privacidade</a>
                    <span className="hidden sm:inline">•</span>
                    <a href="https://www.mindfulmarketing.com.br/termos-de-uso-mind-dash" target="_blank" rel="noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Termos de Serviço</a>
                </div>
             </div>
        </div>
    );
};

export default LoginScreen;
