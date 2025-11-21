
// api/payment-success.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // O Mercado Pago retorna vários parâmetros na URL de sucesso, como:
    // collection_id, collection_status, payment_id, status, external_reference, etc.
    const { status, collection_status, mock } = req.query;

    // Função auxiliar para ativar a assinatura via cookie
    const activateSubscription = () => {
        res.setHeader('Set-Cookie', cookie.serialize('subscription_active', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60 * 24 * 30, // 30 dias
            path: '/',
            sameSite: 'lax',
        }));
    };

    // Verifica se o status é 'approved' (padrão MP) ou se é um mock
    const isApproved = status === 'approved' || collection_status === 'approved' || mock === 'true';

    if (isApproved) {
        activateSubscription();
        // Redireciona para a home limpa
        return res.redirect(302, '/');
    } else {
        // Se chegou aqui mas não está aprovado ou cancelou
        console.warn("Pagamento não aprovado ou cancelado:", req.query);
        return res.redirect(302, '/?error=payment_failed');
    }
}
