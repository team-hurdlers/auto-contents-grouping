const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Analytics Admin API를 사용하여 계정과 속성 목록 가져오기
router.get('/accounts-properties', async (req, res) => {
    try {
        // OAuth 인증만 사용
        if (!req.session || !req.session.tokens) {
            return res.status(401).json({ 
                error: 'Google 계정으로 로그인해주세요.' 
            });
        }
        
        console.log('Session tokens:', {
            hasAccessToken: !!req.session.tokens.access_token,
            hasRefreshToken: !!req.session.tokens.refresh_token,
            scope: req.session.tokens.scope
        });
        
        const { OAuth2Client } = require('google-auth-library');
        const oauth2Client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'http://localhost:3000/api/auth/callback'
        );
        oauth2Client.setCredentials(req.session.tokens);

        // Analytics Admin API v1beta 사용 (더 안정적)
        const analyticsAdmin = google.analyticsadmin({
            version: 'v1beta',
            auth: oauth2Client
        });
        
        console.log('Auth client created, attempting to list accounts...');
        
        try {
            // accountSummaries 사용 (accounts.list 대신)
            const summariesResponse = await analyticsAdmin.accountSummaries.list({
                pageSize: 200
            });
            
            console.log('Account summaries response:', JSON.stringify(summariesResponse.data, null, 2));
            
            const accountSummaries = summariesResponse.data.accountSummaries || [];
            console.log(`Found ${accountSummaries.length} account summaries`);
            
            // 각 계정의 속성 목록 가져오기
            const accountsWithProperties = [];
            
            for (const accountSummary of accountSummaries) {
                try {
                    console.log(`Processing account summary:`, accountSummary);
                    
                    // accountSummary는 이미 account 정보와 property 정보를 모두 포함하고 있음
                    const propertySummaries = accountSummary.propertySummaries || [];
                    
                    accountsWithProperties.push({
                        accountId: accountSummary.account?.split('/').pop() || 'unknown',
                        accountName: accountSummary.displayName || 'Unknown Account',
                        properties: propertySummaries.map(propSummary => ({
                            propertyId: propSummary.property?.split('/').pop() || 'unknown',
                            displayName: propSummary.displayName || 'Unknown Property',
                            propertyType: propSummary.propertyType || 'GA4'
                        }))
                    });
                    
                    console.log(`Account ${accountSummary.displayName}: ${propertySummaries.length} properties`);
                } catch (propError) {
                    console.error(`Error processing account summary:`, propError.message);
                }
            }
            
            // 응답
            res.json({
                success: true,
                accounts: accountsWithProperties,
                totalAccounts: accountsWithProperties.length,
                totalProperties: accountsWithProperties.reduce((sum, acc) => sum + acc.properties.length, 0)
            });
            
        } catch (listError) {
            console.error('Admin API list error:', listError.message);
            console.error('Error details:', listError.response?.data || listError);
            
            // Admin API 실패시 fallback 플래그를 true로 설정하여 GAService 사용 유도
            res.json({
                success: false,
                error: 'GA4 Admin API 접근 권한이 없습니다. 대체 방법을 사용합니다.',
                accounts: [],
                totalAccounts: 0,
                totalProperties: 0,
                fallback: true // 이걸 true로 변경하여 프론트엔드에서 fallback 처리하도록
            });
        }
        
    } catch (error) {
        console.error('Error fetching accounts and properties:', error);
        res.status(500).json({ 
            error: error.message,
            details: 'GA4 Admin API 접근 권한이 필요합니다. Service Account에 "Google Analytics 관리자" 역할을 부여하거나, OAuth로 로그인하세요.'
        });
    }
});


module.exports = router;