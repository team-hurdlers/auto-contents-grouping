class URLParser {
    parseUrl(urlPath) {
        // First, clean jsessionid and similar patterns from the path
        // This is JUST for parsing depths correctly, not for AI decision
        let cleanPath = urlPath
            .replace(/;jsessionid=[^?\/]*/gi, '')  // Remove ;jsessionid=XXX
            .replace(/;sessionid=[^?\/]*/gi, '')   // Remove ;sessionid=XXX
            .replace(/;sid=[^?\/]*/gi, '');        // Remove ;sid=XXX
        
        // Remove query parameters if present
        cleanPath = cleanPath.split('?')[0];
        
        // Remove trailing slash
        const normalizedPath = cleanPath.replace(/\/$/, '');
        
        // Split by slash and filter empty strings
        const parts = normalizedPath.split('/').filter(part => part !== '');
        
        // Extract depth levels (최대 10개까지)
        const result = {
            fullPath: urlPath,
            cleanPath: normalizedPath || '/',
            depth1: parts[0] || null,
            depth2: parts[1] || null,
            depth3: parts[2] || null,
            depth4: parts[3] || null,
            depth5: parts[4] || null,
            depth6: parts[5] || null,
            depth7: parts[6] || null,
            depth8: parts[7] || null,
            depth9: parts[8] || null,
            depth10: parts[9] || null,
            depthCount: parts.length
        };

        // Add all depth values dynamically for easier access
        result.depths = {};
        for (let i = 0; i < Math.min(parts.length, 10); i++) {
            result.depths[`depth${i + 1}`] = parts[i];
        }

        // Add path segments for easier processing
        result.segments = parts;
        
        // Detect common patterns
        result.isHome = normalizedPath === '' || normalizedPath === '/';
        result.hasQueryParams = urlPath.includes('?');
        
        return result;
    }

    extractQueryParams(urlPath) {
        const queryIndex = urlPath.indexOf('?');
        if (queryIndex === -1) return {};
        
        const queryString = urlPath.substring(queryIndex + 1);
        const params = {};
        
        queryString.split('&').forEach(param => {
            const [key, value] = param.split('=');
            if (key) {
                params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
            }
        });
        
        return params;
    }

    categorizeUrl(urlPath) {
        const lowerPath = urlPath.toLowerCase();
        
        // Common URL patterns
        const patterns = [
            { regex: /^\/$|^\/home|^\/index/, category: 'Home' },
            { regex: /\/blog\/|\/post\/|\/article\//, category: 'Blog' },
            { regex: /\/product\/|\/shop\/|\/item\//, category: 'Product' },
            { regex: /\/about|\/company|\/team/, category: 'About' },
            { regex: /\/contact|\/support|\/help/, category: 'Support' },
            { regex: /\/category\/|\/collection\//, category: 'Category' },
            { regex: /\/search/, category: 'Search' },
            { regex: /\/cart|\/checkout|\/payment/, category: 'Checkout' },
            { regex: /\/account|\/profile|\/settings/, category: 'Account' },
            { regex: /\/login|\/signup|\/register/, category: 'Auth' },
            { regex: /\/api\//, category: 'API' },
            { regex: /\/admin\//, category: 'Admin' },
            { regex: /\.(jpg|jpeg|png|gif|svg|ico|webp)$/i, category: 'Image' },
            { regex: /\.(js|css|json|xml|txt)$/i, category: 'Resource' },
            { regex: /\/404|\/error/, category: 'Error' }
        ];

        for (const pattern of patterns) {
            if (pattern.regex.test(lowerPath)) {
                return pattern.category;
            }
        }

        // Default categorization based on depth
        const parsed = this.parseUrl(urlPath);
        if (parsed.depthCount === 0) return 'Home';
        if (parsed.depthCount === 1) return 'Main Section';
        if (parsed.depthCount === 2) return 'Sub Section';
        return 'Detail Page';
    }

    groupUrlsByPath(urls) {
        const grouped = {};
        
        urls.forEach(url => {
            if (!this.isValidUrl(url)) return;
            
            const parsed = this.parseUrl(url);
            const key = this.generatePathPattern(parsed);
            
            if (!grouped[key]) {
                grouped[key] = {
                    pattern: key,
                    urls: [],
                    count: 0,
                    category: this.categorizeUrl(url),
                    depth: parsed.depthCount
                };
            }
            
            grouped[key].urls.push(url);
            grouped[key].count++;
        });
        
        return grouped;
    }

    generatePathPattern(parsed) {
        const segments = parsed.segments;
        let pattern = '/';
        
        if (segments.length === 0) return '/';
        
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            
            // 숫자나 ID로 보이는 패턴을 {id}로 대체
            if (this.isIdPattern(segment)) {
                pattern += '{id}';
            } else {
                pattern += segment;
            }
            
            if (i < segments.length - 1) {
                pattern += '/';
            }
        }
        
        return pattern;
    }

    isIdPattern(segment) {
        // 숫자만 있는 경우
        if (/^\d+$/.test(segment)) return true;
        
        // UUID 패턴
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
        
        // 긴 알파벳+숫자 조합 (32자 이상)
        if (segment.length >= 32 && /^[a-zA-Z0-9]+$/.test(segment)) return true;
        
        return false;
    }

    filterPersonalizedUrls(urls) {
        const personalizedPatterns = [
            // 세션 ID 패턴들
            /;jsessionid=[A-Za-z0-9._-]+/i,
            /;phpsessid=[A-Za-z0-9]+/i,
            /;aspsessionid[A-Za-z0-9]+=[A-Za-z0-9]+/i,
            /;sid=[A-Za-z0-9]+/i,
            /;session=[A-Za-z0-9]+/i,
            
            // 거래/주문 ID 패턴
            /\/order\/[A-Za-z0-9-]+/,
            /\/invoice\/[A-Za-z0-9-]+/,
            /\/receipt\/[A-Za-z0-9-]+/,
            /\/transaction\/[A-Za-z0-9-]+/,
            /\/booking\/[A-Za-z0-9-]+/,
            /\/reservation\/[A-Za-z0-9-]+/,
            /orderId=[A-Za-z0-9-]+/,
            /transactionId=[A-Za-z0-9-]+/,
            /bookingId=[A-Za-z0-9-]+/,
            /reservationId=[A-Za-z0-9-]+/,
            /confirmationNumber=[A-Za-z0-9-]+/,
            
            // 결제 완료 페이지
            /\/payment\/complete/,
            /\/payment\/success/,
            /\/payment\/failed?/,
            /\/checkout\/complete/,
            /\/checkout\/success/,
            /\/confirmation/,
            /\/thank-you/,
            /\/order-complete/,
            /\/purchase-complete/,
            
            // 사용자 특정 페이지
            /\/profile\/[^\/]+/,
            /\/user\/[^\/]+/,
            /\/account\/[^\/]+/,
            /\/member\/[^\/]+/,
            /\/customer\/[^\/]+/,
            /\/mypage/,
            /\/my-account/,
            /\/dashboard/,
            /\/settings/,
            /\/preferences/,
            
            // 인증 관련
            /\/logout/,
            /\/signout/,
            /\/unsubscribe/,
            /\/reset-password/,
            /\/verify-email/,
            /\/activate/,
            /\/confirm-email/,
            
            // 쿼리 파라미터 형태의 세션/토큰
            /[?&]sessionId=[^&]+/,
            /[?&]session=[^&]+/,
            /[?&]token=[^&]+/,
            /[?&]auth=[^&]+/,
            /[?&]sid=[^&]+/,
            /[?&]userId=[^&]+/,
            /[?&]customerId=[^&]+/,
            /[?&]memberId=[^&]+/,
            
            // 추적 파라미터 (마케팅)
            /[?&]utm_[^&]+/,
            /[?&]fbclid=[^&]+/,
            /[?&]gclid=[^&]+/,
            /[?&]msclkid=[^&]+/,
            
            // 임시 또는 일회성 URL
            /\/temp\//,
            /\/tmp\//,
            /\/cache\//,
            /\.pdf$/,
            /download\//,
            
            // 장바구니/위시리스트 (개인화된 상태)
            /\/cart/,
            /\/wishlist/,
            /\/favorites/
        ];
        
        return urls.filter(url => {
            return !personalizedPatterns.some(pattern => pattern.test(url));
        });
    }

    removeDuplicateUrls(urls) {
        const normalized = new Map();
        
        urls.forEach(url => {
            const normalizedUrl = this.normalizeUrl(url);
            const queryParams = this.extractQueryParams(url);
            
            // 추적 파라미터 제거
            const cleanParams = this.removeTrackingParams(queryParams);
            
            let key = normalizedUrl;
            if (Object.keys(cleanParams).length > 0) {
                const sortedParams = Object.keys(cleanParams).sort().map(k => `${k}=${cleanParams[k]}`).join('&');
                key = `${normalizedUrl}?${sortedParams}`;
            }
            
            if (!normalized.has(key)) {
                normalized.set(key, url);
            }
        });
        
        return Array.from(normalized.values());
    }

    removeTrackingParams(params) {
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
            'fbclid', 'gclid', 'msclkid', '_ga', '_gid', 'source',
            'ref', 'referer', 'referrer', 'campaign', 'medium'
        ];
        
        const cleaned = {};
        Object.keys(params).forEach(key => {
            if (!trackingParams.includes(key.toLowerCase())) {
                cleaned[key] = params[key];
            }
        });
        
        return cleaned;
    }

    async groupUrlsWithAI(urls, websiteContext = '') {
        const aiService = require('./aiMappingService');
        
        // Always use manual grouping first, even without AI
        const processManualGrouping = () => {
            const urlGroups = new Map();
            const standaloneUrls = [];
            let sessionCount = 0;
            
            urls.forEach(url => {
                // Extract session info
                const sessionInfo = this.extractSessionInfo(url);
                
                if (sessionInfo.hasSession) {
                    sessionCount++;
                    // Group by clean URL
                    const cleanUrl = sessionInfo.cleanUrl;
                    if (!urlGroups.has(cleanUrl)) {
                        urlGroups.set(cleanUrl, {
                            representative: cleanUrl,
                            members: [],
                            reason: `${sessionInfo.sessionType}가 포함된 동일 페이지`
                        });
                    }
                    urlGroups.get(cleanUrl).members.push(url);
                } else {
                    // Check if this is a clean version of an existing group
                    let foundGroup = false;
                    for (const [cleanUrl, group] of urlGroups.entries()) {
                        if (url === cleanUrl) {
                            foundGroup = true;
                            break;
                        }
                    }
                    if (!foundGroup) {
                        standaloneUrls.push(url);
                    }
                }
            });
            
            console.log(`\n[세션 감지] jsessionid를 가진 URL: ${sessionCount}개`);
            console.log(`[그룹화 결과] ${urlGroups.size}개 그룹 생성`);
            
            // Convert map to array
            const groups = Array.from(urlGroups.values()).filter(group => group.members.length > 0);
            
            console.log(`\n[그룹 상세]`);
            groups.slice(0, 5).forEach((group, idx) => {
                console.log(`그룹 ${idx + 1}: ${group.representative} (${group.members.length}개 URL)`);
            });
            
            return { groups, standalone: standaloneUrls };
        };
        
        // Use the manual grouping function first
        const manualResult = processManualGrouping();
        let { groups, standalone: standaloneUrls } = manualResult;
        
        console.log(`\n[수동 그룹화 완료]`);
        console.log(`- 그룹: ${groups.length}개`);
        console.log(`- 개별 URL: ${standaloneUrls.length}개`);
        console.log(`- 총합: ${groups.length + standaloneUrls.length}개`);
        
        // TEMPORARY: AI 분석 비활성화해서 테스트
        if (!aiService.aiClient || true) { // 임시로 AI 비활성화
            console.log('🔧 [임시] AI 분석 비활성화 - 세션ID 그룹화만 적용');
            return processManualGrouping();
        }
        
        // Add representative URLs that weren't already in standalone
        groups.forEach(group => {
            if (!standaloneUrls.includes(group.representative)) {
                // Check if the representative URL exists in the original list
                if (!urls.includes(group.representative)) {
                    // If not, keep at least one member as representative
                    if (group.members.length > 0) {
                        const firstMember = group.members[0];
                        group.members = group.members.slice(1);
                        if (group.members.length === 0) {
                            // If only one member, add to standalone
                            standaloneUrls.push(firstMember);
                        } else {
                            // Use first member as representative
                            group.representative = this.cleanSessionIds(firstMember);
                        }
                    }
                }
            }
        });
        
        // Process all URLs with AI, but in manageable chunks
        // Don't artificially limit to 100 URLs - that's what caused the data loss!
        console.log(`\n[AI 추가 분석] ${standaloneUrls.length}개 개별 URL에 대해 추가 패턴 검색...`);
        
        // For very large numbers, analyze in batches but don't limit too aggressively
        let urlsToAnalyze = standaloneUrls;
        if (standaloneUrls.length > 1000) {
            // Take a more comprehensive sample that represents the entire dataset
            const sampleSize = 500; // Increased from 300
            const step = Math.floor(standaloneUrls.length / sampleSize);
            urlsToAnalyze = [];
            for (let i = 0; i < standaloneUrls.length; i += step) {
                urlsToAnalyze.push(standaloneUrls[i]);
                if (urlsToAnalyze.length >= sampleSize) break;
            }
            console.log(`[샘플링] 전체 ${standaloneUrls.length}개 URL 중 ${urlsToAnalyze.length}개를 대표 샘플로 선택`);
        }

        const prompt = `아래 URL 리스트에서 개인화 변수가 포함된 URL들만 찾아서 그룹화해주세요.

**개인화 변수란:**
1. 예약/주문/거래 번호: reservation123, order456, booking789
2. 사용자 ID: userID=john, member=12345
3. 세션/토큰: sessionid=abc, token=xyz
4. 임시 식별자: temp123, cache456

**그룹화 기준:**
- 기본 경로는 같고 개인화 변수만 다른 경우
- 예: /reservation/12345와 /reservation/67890 → /reservation/{id}
- 예: /order?id=123과 /order?id=456 → /order?id={id}

**중요한 주의사항:**
- 실제 다른 페이지들은 절대 그룹화하지 마세요
- 개인화 변수가 확실하지 않으면 그룹화하지 마세요
- 동일 패턴이 최소 2개 이상 있을 때만 그룹화하세요

URL 목록:
${urlsToAnalyze.map(url => `"${url}"`).join('\n')}
${standaloneUrls.length > urlsToAnalyze.length ? `
주의: 이것은 전체 ${standaloneUrls.length}개 URL 중 대표 샘플입니다.
불확실한 패턴은 그룹화하지 마세요.` : ''}

${websiteContext ? `웹사이트 컨텍스트: ${websiteContext}` : ''}

응답은 JSON 형식으로:
{
  "groups": [
    {
      "representative": "패턴화된 URL",
      "members": ["실제 URL들"],
      "reason": "그룹화 이유"
    }
  ],
  "standalone": ["그룹화되지 않은 URL들"]
}`;

        try {
            let aiResponse;
            
            if (aiService.aiType === 'claude') {
                const message = await aiService.aiClient.messages.create({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 4000,
                    temperature: 0.1,
                    messages: [{ role: 'user', content: prompt }]
                });
                
                const content = message.content[0].text;
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    aiResponse = JSON.parse(jsonMatch[0]);
                }
            }
            
            // Merge AI results with session-based grouping
            if (aiResponse && aiResponse.groups) {
                console.log(`[AI 그룹화 추가] ${aiResponse.groups.length}개 추가 그룹 발견`);
                groups.push(...aiResponse.groups);
            }
            
            if (aiResponse && aiResponse.standalone) {
                // CRITICAL FIX: Don't replace all standalone URLs with AI's result
                // Only replace the ones we actually sent to AI for analysis
                let finalStandalone = [];
                
                if (standaloneUrls.length <= urlsToAnalyze.length) {
                    // We analyzed all URLs, use AI's result
                    finalStandalone = aiResponse.standalone;
                    console.log(`[AI 분석 완료] 모든 URL 분석됨: ${finalStandalone.length}개 최종 개별 URL`);
                } else {
                    // We only analyzed a sample, so we need to be more careful
                    const analyzedUrls = new Set(urlsToAnalyze);
                    const notAnalyzed = standaloneUrls.filter(url => !analyzedUrls.has(url));
                    
                    // Combine AI's standalone result with URLs we didn't analyze
                    finalStandalone = [...(aiResponse.standalone || []), ...notAnalyzed];
                    console.log(`[AI 샘플 분석] 샘플 결과 ${aiResponse.standalone?.length || 0}개 + 미분석 ${notAnalyzed.length}개 = 총 ${finalStandalone.length}개`);
                }
                
                return {
                    groups: groups,
                    standalone: finalStandalone
                };
            }
        } catch (error) {
            console.error('AI additional grouping error:', error);
        }

        // Return session-based grouping results
        return {
            groups: groups,
            standalone: standaloneUrls
        };
    }

    classifyUrlsRuleBased(urls) {
        const classifications = {};
        
        urls.forEach(url => {
            // 세션 ID 패턴들 (대소문자 구분 없이)
            const sessionPatterns = [
                /;jsessionid=[A-Za-z0-9._-]+/i,
                /;phpsessid=[A-Za-z0-9]+/i,
                /;aspsessionid[A-Za-z0-9]+=[A-Za-z0-9]+/i,
                /;sid=[A-Za-z0-9]+/i,
                /;session=[A-Za-z0-9]+/i
            ];
            
            // 거래/주문 ID 패턴
            const transactionPatterns = [
                /\/order\/[A-Za-z0-9-]+/,
                /\/invoice\/[A-Za-z0-9-]+/,
                /\/receipt\/[A-Za-z0-9-]+/,
                /\/transaction\/[A-Za-z0-9-]+/,
                /\/booking\/[A-Za-z0-9-]+/,
                /\/reservation\/[A-Za-z0-9-]+/,
                /[?&]orderId=[^&]+/,
                /[?&]transactionId=[^&]+/,
                /[?&]bookingId=[^&]+/,
                /[?&]reservationId=[^&]+/,
                /[?&]confirmationNumber=[^&]+/
            ];
            
            // 결제/완료 페이지 패턴
            const completionPatterns = [
                /\/payment\/(complete|success|failed?)/,
                /\/checkout\/(complete|success)/,
                /\/order[_-]?complete/,
                /\/purchase[_-]?complete/,
                /\/confirmation/,
                /\/thank[_-]?you/,
                /\/success$/
            ];
            
            // 사용자 특정 페이지
            const userSpecificPatterns = [
                /\/(profile|user|account|member|customer)\/[^\/]+/,
                /\/(mypage|my[_-]account|dashboard|settings|preferences)/,
                /[?&](userId|customerId|memberId)=[^&]+/
            ];
            
            // 인증 관련
            const authPatterns = [
                /\/(logout|signout|unsubscribe)/,
                /\/(reset[_-]password|verify[_-]email|activate|confirm[_-]email)/,
                /[?&](token|auth|sid)=[^&]+/
            ];
            
            // 모든 패턴 체크
            const isPersonalized = 
                sessionPatterns.some(p => p.test(url)) ||
                transactionPatterns.some(p => p.test(url)) ||
                completionPatterns.some(p => p.test(url.toLowerCase())) ||
                userSpecificPatterns.some(p => p.test(url.toLowerCase())) ||
                authPatterns.some(p => p.test(url.toLowerCase()));
            
            classifications[url] = isPersonalized ? 'personalized' : 'general';
        });
        
        return classifications;
    }

    async processUrlsWithAI(urls, options = {}) {
        const {
            websiteContext = ''
        } = options;
        
        let processedUrls = [...urls];
        
        // AI로 사용자별 변수 URL 그룹화 (세션, 사용자ID 등)
        console.log('[AI 분석] URL 그룹화 시작...');
        console.log(`총 ${processedUrls.length}개 URL 분석 중...`);
        
        // Debug: Show sample URLs
        console.log('\n=== 샘플 URL (처음 10개) ===');
        processedUrls.slice(0, 10).forEach((url, idx) => {
            console.log(`${idx + 1}. ${url}`);
        });
        
        const groupingResult = await this.groupUrlsWithAI(processedUrls, websiteContext);
        
        // Track removed URLs
        const removedUrls = [];
        const groupingDetails = [];
        
        if (groupingResult && groupingResult.groups && groupingResult.standalone) {
            processedUrls = [];
            
            // Add representative URLs from groups
            if (groupingResult.groups.length > 0) {
                console.log('\n=== 그룹화된 URL ===');
                groupingResult.groups.forEach((group, idx) => {
                    processedUrls.push(group.representative);
                    
                    // Track removed URLs from this group
                    group.members.forEach(member => {
                        removedUrls.push({
                            url: member,
                            representative: group.representative,
                            reason: group.reason
                        });
                    });
                    
                    // Store grouping details
                    groupingDetails.push({
                        representative: group.representative,
                        members: group.members,
                        reason: group.reason,
                        count: group.members.length
                    });
                    
                    console.log(`\n그룹 ${idx + 1}: ${group.members.length}개 → 1개`);
                    console.log(`  대표: ${group.representative}`);
                    console.log(`  이유: ${group.reason}`);
                    if (group.members.length <= 5) {
                        group.members.forEach(member => {
                            console.log(`    - ${member}`);
                        });
                    } else {
                        console.log(`    - ${group.members[0]}`);
                        console.log(`    - ${group.members[1]}`);
                        console.log(`    ... 외 ${group.members.length - 2}개`);
                    }
                });
            }
            
            // Add standalone URLs
            processedUrls.push(...groupingResult.standalone);
            
            console.log('\n=== 최종 결과 ===');
            console.log(`- 원본: ${urls.length}개`);
            console.log(`- 그룹 대표: ${groupingResult.groups.length}개`);
            console.log(`- 개별 URL: ${groupingResult.standalone.length}개`);
            console.log(`- 최종: ${processedUrls.length}개\n`);
        } else {
            console.log('[AI 분석] 그룹화 실패, 원본 유지');
        }
        
        // Return enhanced result with removed URLs info
        return {
            processedUrls,
            removedUrls,
            groupingDetails,
            originalCount: urls.length,
            processedCount: processedUrls.length,
            removedCount: removedUrls.length
        };
    }

    normalizeUrl(urlPath) {
        // Remove common file extensions
        let normalized = urlPath.replace(/\.(html|htm|php|asp|aspx|jsp)$/i, '');
        
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        
        // Remove index files
        normalized = normalized.replace(/\/index$/i, '');
        
        // Convert to lowercase for consistency
        normalized = normalized.toLowerCase();
        
        return normalized || '/';
    }

    cleanSessionIds(url) {
        // 세션 ID 제거 패턴들
        let cleaned = url;
        
        // ;jsessionid=xxx 형태 제거
        cleaned = cleaned.replace(/;jsessionid=[A-Za-z0-9._-]+/gi, '');
        cleaned = cleaned.replace(/;phpsessid=[A-Za-z0-9]+/gi, '');
        cleaned = cleaned.replace(/;aspsessionid[A-Za-z0-9]+=[A-Za-z0-9]+/gi, '');
        cleaned = cleaned.replace(/;sid=[A-Za-z0-9]+/gi, '');
        cleaned = cleaned.replace(/;session=[A-Za-z0-9]+/gi, '');
        
        // 쿼리 파라미터 형태의 세션 제거
        cleaned = cleaned.replace(/[?&]jsessionid=[^&]*/gi, '');
        cleaned = cleaned.replace(/[?&]phpsessid=[^&]*/gi, '');
        cleaned = cleaned.replace(/[?&]sessionid=[^&]*/gi, '');
        cleaned = cleaned.replace(/[?&]session=[^&]*/gi, '');
        cleaned = cleaned.replace(/[?&]sid=[^&]*/gi, '');
        
        // ? 또는 & 만 남은 경우 정리
        cleaned = cleaned.replace(/\?$/, '');
        cleaned = cleaned.replace(/\?&/, '?');
        cleaned = cleaned.replace(/&&+/g, '&');
        
        return cleaned;
    }

    extractSessionInfo(url) {
        const sessionInfo = {
            hasSession: false,
            sessionType: null,
            sessionId: null,
            cleanUrl: url
        };
        
        // jsessionid 체크
        const jsessionMatch = url.match(/;jsessionid=([A-Za-z0-9._-]+)/i);
        if (jsessionMatch) {
            sessionInfo.hasSession = true;
            sessionInfo.sessionType = 'jsessionid';
            sessionInfo.sessionId = jsessionMatch[1];
            sessionInfo.cleanUrl = this.cleanSessionIds(url);
            return sessionInfo;
        }
        
        // phpsessid 체크
        const phpsessMatch = url.match(/;phpsessid=([A-Za-z0-9]+)/i);
        if (phpsessMatch) {
            sessionInfo.hasSession = true;
            sessionInfo.sessionType = 'phpsessid';
            sessionInfo.sessionId = phpsessMatch[1];
            sessionInfo.cleanUrl = this.cleanSessionIds(url);
            return sessionInfo;
        }
        
        // 쿼리 파라미터 형태 체크
        const querySessionMatch = url.match(/[?&](jsessionid|phpsessid|sessionid|session|sid)=([^&]+)/i);
        if (querySessionMatch) {
            sessionInfo.hasSession = true;
            sessionInfo.sessionType = querySessionMatch[1];
            sessionInfo.sessionId = querySessionMatch[2];
            sessionInfo.cleanUrl = this.cleanSessionIds(url);
            return sessionInfo;
        }
        
        return sessionInfo;
    }

    isValidUrl(urlPath) {
        // Check if URL is valid for processing
        if (!urlPath) return false;
        
        // Exclude certain patterns
        const excludePatterns = [
            /^\/api\//,
            /^\/admin\//,
            /\.(jpg|jpeg|png|gif|svg|ico|webp|js|css|json|xml|txt|pdf|doc|docx|xls|xlsx)$/i,
            /^\/wp-/,  // WordPress system URLs
            /^\/_/,    // System URLs
            /^\/\./    // Hidden files
        ];
        
        for (const pattern of excludePatterns) {
            if (pattern.test(urlPath)) {
                return false;
            }
        }
        
        return true;
    }
}

module.exports = new URLParser();