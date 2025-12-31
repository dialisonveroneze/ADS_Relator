
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
             message: 'O GOOGLE_DEVELOPER_TOKEN não foi configurado na Vercel. Obtenha-o no painel do Google Ads > Ferramentas > Centro de API.' 
         });
    }

    try {
        // 1. Busca IDs de clientes acessíveis
        // Google Ads API v18 é a estável atual
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const msg = listData.error.message || 'Erro ao listar clientes do Google.';
             const status = listResponse.status === 403 ? 403 : 500;
             return res.status(status).json({ 
                 message: listResponse.status === 403 
                    ? `Acesso negado. Verifique se o seu Developer Token foi aprovado ou se tem as permissões corretas. Detalhe: ${msg}` 
                    : msg 
             });
        }

        const resourceNames = listData.resourceNames || [];
        if (resourceNames.length === 0) {
            return res.status(200).json([]);
        }

        const accounts: AdAccount[] = [];

        // 2. Busca detalhes de cada conta. 
        // Se houver muitas contas, fazemos um fetch mais inteligente.
        const fetchSubAccounts = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            // Query para pegar contas que não são administradoras (contas de entrega)
            const query = `
                SELECT 
                    customer_client.id, 
                    customer_client.descriptive_name, 
                    customer_client.currency_code, 
                    customer_client.manager,
                    customer_client.status
                FROM customer_client
                WHERE customer_client.status = 'ENABLED' 
                AND customer_client.level <= 1
            `;

            try {
                const searchResponse = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query })
                });
                
                const searchData = await searchResponse.json();
                
                if (searchData.results) {
                    searchData.results.forEach((row: any) => {
                        const client = row.customerClient;
                        // Adiciona apenas se não for manager (para focar em contas de anúncios)
                        // ou se o usuário quiser ver a estrutura completa, mas aqui focamos em performance
                        if (!client.manager) {
                            accounts.push({
                                id: client.id,
                                name: client.descriptiveName || `Conta ${client.id}`,
                                balance: 0,
                                spendingLimit: 0,
                                amountSpent: 0,
                                currency: client.currencyCode,
                                provider: 'google'
                            });
                        }
                    });
                } else if (searchData.error) {
                    console.warn(`Erro parcial ao buscar detalhes do cliente ${customerId}:`, searchData.error.message);
                }
            } catch (e) {
                console.error(`Falha de rede ao consultar cliente ${customerId}`);
            }
        };

        // Limita a concorrência para evitar problemas de timeout na Vercel (limite de 10s em planos hobby)
        // Processamos os primeiros 5 recursos raiz (geralmente é apenas 1 ou 2 MCCs)
        await Promise.all(resourceNames.slice(0, 10).map((rn: string) => fetchSubAccounts(rn)));

        // Se após varrer os managers não achamos nada, tentamos adicionar a conta raiz diretamente
        if (accounts.length === 0) {
            for (const rn of resourceNames) {
                const id = rn.split('/')[1];
                accounts.push({
                    id: id,
                    name: `Conta ${id}`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: 'BRL',
                    provider: 'google'
                });
            }
        }

        // Remove duplicatas
        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        console.error("Critical Google Accounts API Error:", error);
        res.status(500).json({ message: error.message || 'Erro interno ao processar contas do Google Ads.' });
    }
}
