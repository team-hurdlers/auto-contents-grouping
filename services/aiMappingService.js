const fs = require('fs').promises;
const path = require('path');

class AIMappingService {
    constructor() {
        this.mappingCachePath = process.env.NODE_ENV === 'production' 
            ? '/tmp/url-mapping.json'
            : path.join(__dirname, '..', 'config', 'url-mapping.json');
        this.aiClient = null;
        this.aiType = null;
        // Initialize AI synchronously in constructor
        this.initializeAI();
    }

    initializeAI() {
        // Initialize Claude AI
        if (process.env.ANTHROPIC_API_KEY) {
            console.log('[AI Service] Initializing Claude AI...');
            try {
                const Anthropic = require('@anthropic-ai/sdk');
                this.aiClient = new Anthropic({
                    apiKey: process.env.ANTHROPIC_API_KEY,
                });
                this.aiType = 'claude';
                console.log('[AI Service] ✅ Claude AI initialized successfully');
            } catch (error) {
                console.error('[AI Service] ❌ Failed to initialize Claude:', error.message);
            }
        } else {
            console.log('[AI Service] ⚠️ ANTHROPIC_API_KEY not found in environment variables');
        }
    }

    async loadMappingCache() {
        try {
            const data = await fs.readFile(this.mappingCachePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Return default structure if file doesn't exist
            return {
                mappings: {},
                userOverrides: {},
                lastUpdated: new Date().toISOString()
            };
        }
    }

    async saveMappingCache(cache) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.mappingCachePath);
            await fs.mkdir(dir, { recursive: true });
            
            cache.lastUpdated = new Date().toISOString();
            await fs.writeFile(this.mappingCachePath, JSON.stringify(cache, null, 2));
        } catch (error) {
            console.error('Error saving mapping cache:', error);
        }
    }

    async translateWithAI(paths, websiteContext = '') {
        if (!this.aiClient) {
            console.warn('AI client not initialized, returning original paths');
            return paths.reduce((acc, path) => {
                acc[path] = path;
                return acc;
            }, {});
        }

        console.log(`[번역 요청] 총 ${paths.length}개 경로`);
        const translations = {};
        
        // Process in batches of 50 to reduce API calls
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < paths.length; i += batchSize) {
            batches.push(paths.slice(i, i + batchSize));
        }
        
        console.log(`[배치 생성] ${batches.length}개 배치로 나눔 (배치당 최대 ${batchSize}개)`);
        
        let completedBatches = 0;
        
        // Process all batches in parallel for speed
        const batchPromises = batches.map(async (batch, index) => {
            // Build prompt
            const prompt = `웹사이트 URL 경로를 한국어로 번역해주세요.

중요 규칙:
1. 영어 단어를 한국어로 번역하되, 자연스럽게 처리
2. 간단한 예시:
   - hotel → 호텔
   - casino → 카지노
   - reservation → 예약
   - dining → 다이닝
   - login → 로그인
   - member → 회원

3. 외래어나 전문용어는 발음대로 한글로 (예: cimer → 씨메르, front → 프론트)
4. 복합 단어는 자연스럽게 분리 (예: artSpace → 예술공간)
5. 모든 경로를 빠짐없이 포함

번역할 경로:
${batch.map(p => `"${p}"`).join(', ')}

JSON 형식으로 응답 (모든 경로 포함 필수):
예: {"contents": "콘텐츠", "artSpace": "예술공간"}`;

            try {
                console.log(`[배치 ${index + 1}/${batches.length}] API 호출 중... (${batch.length}개 항목)`);
                
                const message = await this.aiClient.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 2000,
                    temperature: 0.2,
                    messages: [{ role: 'user', content: prompt }]
                });
                
                const content = message.content[0].text;
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const batchTranslations = JSON.parse(jsonMatch[0]);
                    completedBatches++;
                    console.log(`[배치 ${index + 1}/${batches.length}] ✅ 완료! (${Object.keys(batchTranslations).length}개 번역됨) - 진행률: ${Math.round((completedBatches/batches.length)*100)}%`);
                    return batchTranslations;
                }
            } catch (error) {
                completedBatches++;
                console.error(`[배치 ${index + 1}/${batches.length}] ❌ 오류 발생: ${error.message} - 기본 번역 사용`);
                // Return basic translations as fallback
                const fallback = {};
                batch.forEach(path => {
                    fallback[path] = this.basicTranslation(path);
                });
                return fallback;
            }
        });
        
        // Wait for all batches to complete
        console.log('\n⏳ 모든 배치 처리 대기 중...\n');
        const results = await Promise.all(batchPromises);
        
        // Merge all results
        results.forEach(result => {
            if (result) {
                Object.assign(translations, result);
            }
        });
        
        console.log(`\n✅ [번역 완료] 총 ${Object.keys(translations).length}개 항목 번역 완료!\n`);

        return translations;
    }

    basicTranslation(path) {
        // Basic English to Korean mapping
        const basicMappings = {
            'home': '홈',
            'about': '소개',
            'products': '제품',
            'product': '제품',
            'services': '서비스',
            'service': '서비스',
            'contact': '연락처',
            'blog': '블로그',
            'news': '뉴스',
            'support': '지원',
            'help': '도움말',
            'login': '로그인',
            'signup': '가입',
            'register': '등록',
            'account': '계정',
            'profile': '프로필',
            'settings': '설정',
            'search': '검색',
            'cart': '장바구니',
            'checkout': '결제',
            'category': '카테고리',
            'detail': '상세',
            'list': '목록',
            'gallery': '갤러리',
            'download': '다운로드',
            'upload': '업로드',
            'edit': '수정',
            'delete': '삭제',
            'create': '생성',
            'new': '신규',
            'dining': '다이닝',
            'hotel': '호텔',
            'resort': '리조트',
            'casino': '카지노',
            'shopping': '쇼핑'
        };

        const lowerPath = path.toLowerCase();
        return basicMappings[lowerPath] || path;
    }

    async getMappings(paths, options = {}) {
        const { useCache = true, websiteContext = '' } = options;
        const cache = await this.loadMappingCache();
        const newPaths = [];
        const results = {};

        console.log(`[캐시 확인] 총 ${paths.length}개 경로 확인 중...`);
        
        // Check cache first
        let cachedCount = 0;
        for (const path of paths) {
            if (useCache) {
                // Check user overrides first
                if (cache.userOverrides[path]) {
                    results[path] = cache.userOverrides[path];
                    cachedCount++;
                } else if (cache.mappings[path]) {
                    results[path] = cache.mappings[path];
                    cachedCount++;
                } else {
                    newPaths.push(path);
                }
            } else {
                newPaths.push(path);
            }
        }

        console.log(`[캐시 결과] ${cachedCount}개 캐시됨, ${newPaths.length}개 새로 번역 필요`);

        // Translate new paths
        if (newPaths.length > 0) {
            console.log(`[번역 시작] ${newPaths.length}개 경로 AI 번역 중...`);
            const translations = await this.translateWithAI(newPaths, websiteContext);
            
            // Update cache and results
            Object.assign(cache.mappings, translations);
            Object.assign(results, translations);
            
            await this.saveMappingCache(cache);
            console.log('[캐시 저장] 번역 결과 캐시에 저장 완료');
        } else {
            console.log('[번역 불필요] 모든 경로가 캐시에 있음');
        }

        return results;
    }

    async updateMapping(path, koreanValue) {
        const cache = await this.loadMappingCache();
        cache.userOverrides[path] = koreanValue;
        await this.saveMappingCache(cache);
    }

    async getAllMappings() {
        return await this.loadMappingCache();
    }

    async clearCache() {
        const emptyCache = {
            mappings: {},
            userOverrides: {},
            lastUpdated: new Date().toISOString()
        };
        await this.saveMappingCache(emptyCache);
        return emptyCache;
    }
}

module.exports = new AIMappingService();