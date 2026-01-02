
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
        // Passo 1: Listar as contas acessíveis (esta chamada é a mais básica e raramente falha)
        const listResponse = await fetch('https://googleads.googleapis.com/v18/customers:listAccessibleCustomers', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
            }
        });
        
        const listData = await listResponse.json();
        
        if (listData.error) {
             const errorMsg = listData.error.message || '';
             // Se falhar logo aqui, é problema de permissão do token
             if (listResponse.status === 403 || errorMsg.includes('developer_token') || errorMsg.includes('not_approved')) {
                 return res.status(403).json({
                     message: '⚠️ TOKEN DE TESTE: O Google Ads não permite que tokens de teste acessem contas reais. Você deve usar uma "Conta de Teste" do Google Ads ou aguardar a aprovação do seu token para "Acesso Básico".'
                 });
             }
             return res.status(500).json({ message: `Erro Google API: ${errorMsg}` });
        }

        const resourceNames = listData.resourceNames || [];
        const accounts: AdAccount[] = [];

        // Passo 2: Tentar buscar detalhes, mas com FALLBACK total para evitar erro 501
        const fetchAccountDetails = async (resourceName: string) => {
            const customerId = resourceName.split('/')[1];
            
            try {
                // Tentativa de pegar o nome real da conta
                const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer WHERE customer.id = '${customerId}'`;
                
                const response = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query })
                });

                const data = await response.json();
                
                // Se o Google der erro (como 501 Not Implemented), caímos no catch
                if (data.error) throw new Error(data.error.message);

                if (data.results && data.results[0]) {
                    const c = data.results[0].customer;
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
                    throw new Error("No results");
                }
            } catch (e) {
                // FALLBACK: Se qualquer coisa falhar (501, 403, etc), apenas adicionamos o ID básico
                // Isso garante que a lista de contas apareça mesmo com erros parciais da API
                accounts.push({
                    id: customerId,
                    name: `Conta ${customerId} (Dados Limitados)`,
                    balance: 0,
                    spendingLimit: 0,
                    amountSpent: 0,
                    currency: 'BRL',
                    provider: 'google'
                });
            }
        };

        // Processa as contas (limite de 20 para performance)
        await Promise.all(resourceNames.slice(0, 20).map((rn: string) => fetchAccountDetails(rn)));

        const uniqueAccounts = Array.from(new Map(accounts.map(item => [item.id, item])).values());
        
        if (uniqueAccounts.length === 0 && resourceNames.length > 0) {
            // Última instância de segurança: se nada deu certo mas temos IDs, mostramos os IDs
            resourceNames.forEach((rn: string) => {
                const id = rn.split('/')[1];
                uniqueAccounts.push({ id, name: `ID: ${id}`, balance: 0, spendingLimit: 0, amountSpent: 0, currency: 'BRL', provider: 'google' });
            });
        }

        res.status(200).json(uniqueAccounts);

    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Erro interno ao processar contas.' });
    }
}
