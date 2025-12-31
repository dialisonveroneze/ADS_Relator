
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
             message: 'Variável GOOGLE_DEVELOPER_TOKEN não configurada na Vercel.' 
         });
    }

    try {
        // Busca a lista de clientes que o token tem acesso direto
        const listResponse = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             return res.status(listResponse.status).json({ 
                 message: listData.error.message || 'Erro ao buscar contas acessíveis.' 
             });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Para cada conta de "entrada", buscamos se ela é um MCC e pegamos os filhos (subcontas)
        const fetchSubAccounts = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            // Esta query busca tanto a conta em si quanto as subcontas se for um manager
            const query = `
                SELECT 
                    customer_client.id, 
                    customer_client.descriptive_name, 
                    customer_client.currency_code, 
                    customer_client.manager,
                    customer_client.status
                FROM customer_client
                WHERE customer_client.status = 'ENABLED' 
                AND customer_client.manager = false
            `;

            try {
                const searchResponse = await fetch(`https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:search`, {
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
                        accounts.push({
                            id: client.id,
                            name: client.descriptiveName || `Conta ${client.id}`,
                            balance: 0,
                            spendingLimit: 0,
                            amountSpent: 0,
                            currency: client.currencyCode,
                            provider: 'google'
                        });
                    });
                } else if (searchData.error) {
                    console.error(`Erro na conta ${customerId}:`, searchData.error);
                }
            } catch (e) {
                console.error(`Erro de rede ao processar conta ${customerId}`);
            }
        };

        // Processa todas as contas raiz em paralelo para agilizar
        await Promise.all(resourceNames.map((rn: string) => fetchSubAccounts(rn)));

        // Remove duplicatas (caso uma conta apareça em múltiplos caminhos)
        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());

        res.status(200).json(uniqueAccounts);

    } catch (error) {
        console.error("Google Accounts API Error:", error);
        res.status(500).json({ message: 'Erro ao listar contas do Google Ads.' });
    }
}
