const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://auto-contents-grouping-lkfg.vercel.app/api/auth/callback'
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code } = req.query;
        
        if (!code) {
            return res.status(400).json({ error: 'Authorization code not provided' });
        }

        // Exchange code for tokens
        const { tokens } = await client.getToken(code);
        
        // Store tokens in session (simplified for Vercel)
        // In production, you'd want to use a proper session store
        
        // Redirect to success page
        res.redirect('/?auth=success');
        
    } catch (error) {
        console.error('Callback error:', error);
        res.redirect('/?auth=error');
    }
}
