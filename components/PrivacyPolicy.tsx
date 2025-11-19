
import React from 'react';

const PrivacyPolicy: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden">
                <div className="px-6 py-8">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Política de Privacidade</h1>
                        <a href="/" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Voltar ao Início</a>
                    </div>
                    
                    <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 space-y-6">
                        <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">1. Introdução</h2>
                            <p>
                                O <strong>ADS Relator</strong> ("nós", "nosso") está comprometido em proteger a sua privacidade. 
                                Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações 
                                quando você utiliza nossa aplicação web de dashboard para Meta Ads.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">2. Dados que Coletamos</h2>
                            <p>Para fornecer nossos serviços, coletamos e processamos os seguintes dados através da API do Meta (Facebook):</p>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li><strong>Informações de Conta:</strong> ID da conta de anúncios, nome da conta e moeda.</li>
                                <li><strong>Dados de Performance:</strong> Impressões, cliques, gastos, alcance, conversões e outras métricas agregadas de suas campanhas publicitárias.</li>
                                <li><strong>Informações de Autenticação:</strong> Tokens de acesso fornecidos pelo Facebook Login para autorizar as requisições em seu nome.</li>
                            </ul>
                            <p className="mt-2">Não coletamos senhas do Facebook nem dados pessoais sensíveis dos seus clientes finais.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">3. Como Usamos Seus Dados</h2>
                            <p>Utilizamos as informações coletadas exclusivamente para:</p>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li>Exibir dashboards de performance e relatórios financeiros.</li>
                                <li>Calcular métricas agregadas (CPM, CTR, Custo por Resultado).</li>
                                <li>Gerenciar o acesso à sua conta no nosso sistema (login e sessão).</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">4. Compartilhamento de Dados</h2>
                            <p>
                                <strong>Não vendemos, trocamos ou transferimos</strong> suas informações pessoais ou dados de anúncios para terceiros. 
                                Os dados são processados em tempo real e armazenados temporariamente no seu navegador ou em cache seguro para performance, 
                                sem criação de banco de dados histórico permanente de seus anúncios em nossos servidores.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">5. Cookies e Armazenamento Local</h2>
                            <p>
                                Utilizamos cookies apenas para manter sua sessão de login ativa e verificar o status da sua assinatura (período de teste ou ativo). 
                                Você pode limpar esses cookies a qualquer momento através das configurações do seu navegador.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">6. Exclusão de Dados</h2>
                            <p>
                                De acordo com as regras da Meta, você tem o direito de solicitar a exclusão dos seus dados. 
                                Como nosso sistema funciona como um "leitor" em tempo real da API da Meta, você pode revogar o acesso 
                                do ADS Relator a qualquer momento através das <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noreferrer" className="text-blue-600 underline">Configurações de Integrações Comerciais do Facebook</a>. 
                                Ao fazer isso, nosso sistema perderá imediatamente o acesso aos seus dados.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">7. Contato</h2>
                            <p>
                                Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco pelo e-mail: suporte@adsrelator.com
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
