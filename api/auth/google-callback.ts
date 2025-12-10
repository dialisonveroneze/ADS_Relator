
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code } = req.query;
    
    // Environment Variables - In production these must be set in Vercel
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!code || typeof code !== 'string') {
        return res.status(400).send('Código de autorização inválido.');
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        // Return 500 but log specifically for debugging
        console.error("Missing Google Env Vars");
        return res.status(500).send('Configuração do servidor incompleta (Missing Google Credentials).');
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
            console.error('Google Auth Error:', tokenData);
            return res.status(400).send('Falha ao autenticar com Google.');
        }

        // Store tokens
        const cookiesToSet = [];
        
        cookiesToSet.push(cookie.serialize('google_access_token', tokenData.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: tokenData.expires_in,
            path: '/',
            sameSite: 'lax',
        }));

        // Google only sends refresh token on first consent. 
        // We should check if it exists and store it.
        if (tokenData.refresh_token) {
            cookiesToSet.push(cookie.serialize('google_refresh_token', tokenData.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: 60 * 60 * 24 * 365, // 1 year
                path: '/',
                sameSite: 'lax',
            }));
        }

        res.setHeader('Set-Cookie', cookiesToSet);
        res.redirect(302, '/');

    } catch (error) {
        console.error("Internal Auth Error:", error);
        res.status(500).send('Erro interno no callback do Google.');
    }
}
