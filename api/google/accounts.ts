
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
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    if (!accessToken) {
        return res.status(401).json({ message: 'Conecte-se ao Google Ads novamente.' });
    }
    
    if (!developerToken) {
         return res.status(500).json({ 
             message: 'Falta o GOOGLE_DEVELOPER_TOKEN. Obtenha-o no Google Ads > Ferramentas > Configuração > Centro de API.' 
         });
    }

    try {
        // Busca a lista de IDs de clientes acessíveis
        const response = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const data = await response.json();
        
        if (data.error) {
             return res.status(response.status).json({ 
                 message: data.error.message || 'Erro na API do Google Ads.' 
             });
        }

        const resourceNames = data.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Buscamos detalhes de todas as contas (removido o limite de 15)
        // Usamos Promise.all para buscar em paralelo e ser muito mais rápido
        const accountPromises = resourceNames.map(async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            try {
                const queryResponse = await fetch(`https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        query: "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1" 
                    })
                });
                
                const queryData = await queryResponse.json();
                if (queryData.results && queryData.results.length > 0) {
                    const c = queryData.results[0].customer;
                    return {
                        id: c.id,
                        name: c.descriptiveName || `Conta ${c.id}`,
                        balance: 0,
                        spendingLimit: 0,
                        amountSpent: 0,
                        currency: c.currencyCode,
                        provider: 'google' as const
                    };
                }
            } catch (e) {
                console.error(`Erro ao buscar conta ${customerId}:`, e);
            }
            return null;
        });

        const resolvedAccounts = await Promise.all(accountPromises);
        const filteredAccounts = resolvedAccounts.filter(acc => acc !== null) as AdAccount[];

        res.status(200).json(filteredAccounts);

    } catch (error) {
        console.error("Google API Error:", error);
        res.status(500).json({ message: 'Erro ao processar contas do Google Ads.' });
    }
}
