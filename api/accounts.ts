// api/accounts.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

// Definindo interface localmente para evitar erro de importação no ambiente serverless
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
    const accessToken = cookies.meta_token;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token não encontrado.' });
    }

    try {
        const fields = 'id,name,balance,spend_cap,amount_spent,currency,prepay_balance,funding_source_details';
        let allAccounts: any[] = [];
        let url = `https://graph.facebook.com/v19.0/me/adaccounts?fields=${fields}&limit=100&access_token=${accessToken}`;

        // Loop de paginação para buscar todas as contas
        while (url) {
            const metaResponse = await fetch(url);
            const data = await metaResponse.json();

            if (data.error) {
                console.error("Erro da API da Meta:", data.error);
                if (data.error.code === 190) {
                     return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
                }
                return res.status(500).json({ message: data.error.message || 'Erro ao buscar dados da Meta.' });
            }

            allAccounts = allAccounts.concat(data.data);
            
            // Verifica se existe uma próxima página
            url = data.paging && data.paging.next ? data.paging.next : null;
        }
        
        // Formata os dados da Meta para o tipo que nosso frontend espera.
        const formattedAccounts: AdAccount[] = allAccounts.map((acc: any) => {
            const amountSpent = parseFloat(acc.amount_spent || '0') / 100;
            const spendingLimit = parseFloat(acc.spend_cap || '0') / 100;
            let finalBalance: number;

            // Contas pré-pagas (geralmente identificadas por prepay_balance ou tipo de fonte de pagamento)
            const isPrepaid = acc.funding_source_details?.type === 'PREPAID' || (acc.prepay_balance && acc.prepay_balance.amount);

            if (isPrepaid) {
                // Para contas pré-pagas, o valor já vem na unidade monetária principal.
                finalBalance = parseFloat(acc.prepay_balance.amount);
            } else {
                // Para contas pós-pagas, o "saldo" mais útil é o limite restante.
                // Se o limite for 0 (ilimitado), mostramos a dívida atual (balance) como um número negativo.
                if (spendingLimit > 0) {
                    finalBalance = spendingLimit - amountSpent;
                } else {
                    finalBalance = -(parseFloat(acc.balance || '0') / 100);
                }
            }

            return {
                id: acc.id,
                name: acc.name,
                balance: finalBalance,
                spendingLimit: spendingLimit, 
                amountSpent: amountSpent,
                currency: acc.currency,
            };
        });

        res.status(200).json(formattedAccounts);

    } catch (error) {
        console.error("Erro interno ao buscar contas:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}