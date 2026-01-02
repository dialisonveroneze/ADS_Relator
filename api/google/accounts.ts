
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
        // Passo 1: Listagem básica de IDs (mais estável)
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             // 403 ou erros de token de teste
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ RESTRIÇÃO DE TESTE: Seu token do Google Ads é de "Acesso de Teste". Ele só permite visualizar "Contas de Teste". Se você logou com uma conta que tem anúncios reais, o Google bloqueia o acesso. Sugestão: Crie um Gerenciador de Teste no painel do Google Ads.'
                 });
             }
             return res.status(500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Buscar detalhes com proteção total contra 501 (Not Implemented)
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            try {
                // Tentamos buscar o nome. Se der 501, o catch resolve.
                const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer WHERE customer.id = '${customerId}'`;
                
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                        // NÃO usamos login-customer-id aqui, pois causa 501 em contas individuais
                    },
                    body: JSON.stringify({ query })
                });

                const data = await response.json();
                
                // Se retornar erro da API (como o 501 que você está vendo)
                if (data.error) {
                    throw new Error(data.error.message);
                }

                if (data.results && data.results[0]) {
                    const c = data.results[0].customer;
                    accounts.push({
                        id: c.id,
                        name: c.descriptiveName || `Conta ${c.id}`,
                        balance: 0,
                        spendingLimit: 0,
                        amountSpent: 0,
                        currency: c.currencyCode || 'BRL',
                        provider: 'google'
                    });
                } else {
                    throw new Error("Vazio");
                }
            } catch (e) {
                // FALLBACK CRÍTICO: Se o Google disser "Not Implemented" ou qualquer erro,
                // apenas adicionamos a conta com o ID, permitindo que o usuário prossiga.
                accounts.push({
                    id: customerId,
                    name: `ID: ${customerId} (Dados Limitados)`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: 'BRL',
                    provider: 'google'
                });
            }
        };

        // Processa em paralelo mas com limite
        await Promise.all(resourceNames.slice(0, 15).map((rn: string) => fetchAccountDetails(rn)));

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        
        if (uniqueAccounts.length === 0 && resourceNames.length > 0) {
            resourceNames.forEach((rn: string) => {
                const id = rn.split('/')[1];
                uniqueAccounts.push({ id, name: `Conta ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            });
        }

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Erro ao processar contas do Google Ads.' });
    }
}
