const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');
const fs = require('fs');

class GAService {
    constructor() {
        this.client = null;
        this.initializeClient();
    }

    initializeClient(session = null) {
        try {
            // OAuth 토큰이 있는 경우 (우선순위)
            if (session && session.tokens) {
                const { OAuth2Client } = require('google-auth-library');
                const oauth2Client = new OAuth2Client();
                oauth2Client.setCredentials(session.tokens);
                
                this.client = new BetaAnalyticsDataClient({
                    authClient: oauth2Client
                });
                return;
            }
            
            // Service Account 방식 (대체)
            let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            
            // In Vercel, credentials might be in environment variable as JSON string
            if (process.env.GOOGLE_CREDENTIALS_JSON) {
                const tempPath = '/tmp/service-account.json';
                fs.writeFileSync(tempPath, process.env.GOOGLE_CREDENTIALS_JSON);
                credentialsPath = tempPath;
            } else if (!credentialsPath) {
                // Check for uploaded credentials
                const configPath = path.join(__dirname, '..', 'config', 'service-account.json');
                if (fs.existsSync(configPath)) {
                    credentialsPath = configPath;
                }
            }

            if (credentialsPath) {
                this.client = new BetaAnalyticsDataClient({
                    keyFilename: credentialsPath
                });
            }
        } catch (error) {
            console.error('Error initializing GA client:', error);
        }
    }

    async listProperties(session = null) {
        console.log('listProperties called with session:', !!session);
        
        try {
            // OAuth 토큰이 있는 경우에만 Admin API 사용
            if (session && session.tokens) {
                const { google } = require('googleapis');
                const { OAuth2Client } = require('google-auth-library');
                
                const oauth2Client = new OAuth2Client();
                oauth2Client.setCredentials(session.tokens);
                
                const analyticsAdmin = google.analyticsadmin({
                    version: 'v1beta',
                    auth: oauth2Client
                });
                
                // accountSummaries를 사용하여 모든 계정과 속성 가져오기
                const summariesResponse = await analyticsAdmin.accountSummaries.list({
                    pageSize: 200
                });
                
                const accountSummaries = summariesResponse.data.accountSummaries || [];
                const allProperties = [];
                
                for (const accountSummary of accountSummaries) {
                    const propertySummaries = accountSummary.propertySummaries || [];
                    
                    for (const propSummary of propertySummaries) {
                        allProperties.push({
                            id: propSummary.property?.split('/').pop() || 'unknown',
                            displayName: `${propSummary.displayName} (${accountSummary.displayName})`,
                            propertyType: propSummary.propertyType || 'GA4',
                            accountName: accountSummary.displayName
                        });
                    }
                }
                
                console.log('Returning Admin API properties:', allProperties.length);
                return allProperties;
            }
            
            // OAuth 세션이 없으면 빈 배열 반환 (수동 입력 유도)
            console.log('No valid session found');
            return [];
            
        } catch (error) {
            console.error('Error in listProperties:', error);
            // 에러 발생시에도 기본 속성 반환
            return [{
                id: 'manual-input',
                displayName: '속성 ID를 직접 입력하세요 (API 오류)',
                propertyType: 'MANUAL'
            }];
        }
    }

    async fetchAnalyticsData({ propertyId, startDate, endDate }, session = null) {
        console.log('fetchAnalyticsData called with:', { propertyId, startDate, endDate });
        
        // 세션이 있으면 클라이언트 재초기화
        if (session && session.tokens) {
            this.initializeClient(session);
        }
        
        if (!this.client) {
            // 클라이언트 재초기화 시도
            this.initializeClient();
            if (!this.client) {
                throw new Error('구글 로그인이 필요합니다. 다시 로그인해주세요.');
            }
        }

        try {
            // 속성 ID 정규화 (숫자만 추출)
            let normalizedPropertyId = propertyId;
            
            // G-로 시작하면 오류
            if (propertyId.startsWith('G-')) {
                throw new Error('G-로 시작하는 것은 Measurement ID입니다. Property ID(숫자)를 사용해주세요.');
            }
            
            // properties/ 제거
            if (propertyId.includes('properties/')) {
                normalizedPropertyId = propertyId.replace('properties/', '');
            }
            
            // 숫자만 추출
            normalizedPropertyId = normalizedPropertyId.replace(/\D/g, '');
            
            console.log('Normalized property ID:', normalizedPropertyId);
            
            const [response] = await this.client.runReport({
                property: `properties/${normalizedPropertyId}`,
                dateRanges: [
                    {
                        startDate: startDate,
                        endDate: endDate,
                    },
                ],
                dimensions: [
                    { name: 'pagePath' },
                    { name: 'pageTitle' }
                ],
                metrics: [
                    { name: 'screenPageViews' }
                ],
                limit: 10000,
                orderBys: [
                    {
                        metric: {
                            metricName: 'screenPageViews'
                        },
                        desc: true
                    }
                ]
            });

            console.log('GA4 response received, rows:', response.rows?.length || 0);

            // Format the response
            const formattedData = [];
            if (response.rows) {
                for (const row of response.rows) {
                    formattedData.push({
                        pagePath: row.dimensionValues[0].value,
                        pageTitle: row.dimensionValues[1].value,
                        pageviews: parseInt(row.metricValues[0].value)
                    });
                }
            }

            return formattedData;
        } catch (error) {
            console.error('Error fetching analytics data:', error);
            
            // 더 자세한 오류 정보 제공
            if (error.message.includes('UNAUTHENTICATED')) {
                throw new Error('GA4 인증 실패. Service Account 권한을 확인해주세요.');
            } else if (error.message.includes('PERMISSION_DENIED')) {
                throw new Error('GA4 접근 권한이 없습니다. 속성 ID와 권한을 확인해주세요.');
            } else if (error.message.includes('NOT_FOUND')) {
                throw new Error('GA4 속성을 찾을 수 없습니다. 속성 ID를 확인해주세요.');
            }
            
            throw error;
        }
    }

    async testConnection() {
        try {
            if (!this.client) {
                return { connected: false, error: 'Client not initialized' };
            }

            const propertyId = process.env.GA4_PROPERTY_ID;
            if (!propertyId) {
                return { connected: false, error: 'GA4_PROPERTY_ID not configured' };
            }

            // Try a simple query
            const [response] = await this.client.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                dimensions: [{ name: 'date' }],
                metrics: [{ name: 'activeUsers' }],
                limit: 1
            });

            return { connected: true, propertyId };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
}

module.exports = new GAService();