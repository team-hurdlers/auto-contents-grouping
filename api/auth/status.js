export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 세션에서 토큰 확인
        const isAuthenticated = req.session?.tokens?.access_token ? true : false;
        
        res.json({
            authenticated: isAuthenticated,
            user: isAuthenticated ? req.session.user : null
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Status check failed' });
    }
}
