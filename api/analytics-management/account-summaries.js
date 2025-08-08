const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 임시로 간단한 응답 반환 (세션 관리 구현 필요)
        res.json({
            success: true,
            accountSummaries: [],
            message: "Account summaries endpoint working - session management needed"
        });
    } catch (error) {
        console.error('Account summaries error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch account summaries' 
        });
    }
}
