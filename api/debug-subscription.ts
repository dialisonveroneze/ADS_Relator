
// api/debug-subscription.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (action === 'expire') {
        // Força o trial a ter começado há 30 dias (Expirado) e remove status de pago
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 30);

        res.setHeader('Set-Cookie', [
            cookie.serialize('trial_start', pastDate.toISOString(), {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: 60 * 60 * 24 * 365,
                path: '/',
                sameSite: 'lax',
            }),
            cookie.serialize('subscription_active', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: -1, // Deleta o cookie de pago
                path: '/',
                sameSite: 'lax',
            })
        ]);
        return res.status(200).json({ message: 'Assinatura expirada para testes.' });
    }

    if (action === 'reset') {
        // Limpa tudo (Novo Usuário)
        res.setHeader('Set-Cookie', [
            cookie.serialize('trial_start', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: -1,
                path: '/',
                sameSite: 'lax',
            }),
            cookie.serialize('subscription_active', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: -1,
                path: '/',
                sameSite: 'lax',
            })
        ]);
        return res.status(200).json({ message: 'Assinatura resetada.' });
    }

    return res.status(400).json({ message: 'Ação inválida.' });
}
