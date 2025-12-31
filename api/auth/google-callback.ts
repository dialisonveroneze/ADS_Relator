
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code } = req.query;
    
    // Fallback para o Client ID se não estiver nas env vars, pois ele é público no frontend
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '880633493696-3m5f7ks5rk534tomks1fmihir6qqph3a.apps.googleusercontent.com';
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!code || typeof code !== 'string') {
        return res.status(400).send('Código de autorização inválido ou ausente na URL.');
    }

    if (!GOOGLE_CLIENT_SECRET) {
        console.error("ERRO: Variável GOOGLE_CLIENT_SECRET não configurada no servidor.");
        return res.status(500).send(`
            <h1>Configuração Incompleta</h1>
            <p>A variável <strong>GOOGLE_CLIENT_SECRET</strong> não foi encontrada nas configurações do servidor.</p>
            <p>Por favor, adicione as credenciais do Google Cloud nas variáveis de ambiente da Vercel.</p>
            <hr>
            <small>ID usado: ${GOOGLE_CLIENT_ID}</small>
        `);
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/auth/google-callback`;

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }).toString(),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('Google Auth Error Response:', tokenData);
            return res.status(400).send(`
                <h1>Erro na Autenticação do Google</h1>
                <p>O Google retornou um erro ao tentar trocar o código pelo token.</p>
                <pre>${JSON.stringify(tokenData, null, 2)}</pre>
                <p>Verifique se o <strong>Client Secret</strong> está correto e se a <strong>Redirect URI</strong> no Google Cloud é exatamente: <br><code>${redirectUri}</code></p>
            `);
        }

        // Armazena os tokens em cookies
        const cookiesToSet = [];
        
        cookiesToSet.push(cookie.serialize('google_access_token', tokenData.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: tokenData.expires_in,
            path: '/',
            sameSite: 'lax',
        }));

        if (tokenData.refresh_token) {
            cookiesToSet.push(cookie.serialize('google_refresh_token', tokenData.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: 60 * 60 * 24 * 365, // 1 ano
                path: '/',
                sameSite: 'lax',
            }));
        }

        res.setHeader('Set-Cookie', cookiesToSet);
        res.redirect(302, '/');

    } catch (error) {
        console.error("Internal Auth Error:", error);
        res.status(500).send('Erro interno crítico no processamento do login do Google.');
    }
}
