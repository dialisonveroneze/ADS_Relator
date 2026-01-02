
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export interface AdAccount {
  id: string;
  name: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  currency: string;
  provider: 'google';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.google_access_token;
    const developerToken = (process.env.GOOGLE_DEVELOPER_TOKEN || '').trim();

    if (!accessToken) {
        return res.status(401).json({ message: 'Sessão expirada. Conecte-se ao Google Ads novamente.' });
    }
    
    if (!developerToken) {
         return res.status(500).json({ 
             message: '⚠️ CONFIGURAÇÃO PENDENTE: Falta a variável GOOGLE_DEVELOPER_TOKEN na Vercel.' 
         });
    }

    try {
        // Passo 1: Listar as contas que o usuário autenticado tem acesso direto
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ ERRO DE PERMISSÃO: Seu Developer Token está em modo "Acesso de Teste". No Google Ads, tokens de teste SÓ funcionam com "Contas de Teste" (Test Accounts). Se você logou com um e-mail que tem contas reais, a API vai recusar. Sugestão: Crie um Gerenciador de Teste em ads.google.com/home/tools/manager-accounts.'
                 });
             }
             return res.status(500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Para cada conta acessível, vamos verificar se ela tem subcontas (se for MCC)
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            // Primeiro, pegamos os dados básicos da conta em si
            const basicQuery = `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer WHERE customer.id = '${customerId}'`;
            
            try {
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                        // Omitimos login-customer-id aqui para evitar erros de "operação não suportada" em contas não-MCC
                    },
                    body: JSON.stringify({ query: basicQuery })
                });

                const data = await response.json();
                if (data.results && data.results[0]) {
                    const c = data.results[0].customer;
                    
                    // Adicionamos a conta atual
                    if (!c.manager) {
                        accounts.push({
                            id: c.id,
                            name: c.descriptiveName || `Conta ${c.id}`,
                            balance: 0,
                            spendingLimit: 0,
                            amountSpent: 0,
                            currency: c.currencyCode,
                            provider: 'google'
                        });
                    } else {
                        // Se for Gerenciador (MCC), tentamos buscar as subcontas
                        const subQuery = `
                            SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.status 
                            FROM customer_client 
                            WHERE customer_client.status = 'ENABLED' AND customer_client.manager = false
                        `;
                        const subResponse = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'developer-token': developerToken,
                                'Content-Type': 'application/json',
                                'login-customer-id': customerId
                            },
                            body: JSON.stringify({ query: subQuery })
                        });
                        const subData = await subResponse.json();
                        if (subData.results) {
                            subData.results.forEach((row: any) => {
                                const sc = row.customerClient;
                                accounts.push({
                                    id: sc.id,
                                    name: sc.descriptiveName || `Conta ${sc.id}`,
                                    balance: 0,
                                    spendingLimit: 0,
                                    amountSpent: 0,
                                    currency: sc.currencyCode,
                                    provider: 'google'
                                });
                            });
                        }
                    }
                } else {
                    // Fallback se a busca falhar: adiciona a conta básica
                    accounts.push({ id: customerId, name: `Conta ${customerId}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
                }
            } catch (e) {
                console.error(`Erro ao processar conta ${customerId}:`, e);
                // Mesmo com erro, tentamos manter a conta na lista
                accounts.push({ id: customerId, name: `Conta ${customerId}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            }
        };

        // Processa as contas em pequenos blocos para não estourar rate limit
        for (const rn of resourceNames.slice(0, 15)) {
            await fetchAccountDetails(rn);
        }

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Erro interno ao processar contas.' });
    }
}
