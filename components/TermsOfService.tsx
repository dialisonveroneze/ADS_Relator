
import React from 'react';

const TermsOfService: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden">
                <div className="px-6 py-8">
                     <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Termos de Serviço</h1>
                        <a href="/" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Voltar ao Início</a>
                    </div>

                    <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 space-y-6">
                        <p className="text-sm text-gray-500">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">1. Aceitação dos Termos</h2>
                            <p>
                                Ao acessar e utilizar o <strong>ADS Relator</strong>, você aceita e concorda em estar vinculado aos termos e disposições deste acordo. 
                                Se você não concordar com estes termos, não deverá utilizar nosso serviço.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">2. Descrição do Serviço</h2>
                            <p>
                                O ADS Relator é uma ferramenta SaaS (Software as a Service) que fornece visualização de dados, relatórios e dashboards 
                                para contas de anúncios do Meta Ads (Facebook e Instagram). O serviço depende da disponibilidade e funcionalidade da API da Meta.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">3. Assinatura e Pagamentos</h2>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li><strong>Período de Teste:</strong> Oferecemos 15 dias de acesso gratuito para novos usuários.</li>
                                <li><strong>Pagamento:</strong> Após o período de teste, o acesso requer uma assinatura paga (mensal).</li>
                                <li><strong>Cancelamento:</strong> Você pode cancelar sua assinatura a qualquer momento, interrompendo as cobranças futuras.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">4. Uso Aceitável</h2>
                            <p>Você concorda em não usar o serviço para:</p>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li>Violar quaisquer leis locais, estaduais ou nacionais.</li>
                                <li>Tentar realizar engenharia reversa ou acessar indevidamente o código fonte da aplicação.</li>
                                <li>Compartilhar sua conta com terceiros não autorizados.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">5. Limitação de Responsabilidade</h2>
                            <p>
                                O ADS Relator fornece os dados "como estão", obtidos diretamente da Meta. Não nos responsabilizamos por:
                            </p>
                            <ul className="list-disc pl-5 space-y-1 mt-2">
                                <li>Discrepâncias de dados causadas por atrasos na API da Meta.</li>
                                <li>Interrupções de serviço causadas por falhas na plataforma da Meta.</li>
                                <li>Perdas financeiras decorrentes de decisões de investimento em anúncios baseadas em nossos relatórios.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">6. Alterações nos Termos</h2>
                            <p>
                                Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação no site. 
                                O uso continuado do serviço após as alterações constitui aceitação dos novos termos.
                            </p>
                        </section>

                         <section>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">7. Contato</h2>
                            <p>
                                Para questões sobre estes termos, entre em contato pelo e-mail: suporte@adsrelator.com
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
