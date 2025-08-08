const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

class AnalyticsAdminServiceV2 {
    constructor() {
        this.oauth2Client = null;
    }

    // 세션에서 토큰을 사용하여 클라이언트 초기화
    initializeFromSession(session) {
        if (!session || !session.tokens) {
            throw new Error('유효한 세션 토큰이 없습니다.');
        }

        this.oauth2Client = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        this.oauth2Client.setCredentials(session.tokens);

        console.log('✅ Google Analytics Admin Service V2 초기화 완료');
    }

    // 직접 API 호출 헬퍼
    async makeApiCall(url) {
        const response = await this.oauth2Client.request({
            url: url,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        return response.data;
    }

    // GA4 계정 목록 가져오기 (페이지네이션 포함)
    async getAccounts() {
        try {
            console.log('📊 GA4 계정 목록 조회 중...');
            
            let allAccounts = [];
            let pageToken = null;
            let pageCount = 0;
            
            do {
                // pageSize를 200으로 늘리고, showDeleted 파라미터 추가
                const url = pageToken 
                    ? `https://analyticsadmin.googleapis.com/v1beta/accounts?pageSize=200&pageToken=${pageToken}`
                    : 'https://analyticsadmin.googleapis.com/v1beta/accounts?pageSize=200';
                
                console.log(`🔍 API 호출: ${url}`);
                const response = await this.makeApiCall(url);
                const accounts = response.accounts || [];
                
                allAccounts = allAccounts.concat(accounts);
                
                // 응답 자세히 로깅
                console.log(`📊 페이지 ${pageCount + 1}: ${accounts.length}개 계정 로드 (총 ${allAccounts.length}개)`);
                console.log(`📄 응답에 nextPageToken 있음?: ${response.nextPageToken ? 'YES' : 'NO'}`);
                if (response.nextPageToken) {
                    console.log(`📄 nextPageToken 값: ${response.nextPageToken}`);
                }
                
                pageToken = response.nextPageToken;
                pageCount++;
                
            } while (pageToken);
            
            console.log(`✅ 총 ${allAccounts.length}개 GA4 계정 발견`);
            
            return allAccounts.map(account => ({
                name: account.name,
                displayName: account.displayName,
                regionCode: account.regionCode,
                createTime: account.createTime,
                updateTime: account.updateTime
            }));

        } catch (error) {
            console.error('❌ GA4 계정 목록 조회 실패:', error.message);
            
            // 에러 상세 정보 출력
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            
            throw new Error(`GA4 계정 목록을 가져올 수 없습니다: ${error.message}`);
        }
    }

    // 특정 계정의 속성 목록 가져오기 (페이지네이션 포함)
    async getProperties(accountName) {
        try {
            console.log(`📊 계정 ${accountName}의 속성 목록 조회 중...`);
            
            let allProperties = [];
            let pageToken = null;
            let pageCount = 0;
            
            // 먼저 모든 속성을 가져오는 API 시도 (filter 파라미터 사용)
            do {
                // filter를 사용해서 특정 계정의 속성만 가져오기
                const filter = `parent:${accountName}`;
                const url = pageToken
                    ? `https://analyticsadmin.googleapis.com/v1beta/properties?filter=${encodeURIComponent(filter)}&pageSize=200&pageToken=${pageToken}`
                    : `https://analyticsadmin.googleapis.com/v1beta/properties?filter=${encodeURIComponent(filter)}&pageSize=200`;
                
                console.log(`🔍 속성 API 호출: ${url}`);
                const response = await this.makeApiCall(url);
                const properties = response.properties || [];
                
                allProperties = allProperties.concat(properties);
                
                console.log(`📊 페이지 ${pageCount + 1}: ${properties.length}개 속성 로드 (총 ${allProperties.length}개)`);
                console.log(`📄 응답에 nextPageToken 있음?: ${response.nextPageToken ? 'YES' : 'NO'}`);
                
                pageToken = response.nextPageToken;
                pageCount++;
                
            } while (pageToken);
            
            console.log(`✅ 총 ${allProperties.length}개 속성 발견`);
            
            return allProperties.map(property => ({
                name: property.name,
                displayName: property.displayName,
                propertyType: property.propertyType,
                timeZone: property.timeZone,
                currencyCode: property.currencyCode,
                industryCategory: property.industryCategory,
                createTime: property.createTime,
                updateTime: property.updateTime,
                parent: property.parent,
                account: accountName
            }));

        } catch (error) {
            console.error('❌ 속성 목록 조회 실패:', error.message);
            
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            
            throw new Error(`속성 목록을 가져올 수 없습니다: ${error.message}`);
        }
    }

    // 특정 속성의 데이터 스트림 목록 가져오기
    async getDataStreams(propertyName) {
        try {
            console.log(`📊 속성 ${propertyName}의 데이터 스트림 목록 조회 중...`);
            
            // propertyName 형식: properties/123456789
            const url = `https://analyticsadmin.googleapis.com/v1beta/${propertyName}/dataStreams`;
            const response = await this.makeApiCall(url);
            
            const dataStreams = response.dataStreams || [];
            
            console.log(`✅ ${dataStreams.length}개 데이터 스트림 발견`);
            
            return dataStreams.map(stream => ({
                name: stream.name,
                displayName: stream.displayName,
                type: stream.type,
                createTime: stream.createTime,
                updateTime: stream.updateTime,
                webStreamData: stream.webStreamData ? {
                    measurementId: stream.webStreamData.measurementId,
                    firebaseAppId: stream.webStreamData.firebaseAppId,
                    defaultUri: stream.webStreamData.defaultUri
                } : null,
                androidAppStreamData: stream.androidAppStreamData ? {
                    firebaseAppId: stream.androidAppStreamData.firebaseAppId,
                    packageName: stream.androidAppStreamData.packageName
                } : null,
                iosAppStreamData: stream.iosAppStreamData ? {
                    firebaseAppId: stream.iosAppStreamData.firebaseAppId,
                    bundleId: stream.iosAppStreamData.bundleId
                } : null
            }));

        } catch (error) {
            console.error('❌ 데이터 스트림 목록 조회 실패:', error.message);
            
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            
            throw new Error(`데이터 스트림 목록을 가져올 수 없습니다: ${error.message}`);
        }
    }

    // 모든 계정과 속성 목록 한 번에 가져오기 (대안 방법)
    async getAllAccountsAndProperties() {
        try {
            console.log('📊 계정 및 속성 목록 조회 시작...');
            
            // 1. 먼저 계정 목록 가져오기
            const accounts = await this.getAccounts();
            
            if (accounts.length === 0) {
                return { accounts: [], properties: [] };
            }
            
            // 2. 각 계정의 속성 가져오기
            const allProperties = [];
            for (const account of accounts) {
                try {
                    const properties = await this.getProperties(account.name);
                    properties.forEach(prop => {
                        prop.accountDisplayName = account.displayName;
                        prop.accountName = account.name;
                    });
                    allProperties.push(...properties);
                } catch (propError) {
                    console.warn(`계정 ${account.displayName}의 속성 조회 실패:`, propError.message);
                }
            }
            
            console.log(`✅ 총 ${accounts.length}개 계정, ${allProperties.length}개 속성 발견`);
            
            return {
                accounts: accounts,
                properties: allProperties
            };
            
        } catch (error) {
            console.error('❌ 계정 및 속성 목록 조회 실패:', error);
            throw error;
        }
    }
}

module.exports = AnalyticsAdminServiceV2;