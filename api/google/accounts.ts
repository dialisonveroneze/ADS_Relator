
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export interface AdAccount {
  id: string;
  name: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  currency: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.google_access_token;
    const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token Google não encontrado.' });
    }
    
    if (!developerToken) {
         return res.status(500).json({ message: 'Erro de configuração: Developer Token ausente.' });
    }

    try {
        // 1. Get accessible customers (Manager accounts or direct accounts)
        const listCustResponse = await fetch('https://googleads.googleapis.com/v14/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listCustResponse.json();
        
        if (listData.error) {
             throw listData.error;
        }

        const resourceNames = listData.resourceNames; // e.g., ["customers/1234567890"]
        const accounts: AdAccount[] = [];

        // 2. For each accessible customer, fetch details using GAQL
        // Note: In a real production app with many accounts, you'd iterate efficiently or use a manager account.
        // Limiting to first 5 for performance in this demo.
        for (const resourceName of resourceNames.slice(0, 5)) {
            const customerId = resourceName.split('/')[1];
            
            const query = `
                SELECT 
                    customer.id, 
                    customer.descriptive_name, 
                    customer.currency_code 
                FROM customer 
                LIMIT 1
            `;

            const queryResponse = await fetch(`https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:search`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'developer-token': developerToken,
                    'Content-Type': 'application/json',
                    // Note: 'login-customer-id' might be required if navigating hierarchy
                },
                body: JSON.stringify({ query })
            });
            
            const queryData = await queryResponse.json();
            
            if (queryData.results && queryData.results.length > 0) {
                const info = queryData.results[0].customer;
                
                // Get Spend for total balance simulation (Google doesn't have a "Balance" endpoint like Meta easily accessible)
                // We'll simulate balance as 0 or calculate from budget in a deeper implementation.
                accounts.push({
                    id: info.id,
                    name: info.descriptiveName || `Conta ${info.id}`,
                    balance: 0, // Google is usually post-pay threshold or invoice. Hard to map 1:1 to Meta's "Prepaid Balance" concept.
                    spendingLimit: 0, 
                    amountSpent: 0, // Would need a separate query for ALL time spend
                    currency: info.currencyCode
                });
            }
        }

        res.status(200).json(accounts);

    } catch (error: any) {
        console.error("Erro Google API:", error);
        res.status(500).json({ message: 'Erro ao buscar contas Google Ads.' });
    }
}
