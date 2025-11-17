// api/accounts.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';
import { AdAccount } from '../types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const accessToken = cookies.meta_token;

    if (!accessToken) {
        return res.status(401).json({ message: 'Não autorizado: Token não encontrado.' });
    }

    try {
        const fields = 'id,name,balance,spend_cap,amount_spent,currency';
        const url = `https://graph.facebook.com/v19.0/me/adaccounts?fields=${fields}&access_token=${accessToken}`;
        
        const metaResponse = await fetch(url);
        const data = await metaResponse.json();

        if (data.error) {
            console.error("Erro da API da Meta:", data.error);
            // Se o token for inválido, a Meta retorna um erro.
            if (data.error.code === 190) {
                 return res.status(401).json({ message: 'Token de acesso inválido ou expirado.' });
            }
            return res.status(500).json({ message: data.error.message || 'Erro ao buscar dados da Meta.' });
        }
        
        // Formata os dados da Meta para o tipo que nosso frontend espera.
        const formattedAccounts: AdAccount[] = data.data.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            balance: parseFloat(acc.balance) / 100, // A API retorna o saldo em centavos
            spendingLimit: parseFloat(acc.spend_cap) / 100, // Limite também em centavos
            amountSpent: parseFloat(acc.amount_spent) / 100, // Gasto também em centavos
            currency: acc.currency,
        }));

        res.status(200).json(formattedAccounts);

    } catch (error) {
        console.error("Erro interno ao buscar contas:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
}
