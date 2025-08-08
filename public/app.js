// Global variables
let currentData = [];
let originalData = []; // AI 처리 전 원본 데이터 보관
let selectedPropertyId = null;
let authToken = null;

// Analytics Admin Selection
let selectedAccount = null;
let selectedProperty = null;
let selectedDataStream = null;




// DOM Elements
const authSection = document.getElementById('authSection');
const propertySection = document.getElementById('propertySection');
const controlSection = document.getElementById('controlSection');
const progressSection = document.getElementById('progressSection');
const resultsSection = document.getElementById('resultsSection');
const mappingModal = document.getElementById('mappingModal');
const logoutBtn = document.getElementById('logoutBtn');

// 페이지 로드시 저장된 속성 복원
function restorePropertyFromSession() {
    const savedPropertyId = sessionStorage.getItem('selectedPropertyId');
    const savedProperty = sessionStorage.getItem('selectedProperty');
    
    if (savedPropertyId && savedProperty) {
        try {
            selectedPropertyId = savedPropertyId;
            selectedProperty = JSON.parse(savedProperty);
            console.log('세션에서 속성 복원:', selectedPropertyId);
        } catch (error) {
            sessionStorage.removeItem('selectedPropertyId');
            sessionStorage.removeItem('selectedProperty');
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    
    // 저장된 속성 복원
    restorePropertyFromSession();
    
    // Check if returning from OAuth first
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
        console.log('OAuth authentication successful!');
        showPropertySection();
        loadProperties();
        // Clean URL
        window.history.replaceState({}, document.title, '/');
    } else if (urlParams.get('auth') === 'error') {
        alert('인증에 실패했습니다. 다시 시도해주세요.');
        window.history.replaceState({}, document.title, '/');
    } else {
        // Only check auth status if not returning from OAuth
        checkAuthStatus();
    }
});

function initializeEventListeners() {
    // Auth
    document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleLogin);
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Property Selection
    document.getElementById('toggleManualInput').addEventListener('click', showManualInput);
    document.getElementById('useManualProperty').addEventListener('click', handleManualPropertyInput);
    document.getElementById('hideManualInput').addEventListener('click', hideManualInput);
    
    // GA4 스타일 UI - 분석 시작 버튼
    const proceedBtn = document.querySelector('#selectedPropertyDisplay #proceedToAnalysis');
    if (proceedBtn) {
        proceedBtn.addEventListener('click', () => {
            // 속성 선택 화면은 유지하고 데이터 수집 화면만 표시
            controlSection.style.display = 'block';
            controlSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // 속성 선택 영역을 간단한 요약 형태로 변경
            const selectedPropertyDisplay = document.getElementById('selectedPropertyDisplay');
            if (selectedPropertyDisplay) {
                selectedPropertyDisplay.innerHTML = `
                    <div class="selection-info">
                        <span class="selection-label">선택된 속성:</span>
                        <span id="selectedPropertyName" class="selection-value">${selectedPropertyDisplay.querySelector('.selection-value').textContent}</span>
                    </div>
                    <button type="button" onclick="location.reload()" class="btn btn-secondary btn-sm">
                        🔄 속성 변경
                    </button>
                `;
            }
        });
    }
    
    // Controls
    document.getElementById('datePreset').addEventListener('change', handleDatePresetChange);
    document.getElementById('fetchDataBtn').addEventListener('click', fetchAndProcessData);
    document.getElementById('clearCacheBtn').addEventListener('click', clearMappingCache);
    
    // AI Processing - 통합 버튼만 사용
    document.getElementById('aiProcessAllBtn')?.addEventListener('click', processAllWithAI);
    document.getElementById('applyClassification')?.addEventListener('click', applyAIClassification);
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Results
    document.getElementById('searchInput').addEventListener('input', filterTable);
    document.getElementById('exportExcelBtn').addEventListener('click', () => exportData('excel'));
    document.getElementById('exportCsvBtn').addEventListener('click', () => exportData('csv'));
    document.getElementById('exportSheetsBtn').addEventListener('click', () => exportData('sheets'));
    document.getElementById('copyDataBtn').addEventListener('click', copyDataToClipboard);
    
    // Modal
    document.getElementById('modalSave').addEventListener('click', saveMappingEdit);
    document.getElementById('modalCancel').addEventListener('click', closeMappingModal);
}

// Authentication
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        console.log('Auth status:', data);
        
        if (data.authenticated) {
            console.log('이미 로그인된 상태입니다.');
            showPropertySection();
            loadProperties();
            // Show logout button
            if (logoutBtn) {
                logoutBtn.style.display = 'block';
            }
        } else {
            console.log('로그인이 필요합니다.');
            // Hide property and other sections
            propertySection.style.display = 'none';
            controlSection.style.display = 'none';
            progressSection.style.display = 'none';
            resultsSection.style.display = 'none';
            authSection.style.display = 'block';
            if (logoutBtn) {
                logoutBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // On error, show auth section
        authSection.style.display = 'block';
        propertySection.style.display = 'none';
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
    }
}

function handleGoogleLogin() {
    console.log('Redirecting to Google OAuth...');
    window.location.href = '/api/auth/google';
}


// Property Management
function showPropertySection() {
    authSection.style.display = 'none';
    propertySection.style.display = 'block';
}

async function loadProperties() {
    // Analytics Admin API 사용
    await loadAnalyticsAdminData();
}

// 간단한 속성 ID 입력 UI 표시
function showSimplePropertyInput() {
    const accountLoadingMessage = document.getElementById('accountLoadingMessage');
    const propertyStep = document.getElementById('propertyStep');
    const propertyList = document.getElementById('propertyList');
    const propertyLoadingMessage = document.getElementById('propertyLoadingMessage');
    
    // 계정 선택 단계 숨기기
    accountLoadingMessage.style.display = 'none';
    document.getElementById('accountList').style.display = 'none';
    
    // 속성 입력 단계 표시
    propertyStep.style.display = 'block';
    propertyLoadingMessage.style.display = 'none';
    propertyList.style.display = 'block';
    
    propertyList.innerHTML = `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h4 style="margin-bottom: 15px;">📝 GA4 속성 ID 직접 입력</h4>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #ffc107;">
                <strong>⚠️ 중요: Property ID 입력 방법</strong><br>
                <div style="margin-top: 10px;">
                    ✅ <strong>올바른 형식:</strong> <span style="color: green;">123456789</span> (숫자만)<br>
                    ❌ <strong>틀린 형식:</strong> <span style="color: red;">G-XXXXXXXXX</span> (Measurement ID 아님!)
                </div>
                <div style="margin-top: 10px; background: white; padding: 10px; border-radius: 4px;">
                    <strong>Property ID 찾는 방법:</strong><br>
                    1. Google Analytics 접속 → 관리(⚙️) → 속성 설정<br>
                    2. "속성 ID" 확인 (숫자만 복사)<br>
                    3. 또는 URL에서: analytics.google.com/analytics/web/#/p<strong style="color: green;">123456789</strong>/reports
                </div>
            </div>
            <input type="text" 
                   id="propertyIdInput" 
                   placeholder="예: 123456789" 
                   class="select-input" 
                   style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 15px;"
                   onkeypress="if(event.key==='Enter') usePropertyId()">
            <button onclick="usePropertyId()" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 16px;">
                ✅ 이 속성 ID 사용하기
            </button>
        </div>
    `;
    
    // input에 포커스
    setTimeout(() => {
        document.getElementById('propertyIdInput')?.focus();
    }, 100);
}

// 속성 ID 사용
function usePropertyId() {
    const input = document.getElementById('propertyIdInput');
    const propertyId = input.value.trim();
    
    // 유효성 검사
    if (!propertyId) {
        alert('속성 ID를 입력해주세요.');
        return;
    }
    
    // 숫자만 있는지 확인
    if (!/^\d+$/.test(propertyId)) {
        alert('속성 ID는 숫자만 입력해야 합니다.\n(예: 123456789)\n\nMeasurement ID(G-XXXXXX)가 아닙니다!');
        return;
    }
    
    // 속성 정보 저장
    selectedPropertyId = propertyId;
    selectedProperty = {
        id: propertyId,
        displayName: `GA4 Property (${propertyId})`,
        name: `properties/${propertyId}`
    };
    
    console.log('속성 ID 입력됨:', propertyId);
    
    // 최종 선택 표시
    const finalSelection = document.getElementById('finalSelection');
    const selectionSummary = document.getElementById('selectionSummary');
    
    selectionSummary.innerHTML = `
        <div class="selection-summary">
            <div class="summary-row">
                <span class="summary-label">속성 ID:</span>
                <span class="summary-value">${propertyId}</span>
            </div>
        </div>
    `;
    
    finalSelection.style.display = 'block';
    
    // 다음 단계로
    const proceedBtn = document.getElementById('proceedToAnalysis');
    if (proceedBtn) {
        proceedBtn.onclick = () => {
            console.log('분석 시작 - 속성 ID:', propertyId);
            propertySection.style.display = 'none';
            controlSection.style.display = 'block';
            
            // 선택된 속성 표시
            const selectedPropertyNameEl = document.getElementById('selectedPropertyName');
            if (selectedPropertyNameEl) {
                selectedPropertyNameEl.textContent = `Property ID: ${propertyId}`;
            }
        };
    }
}

// Analytics Admin API를 사용해서 단계별 선택 UI 로드
async function loadAnalyticsAdminData() {
    try {
        console.log('📊 GA 계정 및 속성 목록 로드 중...');
        
        // Management API를 사용해서 계정 요약 정보 가져오기
        const response = await fetch('/api/analytics-management/account-summaries', {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        
        console.log('Management API 응답:', data); // 디버깅용
        
        if (data.success && data.data && data.data.length > 0) {
            console.log(`✅ Management API: ${data.data.length}개 계정 발견`);
            displayAccountSummaries(data.data);
        } else {
            // Admin API로 폴백 시도
            console.log('Admin API로 시도...');
            const accountResponse = await fetch('/api/analytics-admin/accounts', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const accountData = await accountResponse.json();
            
            if (!accountData.success) {
                throw new Error(accountData.error || 'API 호출 실패');
            }
            
            // 디버그 정보 출력
            if (accountData.debug) {
                console.log('🔍 API 디버그 정보:', accountData.debug);
            }
            console.log(`✅ Admin API: ${accountData.accounts.length}개 GA4 계정 발견`);
            console.log('📄 첫 번째 계정:', accountData.accounts[0]);
            console.log('📄 마지막 계정:', accountData.accounts[accountData.accounts.length - 1]);
            
            // 50개 이상인지 확인
            if (accountData.accounts.length === 50) {
                console.warn('⚠️ 정확히 50개의 계정만 로드됨 - 페이지네이션 문제일 수 있음');
            }
            
            displayAccounts(accountData.accounts);
        }
        
    } catch (error) {
        console.error('❌ Analytics 데이터 로드 실패:', error);
        displayAccountError(error.message);
    }
}

// Management API를 사용한 계정 요약 표시
function displayAccountSummaries(summaries) {
    const accountLoadingMessage = document.getElementById('accountLoadingMessage');
    const accountList = document.getElementById('accountList');
    
    accountLoadingMessage.style.display = 'none';
    accountList.style.display = 'block';
    
    if (summaries.length === 0) {
        accountList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-500);">
                ⚠️ 접근 가능한 GA 계정이 없습니다.
            </div>
        `;
        return;
    }
    
    // 간단한 계정 목록만 표시하고, 클릭하면 속성 목록을 표시
    accountList.innerHTML = summaries.map(summary => `
        <div class="selectable-item" data-account-id="${summary.accountId}" data-account='${JSON.stringify(summary)}'>
            <div class="item-main">
                <div class="item-title">${summary.accountName}</div>
                <div class="item-details">계정 ID: ${summary.accountId}</div>
                <div class="item-meta">
                    속성 수: ${summary.properties.length}개
                </div>
            </div>
            <div class="item-badge">GA</div>
        </div>
    `).join('');
    
    // 계정 선택 이벤트 추가
    accountList.querySelectorAll('.selectable-item').forEach(item => {
        item.addEventListener('click', () => selectAccountWithProperties(item));
    });
}

// 계정 선택 시 바로 속성 표시 (GA4 스타일 UI)
function selectAccountWithProperties(accountElement) {
    // 기존 선택 제거
    document.querySelectorAll('#accountList .selectable-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 새 선택 적용
    accountElement.classList.add('selected');
    
    // 선택된 계정 정보 저장
    const accountData = JSON.parse(accountElement.dataset.account);
    
    selectedAccount = {
        id: accountData.accountId || accountData.id,
        displayName: accountData.accountName || accountData.displayName || accountData.name,
        name: accountData.accountId || accountData.id
    };
    
    // 우측 패널에 속성 목록 표시
    const noAccountSelected = document.getElementById('noAccountSelected');
    const propertyLoadingMessage = document.getElementById('propertyLoadingMessage');
    const propertyList = document.getElementById('propertyList');
    
    // 메시지 숨기고 로딩 표시
    noAccountSelected.style.display = 'none';
    propertyLoadingMessage.style.display = 'block';
    propertyList.style.display = 'none';
    
    // 짧은 딜레이 후 속성 목록 표시 (로딩 효과)
    setTimeout(() => {
        propertyLoadingMessage.style.display = 'none';
        propertyList.style.display = 'block';
        
        // Admin API를 통해 속성 목록 가져오기
        loadPropertiesForAccount(selectedAccount.id);
    }, 300);
}

// 계정 요약에서 속성 표시
function displayPropertiesFromSummary(properties) {
    const propertyLoadingMessage = document.getElementById('propertyLoadingMessage');
    const propertyList = document.getElementById('propertyList');
    
    if (!propertyLoadingMessage || !propertyList) {
        console.error('❌ 필요한 DOM 요소를 찾을 수 없습니다!');
        return;
    }
    
    propertyLoadingMessage.style.display = 'none';
    propertyList.style.display = 'block';
    
    if (!properties || properties.length === 0) {
        propertyList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-500);">
                ⚠️ 이 계정에는 접근 가능한 GA4 속성이 없습니다.
            </div>
        `;
        return;
    }
    
    // 새로운 GA4 스타일 UI에 맞는 HTML 생성
    propertyList.innerHTML = properties.map((property, index) => `
        <div class="selectable-item" data-property-id="${property.propertyId}" data-property-name="${property.propertyName}" data-index="${index}">
            <div class="item-main">
                <div class="item-title">${property.propertyName}</div>
                <div class="item-details">속성 ID: ${property.propertyId}</div>
                <div class="item-meta">
                    ${property.websiteUrl ? `URL: ${property.websiteUrl}` : 'URL 정보 없음'}
                </div>
            </div>
            <div class="item-badge">GA4</div>
        </div>
    `).join('');
    
    // 각 속성 항목에 클릭 이벤트 추가
    const selectableItems = propertyList.querySelectorAll('.selectable-item');
    
    selectableItems.forEach((item) => {
        item.addEventListener('click', function() {
            const propertyId = this.getAttribute('data-property-id');
            const propertyName = this.getAttribute('data-property-name');
            
            // setProperty 함수 호출
            setProperty(propertyId, propertyName, this);
        });
        
        // 스타일 추가
        item.style.cursor = 'pointer';
        item.style.transition = 'background-color 0.2s';
        
        // 호버 효과 추가
        item.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f0f9ff';
        });
        
        item.addEventListener('mouseleave', function() {
            if (!this.classList.contains('selected')) {
                this.style.backgroundColor = '';
            }
        });
    });
}

// 간단한 속성 설정 함수
function setProperty(propertyId, propertyName, clickedElement = null) {
    // propertyId가 'properties/123456' 형태로 오면 숫자만 추출
    if (propertyId && propertyId.includes('properties/')) {
        propertyId = propertyId.split('/')[1];
    }
    
    // 전역 변수 설정
    selectedPropertyId = propertyId;
    window.selectedPropertyId = propertyId;
    
    selectedProperty = {
        id: propertyId,
        displayName: propertyName,
        name: `properties/${propertyId}`
    };
    
    // sessionStorage에 저장 (페이지 새로고침 대비)
    sessionStorage.setItem('selectedPropertyId', propertyId);
    sessionStorage.setItem('selectedProperty', JSON.stringify(selectedProperty));
    
    // UI 업데이트 - 모든 선택 항목에서 selected 클래스 제거
    document.querySelectorAll('.selectable-item').forEach(item => {
        item.classList.remove('selected');
        item.style.backgroundColor = '';
        item.style.borderColor = '';
    });
    
    // 클릭된 요소에 선택 표시
    if (clickedElement) {
        clickedElement.classList.add('selected');
        clickedElement.style.backgroundColor = '#e8f5e8';
        clickedElement.style.borderColor = '#28a745';
    }
    
    // 선택된 속성 표시 영역 보이기
    const selectedPropertyDisplay = document.getElementById('selectedPropertyDisplay');
    const selectedPropertyNameEl = document.getElementById('selectedPropertyName');
    
    if (selectedPropertyDisplay && selectedPropertyNameEl) {
        selectedPropertyDisplay.style.display = 'flex';
        selectedPropertyNameEl.textContent = `${propertyName} (ID: ${propertyId})`;
    }
    
    // 기존 방식도 유지 (호환성)
    const legacySelectedPropertyNameEl = document.querySelector('.selected-property #selectedPropertyName');
    if (legacySelectedPropertyNameEl) {
        legacySelectedPropertyNameEl.textContent = `${propertyName} (ID: ${propertyId})`;
    }
}

// 속성 선택 처리 (Management API 버전) - 삭제
function selectPropertyFromSummary(propertyElement) {
    // 기존 선택 제거
    document.querySelectorAll('#propertyList .selectable-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 새 선택 적용
    propertyElement.classList.add('selected');
    
    // 선택된 속성 정보 저장
    const property = JSON.parse(propertyElement.dataset.property);
    
    // selectProperty 함수와 동일한 로직으로 저장 (여러 방법으로 저장)
    const propertyName = `properties/${property.propertyId}`;
    const displayName = property.propertyName;
    const extractedId = property.propertyId;
    
    // window 객체에 저장
    window.selectedPropertyId = extractedId;
    window.selectedProperty = {
        id: extractedId,
        displayName: displayName,
        name: propertyName
    };
    
    // 전역 변수에 직접 저장
    selectedPropertyId = extractedId;
    selectedProperty = {
        id: extractedId,
        displayName: displayName,
        name: propertyName
    };
    
    // sessionStorage에도 저장 (영구 보존용)
    sessionStorage.setItem('selectedPropertyId', extractedId);
    sessionStorage.setItem('selectedProperty', JSON.stringify({
        id: extractedId,
        displayName: displayName,
        name: propertyName
    }));
    
    console.log('🏢 속성 선택됨:', selectedProperty.displayName);
    console.log('🏢 저장된 selectedPropertyId:', selectedPropertyId);
    console.log('🏢 저장된 window.selectedPropertyId:', window.selectedPropertyId);
    console.log('🏢 저장된 sessionStorage:', sessionStorage.getItem('selectedPropertyId'));
    
    // 전역 변수 상태 확인
    
    
    // 2단계 완료 표시
    const propertyStep = document.getElementById('propertyStep');
    propertyStep.classList.remove('active');
    propertyStep.classList.add('completed');
    
    // 최종 선택 완료 (데이터 스트림 단계 스킵)
    showFinalSelectionSimple();
}

// 최종 선택 완료 표시 (간단 버전)
function showFinalSelectionSimple() {
    const finalSelection = document.getElementById('finalSelection');
    const selectionSummary = document.getElementById('selectionSummary');
    
    selectionSummary.innerHTML = `
        <div class="selection-summary">
            <div class="summary-row">
                <span class="summary-label">계정:</span>
                <span class="summary-value">${selectedAccount.displayName}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">속성:</span>
                <span class="summary-value">${selectedProperty.displayName}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">속성 ID:</span>
                <span class="summary-value">${selectedPropertyId}</span>
            </div>
        </div>
    `;
    
    finalSelection.style.display = 'block';
    
    // 분석 시작 버튼 이벤트 추가
    const proceedBtn = document.getElementById('proceedToAnalysis');
    if (proceedBtn) {
        proceedBtn.removeEventListener('click', proceedToAnalysis);
        proceedBtn.addEventListener('click', proceedToAnalysis);
    }
}

// 계정 목록 표시
// Admin API로 가져온 계정 목록을 검색 가능한 UI로 표시
function displayAccountsWithSearch(accounts) {
    const accountLoadingMessage = document.getElementById('accountLoadingMessage');
    const accountList = document.getElementById('accountList');
    
    accountLoadingMessage.style.display = 'none';
    accountList.style.display = 'block';
    
    if (accounts.length === 0) {
        accountList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-500);">
                ⚠️ 접근 가능한 GA4 계정이 없습니다.
            </div>
        `;
        return;
    }
    
    // 검색 가능한 계정 선택 UI (실제 GA4처럼)
    accountList.innerHTML = `
        <div style="margin-bottom: 15px;">
            <input type="text" 
                   id="accountSearch" 
                   class="select-input" 
                   placeholder="🔍 계정명 또는 ID로 검색..."
                   style="width: 100%; padding: 10px;"
                   onkeyup="filterAccountItems(this.value)">
        </div>
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            ${accounts.map(account => `
                <div class="selectable-item" 
                     data-account='${JSON.stringify(account)}'
                     data-search="${account.displayName.toLowerCase()} ${account.name.toLowerCase()}"
                     style="cursor: pointer; padding: 12px; border-bottom: 1px solid #f0f0f0;">
                    <div class="item-main">
                        <div class="item-title" style="font-weight: bold;">${account.displayName}</div>
                        <div class="item-details" style="color: #666; font-size: 14px;">ID: ${account.name.split('/')[1]}</div>
                        <div class="item-meta" style="color: #999; font-size: 12px;">
                            ${account.regionCode ? `지역: ${account.regionCode}` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="margin-top: 10px; color: var(--gray-500); font-size: 14px;">
            💡 총 ${accounts.length}개 계정 | 클릭하여 선택
        </div>
    `;
    
    // 계정 선택 이벤트 추가
    accountList.querySelectorAll('.selectable-item').forEach(item => {
        item.addEventListener('click', () => selectAccount(item));
    });
    
    // 계정 데이터 저장
    window.ga4Accounts = accounts;
}

// 계정 아이템 필터링
function filterAccountItems(searchTerm) {
    const items = document.querySelectorAll('#accountList .selectable-item');
    const term = searchTerm.toLowerCase();
    let visibleCount = 0;
    
    items.forEach(item => {
        const searchData = item.getAttribute('data-search');
        if (searchData.includes(term)) {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // 결과 카운트 업데이트
    const countInfo = document.querySelector('#accountList > div:last-child');
    if (countInfo) {
        countInfo.innerHTML = `💡 ${visibleCount}개 계정 표시 중 | 클릭하여 선택`;
    }
}

// 기존 displayAccounts 함수 (폴백용)
function displayAccounts(accounts) {
    displayAccountsWithSearch(accounts);
}

// 계정 선택 처리
async function selectAccount(accountElement) {
    // 기존 선택 제거
    document.querySelectorAll('#accountList .selectable-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 새 선택 적용
    accountElement.classList.add('selected');
    
    // 선택된 계정 정보 저장
    selectedAccount = JSON.parse(accountElement.dataset.account);
    
    console.log('🏢 계정 선택됨:', selectedAccount.displayName);
    console.log('📍 계정 name:', selectedAccount.name);
    
    // 1단계 완료 표시
    const accountStep = accountElement.closest('.step-container');
    if (accountStep) {
        accountStep.classList.add('completed');
    }
    
    // 2단계 활성화
    const propertyStep = document.getElementById('propertyStep');
    if (propertyStep) {
        propertyStep.style.display = 'block';
        propertyStep.classList.add('active');
    }
    
    // 선택된 계정 정보 표시
    const selectedAccountInfo = document.getElementById('selectedAccountInfo');
    if (selectedAccountInfo) {
        selectedAccountInfo.innerHTML = `
            <div class="title">선택된 계정</div>
            <div>${selectedAccount.displayName}</div>
            <div style="font-size: 12px; color: var(--gray-500);">ID: ${selectedAccount.name.split('/')[1]}</div>
        `;
    }
    
    // 해당 계정의 속성 로드 (전체 name 경로 전달: accounts/XXXXXXXXX)
    await loadPropertiesForAccount(selectedAccount.name);
}

// 특정 계정의 속성 목록 로드
async function loadPropertiesForAccount(accountName) {
    const propertyLoadingMessage = document.getElementById('propertyLoadingMessage');
    const propertyList = document.getElementById('propertyList');
    
    try {
        propertyLoadingMessage.style.display = 'block';
        propertyList.style.display = 'none';
        
        // accounts/12345 형태에서 숫자 ID만 추출
        const accountId = accountName.replace('accounts/', '');
        const response = await fetch(`/api/analytics-admin/accounts/${encodeURIComponent(accountId)}/properties`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        
        if (!data.success) {
            // API 실패 시 속성 없음 메시지 표시
            showManualPropertyInput(accountName);
            return;
        }
        
        // 속성이 있는지 확인하고 표시
        if (data.properties && data.properties.length > 0) {
            // 로딩 메시지 숨기기
            propertyLoadingMessage.style.display = 'none';
            propertyList.style.display = 'block';
            
            // 새로운 GA4 UI에 맞는 속성 목록 표시
            displayPropertiesFromAdmin(data.properties);
        } else {
            propertyLoadingMessage.style.display = 'none';
            propertyList.style.display = 'block';
            propertyList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--gray-500);">
                    ⚠️ 이 계정에는 접근 가능한 GA4 속성이 없습니다.
                </div>
            `;
        }
    } catch (error) {
        propertyLoadingMessage.style.display = 'none';
        propertyList.style.display = 'block';
        propertyList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger);">
                ❌ 속성 목록을 불러오는 중 오류가 발생했습니다.
            </div>
        `;
    }
}

// Admin API에서 가져온 속성 데이터를 GA4 스타일로 표시
function displayPropertiesFromAdmin(properties) {
    const propertyList = document.getElementById('propertyList');
    
    if (!properties || properties.length === 0) {
        propertyList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-500);">
                ⚠️ 이 계정에는 접근 가능한 GA4 속성이 없습니다.
            </div>
        `;
        return;
    }
    
    // Admin API 형식을 Summary API 형식으로 변환
    const convertedProperties = properties.map(prop => ({
        propertyId: prop.name.split('/')[1], // properties/123456789 → 123456789
        propertyName: prop.displayName,
        websiteUrl: prop.websiteUrl || ''
    }));
    
    // 기존 displayPropertiesFromSummary 함수 재사용
    displayPropertiesFromSummary(convertedProperties);
}

// 수동 속성 ID 입력 폼 표시
function showManualPropertyInput(accountName) {
    const propertyLoadingMessage = document.getElementById('propertyLoadingMessage');
    const propertyList = document.getElementById('propertyList');
    
    propertyLoadingMessage.style.display = 'none';
    propertyList.style.display = 'block';
    
    propertyList.innerHTML = `
        <div style="padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h4 style="margin-bottom: 15px;">📝 GA4 속성 ID 직접 입력</h4>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #ffc107;">
                <strong>⚠️ API 연결 실패로 수동 입력이 필요합니다</strong><br>
                <div style="margin-top: 10px;">
                    Google Analytics에서 속성 ID를 확인해주세요:<br>
                    1. GA4 계정에 로그인 → 관리(⚙️) → 속성 설정<br>
                    2. "속성 ID" 확인 (예: 123456789)
                </div>
            </div>
            <input type="text" 
                   id="manualPropertyId" 
                   placeholder="속성 ID 입력 (예: 123456789)" 
                   class="select-input" 
                   style="width: 100%; padding: 12px; font-size: 16px; margin-bottom: 15px;">
            <button onclick="useManualPropertyId('${accountName}')" 
                    class="btn btn-primary" 
                    style="width: 100%; padding: 12px; font-size: 16px;">
                ✅ 이 속성 ID 사용하기
            </button>
        </div>
    `;
}

// 수동으로 입력한 속성 ID 사용
function useManualPropertyId(accountName) {
    const propertyId = document.getElementById('manualPropertyId').value.trim();
    
    if (!propertyId) {
        alert('속성 ID를 입력해주세요.');
        return;
    }
    
    if (!/^\d+$/.test(propertyId)) {
        alert('속성 ID는 숫자만 입력해야 합니다.');
        return;
    }
    
    // 선택된 속성 정보 저장
    selectedPropertyId = propertyId;
    selectedProperty = {
        id: propertyId,
        displayName: `GA4 Property (${propertyId})`,
        name: `properties/${propertyId}`
    };
    
    console.log('📊 수동 입력 속성 ID:', propertyId);
    
    // 다음 단계로 진행
    proceedToAnalysis();
}

// 속성 선택 처리 (대체 요소용) - 삭제
function selectProperty(propertyName, displayName) {
    const propertyId = propertyName.split('/')[1];
    setProperty(propertyId, displayName);
    
    // 전역 변수 상태 확인
    
    
    // 기존 선택 결과 제거
    const existingSelection = document.querySelector('.property-selection-result');
    if (existingSelection) {
        existingSelection.remove();
        console.log('🎯 기존 선택 결과 제거됨');
    }
    
    // 속성 아이템들에서 선택 표시 제거
    const propertyItems = document.querySelectorAll('.property-item');
    propertyItems.forEach(item => {
        item.style.borderColor = '#e9ecef';
        item.style.backgroundColor = 'white';
    });
    
    // 현재 선택된 속성 강조
    const clickedItem = event ? event.currentTarget : null;
    if (clickedItem) {
        clickedItem.style.borderColor = '#28a745';
        clickedItem.style.backgroundColor = '#f8fff9';
    }
    
    // 선택 결과 표시
    const selectionDiv = document.createElement('div');
    selectionDiv.className = 'property-selection-result';
    selectionDiv.innerHTML = `
        <div style="background: #d4edda; padding: 20px; margin: 15px 0; border-radius: 8px; border: 2px solid #c3e6cb;">
            <h4 style="margin: 0 0 15px 0; color: #155724;">✅ 선택된 속성</h4>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${displayName}</div>
            <div style="color: #6c757d; margin-bottom: 15px;">속성 ID: ${selectedPropertyId}</div>
            <button onclick="proceedToDataFetching()" 
                    style="background: #007bff; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                📊 이 속성의 데이터 분석 시작
            </button>
        </div>
    `;
    
    // 속성 결과 아래에 추가
    const propertyResults = document.getElementById('propertyResults');
    if (propertyResults) {
        propertyResults.appendChild(selectionDiv);
        console.log('🎯 선택 결과를 propertyResults에 추가됨');
    } else {
        // 폴백: 다른 위치에 추가
        const propertySection = document.querySelector('#propertyStep') || 
                               document.querySelector('.step-container:nth-child(2)') ||
                               document.body;
        
        if (propertySection) {
            propertySection.appendChild(selectionDiv);
            console.log('🎯 선택 결과를 폴백 위치에 추가됨');
        }
    }
    
    console.log('🎯 선택 완료 - 속성 ID:', selectedPropertyId);
    
    // 스크롤을 선택 결과로 이동
    selectionDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 데이터 가져오기 단계로 진행
function proceedToDataFetching() {
    console.log('🚀 데이터 분석 시작 버튼 클릭됨!');
    
    // 전역 변수 상태 다시 확인
    
    
    // window 객체에서도 확인
    console.log('window.selectedPropertyId:', window.selectedPropertyId);
    console.log('window.selectedProperty:', window.selectedProperty);
    
    // 변수가 없으면 에러 메시지
    if (!selectedPropertyId && !window.selectedPropertyId) {
        alert('속성이 선택되지 않았습니다. 속성을 먼저 선택해주세요.');
        return;
    }
    
    // 확실한 값 사용
    const finalPropertyId = selectedPropertyId || window.selectedPropertyId;
    const finalProperty = selectedProperty || window.selectedProperty;
    
    console.log('🚀 사용할 최종 값:');
    console.log('- finalPropertyId:', finalPropertyId);
    console.log('- finalProperty:', finalProperty);
    
    // 기존 속성 선택 UI 숨기기
    const propertySteps = document.querySelectorAll('#propertyStep, .step-container');
    propertySteps.forEach(step => {
        if (step.style) step.style.display = 'none';
    });
    
    // 메인 컨테이너 찾기
    const mainContainer = document.querySelector('.container') || 
                         document.querySelector('main') || 
                         document.body;
    
    // 분석 UI 표시
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'analysisSection';
    analysisDiv.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
            <h2>📊 GA4 콘텐츠 그룹핑 분석</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <strong>선택된 속성:</strong> ${finalProperty.displayName} (ID: ${finalPropertyId})
            </div>
            
            <!-- 기간 선택 -->
            <div style="margin-bottom: 20px;">
                <label>📅 분석 기간:</label>
                <select id="datePreset" style="margin-left: 10px; padding: 8px;">
                    <option value="7">최근 7일</option>
                    <option value="30" selected>최근 30일</option>
                    <option value="90">최근 90일</option>
                </select>
            </div>
            
            <!-- 데이터 가져오기 버튼 -->
            <button onclick="fetchAndProcessData()" 
                    id="fetchDataBtn"
                    style="background: #28a745; color: white; border: none; padding: 15px 30px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                🔄 GA4 데이터 가져오고 분석하기
            </button>
            
            <!-- 진행 상태 -->
            <div id="progressSection" style="margin-top: 20px; display: none;">
                <div id="progressBar" style="background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden;">
                    <div id="progressFill" style="background: #007bff; height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
                <div id="progressText" style="margin-top: 10px; text-align: center;"></div>
            </div>
            
            <!-- 결과 섹션 -->
            <div id="resultsSection" style="margin-top: 30px; display: none;">
                <h3>📈 분석 결과</h3>
                <div id="resultsContent"></div>
            </div>
        </div>
    `;
    
    mainContainer.appendChild(analysisDiv);
    
    // 스크롤을 분석 섹션으로 이동
    analysisDiv.scrollIntoView({ behavior: 'smooth' });
    
    console.log('🎯 분석 UI 준비 완료');
}

// 기존 분석 함수 (호환성 유지)
function proceedToAnalysis() {
    proceedToDataFetching();
}

// 속성 목록 표시
function displayProperties(properties) {
    const propertyLoadingMessage = document.getElementById('propertyLoadingMessage');
    const propertyList = document.getElementById('propertyList');
    
    console.log('🔍 DOM 요소 확인:');
    console.log('propertyLoadingMessage:', propertyLoadingMessage);
    console.log('propertyList:', propertyList);
    
    if (!propertyLoadingMessage || !propertyList) {
        console.error('❌ DOM 요소를 찾을 수 없음!');
        // 다른 방법으로 표시
        const fallbackElement = document.querySelector('.step-container:nth-child(2) .content') || 
                                document.querySelector('#propertySection') ||
                                document.body;
        
        if (fallbackElement) {
            console.log('🔧 대체 요소에 속성 목록 표시');
            fallbackElement.innerHTML = `
                <h3>✅ ${properties.length}개 속성 발견</h3>
                ${properties.map(property => `
                    <div style="padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;"
                         onclick="selectProperty('${property.name}', '${property.displayName}')">
                        <strong>${property.displayName}</strong><br>
                        <small>ID: ${property.name.split('/')[1]}</small>
                    </div>
                `).join('')}
            `;
        }
        return;
    }
    
    propertyLoadingMessage.style.display = 'none';
    propertyList.style.display = 'block';
    
    if (properties.length === 0) {
        propertyList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-500);">
                ⚠️ 이 계정에는 접근 가능한 GA4 속성이 없습니다.
            </div>
        `;
        return;
    }
    
    propertyList.innerHTML = properties.map((property, index) => `
        <div class="selectable-item" 
             data-property='${JSON.stringify(property)}'
             data-property-id="${property.name.split('/')[1]}"
             data-property-name="${property.displayName}"
             data-index="${index}">
            <div class="item-main">
                <div class="item-title">${property.displayName}</div>
                <div class="item-details">속성 ID: ${property.name.split('/')[1]}</div>
                <div class="item-meta">
                    타임존: ${property.timeZone || 'N/A'} | 
                    통화: ${property.currencyCode || 'N/A'} |
                    유형: ${property.propertyType || 'N/A'}
                </div>
            </div>
            <div class="item-badge">Property</div>
        </div>
    `).join('');
    
    // 속성 선택 이벤트 추가
    const selectableItems = propertyList.querySelectorAll('.selectable-item');
    
    selectableItems.forEach((item) => {
        item.addEventListener('click', function() {
            const propertyId = this.getAttribute('data-property-id');
            const propertyName = this.getAttribute('data-property-name');
            
            // setProperty 함수 직접 호출
            setProperty(propertyId, propertyName, this);
        });
        
        // 스타일 및 호버 효과 추가
        item.style.cursor = 'pointer';
        item.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f0f9ff';
        });
        
        item.addEventListener('mouseleave', function() {
            if (!this.classList.contains('selected')) {
                this.style.backgroundColor = '';
            }
        });
    });
}

// 속성 선택 처리
async function selectProperty(propertyElement) {
    // 기존 선택 제거
    document.querySelectorAll('#propertyList .selectable-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 새 선택 적용
    propertyElement.classList.add('selected');
    
    // 선택된 속성 정보 저장
    selectedProperty = JSON.parse(propertyElement.dataset.property);
    
    // 속성 ID 추출 및 저장 - 가장 중요!!!
    const propertyId = selectedProperty.name.split('/')[1];
    selectedPropertyId = propertyId;
    
    // 세션에도 저장
    sessionStorage.setItem('selectedPropertyId', propertyId);
    sessionStorage.setItem('selectedProperty', JSON.stringify(selectedProperty));
    
    console.log('🏢 속성 선택됨:', selectedProperty.displayName);
    console.log('🏢 속성 ID 저장됨:', selectedPropertyId);
    
    // 데이터 스트림 단계 스킵하고 바로 데이터 수집으로
    console.log('✅ 속성 선택 완료! 데이터 수집 화면으로 이동');
    
    // 속성 섹션 숨기고 컨트롤 섹션 표시
    propertySection.style.display = 'none';
    controlSection.style.display = 'block';
    
    // 선택된 속성 정보 표시
    const selectedPropertyNameEl = document.getElementById('selectedPropertyName');
    if (selectedPropertyNameEl) {
        selectedPropertyNameEl.textContent = `${selectedProperty.displayName} (ID: ${selectedPropertyId})`;
    }
    
    // alert 대신 콘솔 로그만
    console.log(`✅ 속성 선택 완료: ${selectedProperty.displayName} (ID: ${selectedPropertyId})`);
    
    // 선택된 속성 정보 표시
    document.getElementById('selectedPropertyInfo').innerHTML = `
        <div class="title">선택된 속성</div>
        <div>${selectedProperty.displayName}</div>
        <div style="font-size: 12px; color: var(--gray-500);">ID: ${selectedProperty.name.split('/')[1]}</div>
    `;
    
    // 해당 속성의 데이터 스트림 로드
    await loadDataStreams(selectedProperty.name);
}

// 특정 속성의 데이터 스트림 목록 로드
async function loadDataStreams(propertyName) {
    const streamLoadingMessage = document.getElementById('streamLoadingMessage');
    const streamList = document.getElementById('streamList');
    
    try {
        console.log(`📊 속성 "${propertyName}"의 데이터 스트림 목록 로드 중...`);
        
        streamLoadingMessage.style.display = 'block';
        streamList.style.display = 'none';
        
        const response = await fetch(`/api/analytics-admin/properties/${encodeURIComponent(propertyName)}/datastreams`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }
        
        console.log(`✅ ${data.dataStreams.length}개 데이터 스트림 발견`);
        
        // 데이터 스트림 목록 표시
        displayDataStreams(data.dataStreams);
        
    } catch (error) {
        console.error('❌ 데이터 스트림 목록 로드 실패:', error);
        streamLoadingMessage.innerHTML = `
            <div style="color: var(--danger);">❌ 데이터 스트림 목록 로드 실패: ${error.message}</div>
        `;
    }
}

// 데이터 스트림 목록 표시
function displayDataStreams(dataStreams) {
    const streamLoadingMessage = document.getElementById('streamLoadingMessage');
    const streamList = document.getElementById('streamList');
    
    streamLoadingMessage.style.display = 'none';
    streamList.style.display = 'block';
    
    if (dataStreams.length === 0) {
        streamList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--gray-500);">
                ⚠️ 이 속성에는 데이터 스트림이 없습니다.
            </div>
        `;
        return;
    }
    
    streamList.innerHTML = dataStreams.map(stream => {
        let badgeClass = 'item-badge';
        let streamType = stream.type || 'UNKNOWN';
        let details = `스트림 ID: ${stream.name.split('/')[3]}`;
        
        // 스트림 타입별 배지 및 세부 정보 설정
        if (stream.webStreamData) {
            badgeClass += ' web';
            streamType = 'WEB';
            if (stream.webStreamData.measurementId) {
                details += ` | Measurement ID: ${stream.webStreamData.measurementId}`;
            }
            if (stream.webStreamData.defaultUri) {
                details += ` | URI: ${stream.webStreamData.defaultUri}`;
            }
        } else if (stream.androidAppStreamData) {
            badgeClass += ' android';
            streamType = 'ANDROID';
            if (stream.androidAppStreamData.packageName) {
                details += ` | Package: ${stream.androidAppStreamData.packageName}`;
            }
        } else if (stream.iosAppStreamData) {
            badgeClass += ' ios';
            streamType = 'iOS';
            if (stream.iosAppStreamData.bundleId) {
                details += ` | Bundle ID: ${stream.iosAppStreamData.bundleId}`;
            }
        }
        
        return `
            <div class="selectable-item" data-stream='${JSON.stringify(stream)}'>
                <div class="item-main">
                    <div class="item-title">${stream.displayName}</div>
                    <div class="item-details">${details}</div>
                    <div class="item-meta">
                        생성일: ${stream.createTime ? new Date(stream.createTime).toLocaleDateString() : 'N/A'}
                    </div>
                </div>
                <div class="${badgeClass}">${streamType}</div>
            </div>
        `;
    }).join('');
    
    // 데이터 스트림 선택 이벤트 추가
    streamList.querySelectorAll('.selectable-item').forEach(item => {
        item.addEventListener('click', () => selectDataStream(item));
    });
}

// 데이터 스트림 선택 처리
function selectDataStream(streamElement) {
    // 기존 선택 제거
    document.querySelectorAll('#streamList .selectable-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 새 선택 적용
    streamElement.classList.add('selected');
    
    // 선택된 데이터 스트림 정보 저장
    selectedDataStream = JSON.parse(streamElement.dataset.stream);
    
    console.log('📊 데이터 스트림 선택됨:', selectedDataStream.displayName);
    
    // 3단계 완료 표시
    const streamStep = document.getElementById('streamStep');
    streamStep.classList.remove('active');
    streamStep.classList.add('completed');
    
    // 최종 선택 완료
    showFinalSelection();
}

// 최종 선택 완료 표시
function showFinalSelection() {
    const finalSelection = document.getElementById('finalSelection');
    const selectionSummary = document.getElementById('selectionSummary');
    
    // 속성 ID 추출 (기존 로직과 연동)
    selectedPropertyId = selectedProperty.name.split('/')[1];
    
    selectionSummary.innerHTML = `
        <div class="selection-summary">
            <div class="summary-row">
                <span class="summary-label">계정:</span>
                <span class="summary-value">${selectedAccount.displayName}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">속성:</span>
                <span class="summary-value">${selectedProperty.displayName}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">속성 ID:</span>
                <span class="summary-value">${selectedPropertyId}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">데이터 스트림:</span>
                <span class="summary-value">${selectedDataStream.displayName}</span>
            </div>
            ${selectedDataStream.webStreamData?.measurementId ? `
            <div class="summary-row">
                <span class="summary-label">Measurement ID:</span>
                <span class="summary-value">${selectedDataStream.webStreamData.measurementId}</span>
            </div>
            ` : ''}
        </div>
    `;
    
    finalSelection.style.display = 'block';
    
    // 분석 시작 버튼 이벤트 추가
    document.getElementById('proceedToAnalysis').addEventListener('click', proceedToAnalysis);
}

// 분석 시작
function proceedToAnalysis() {
    console.log('🚀 선택된 설정으로 분석 시작');
    console.log('선택 정보:', {
        account: selectedAccount?.displayName,
        property: selectedProperty?.displayName,
        propertyId: selectedPropertyId,
        dataStream: selectedDataStream?.displayName
    });
    
    // 다음 섹션으로 이동
    propertySection.style.display = 'none';
    controlSection.style.display = 'block';
    
    // 선택된 속성 표시 업데이트
    const selectedPropertyNameEl = document.getElementById('selectedPropertyName');
    if (selectedPropertyNameEl) {
        selectedPropertyNameEl.textContent = `${selectedProperty.displayName} (ID: ${selectedPropertyId})`;
    }
}

// 에러 표시
function displayAccountError(errorMessage) {
    const accountLoadingMessage = document.getElementById('accountLoadingMessage');
    accountLoadingMessage.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--danger);">
            ❌ 계정 목록 로드 실패: ${errorMessage}
            <br><br>
            <button class="btn btn-secondary" onclick="loadAnalyticsAdminData()">
                🔄 다시 시도
            </button>
        </div>
    `;
}

// 기존 loadProperties 함수를 대체하는 버전
async function loadPropertiesLegacy() {
    const loadingMessage = document.getElementById('loadingMessage');
    const propertyList = document.getElementById('propertyList');
    const toggleButton = document.getElementById('toggleManualInput');
    
    try {
        console.log('Loading accounts and properties...');
        
        // Admin API로 계정과 속성 목록 가져오기
        const response = await fetch('/api/admin/accounts-properties');
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Accounts and properties data:', data);
        
        if (data.success && data.accounts && data.accounts.length > 0) {
            loadingMessage.style.display = 'none';
            propertyList.style.display = 'block';
            displayAccountsAndProperties(data.accounts);
            // 속성 로딩 성공시 직접 입력 버튼만 보이기
            toggleButton.style.display = 'inline-block';
        } else if (data.fallback || !data.success) {
            // Fallback to GAService method
            console.log('Using fallback method (GAService)...');
            const fallbackResponse = await fetch('/api/analytics/properties');
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData.success && fallbackData.properties && fallbackData.properties.length > 0) {
                loadingMessage.style.display = 'none';
                propertyList.style.display = 'grid';
                displayProperties(fallbackData.properties);
                // 속성 로딩 성공시 직접 입력 버튼만 보이기
                toggleButton.style.display = 'inline-block';
            } else {
                loadingMessage.innerHTML = '❌ 속성 로딩 실패. 직접 입력을 사용해주세요.';
                // 속성 로딩 실패시 직접 입력 섹션 바로 보이기
                showManualInputOnError();
            }
        } else {
            loadingMessage.innerHTML = '❌ 속성 로딩 실패. 직접 입력을 사용해주세요.';
            // 속성 로딩 실패시 직접 입력 섹션 바로 보이기
            showManualInputOnError();
        }
    } catch (error) {
        console.error('Failed to load properties:', error);
        loadingMessage.innerHTML = '⚠️ 속성을 자동으로 불러올 수 없습니다. 직접 입력을 사용해주세요.';
        // 에러 시 직접 입력 섹션 바로 보이기
        showManualInputOnError();
    }
}

function displayProperties(properties) {
    const propertyList = document.getElementById('propertyList');
    propertyList.innerHTML = '';
    
    properties.forEach(property => {
        const item = document.createElement('div');
        item.className = 'property-item';
        item.innerHTML = `
            <div class="property-name">${property.displayName || property.id}</div>
            <div class="property-id">ID: ${property.id}</div>
        `;
        item.addEventListener('click', () => selectProperty(property));
        propertyList.appendChild(item);
    });
}

function displayAccountsAndProperties(accounts) {
    const propertyList = document.getElementById('propertyList');
    propertyList.innerHTML = '';
    propertyList.style.display = 'block';
    
    // 스타일 변경
    propertyList.style.maxHeight = '400px';
    propertyList.style.overflowY = 'auto';
    
    if (!accounts || accounts.length === 0) {
        propertyList.innerHTML = '<p>계정을 찾을 수 없습니다.</p>';
        return;
    }
    
    // 계정별로 그룹화하여 표시
    accounts.forEach(account => {
        // 계정 헤더
        const accountHeader = document.createElement('div');
        accountHeader.style.cssText = 'font-weight: bold; padding: 10px; background: #f0f0f0; margin: 10px 0 5px 0; border-radius: 4px;';
        accountHeader.innerHTML = `📁 ${account.accountName} (${account.properties.length}개 속성)`;
        propertyList.appendChild(accountHeader);
        
        // 속성 목록
        const propertiesContainer = document.createElement('div');
        propertiesContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; padding: 0 10px;';
        
        account.properties.forEach(property => {
            const item = document.createElement('div');
            item.className = 'property-item';
            item.style.cssText = 'padding: 15px; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.3s;';
            item.innerHTML = `
                <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${property.displayName}</div>
                <div style="font-size: 12px; color: #6b7280;">ID: ${property.propertyId}</div>
                ${property.industryCategory ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 3px;">업종: ${property.industryCategory}</div>` : ''}
            `;
            
            item.addEventListener('mouseenter', () => {
                item.style.borderColor = '#667eea';
                item.style.background = '#f9fafb';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = '#e5e7eb';
                item.style.background = 'white';
            });
            
            item.addEventListener('click', () => {
                // 모든 아이템 선택 해제
                document.querySelectorAll('.property-item').forEach(el => {
                    el.style.borderColor = '#e5e7eb';
                    el.style.background = 'white';
                });
                
                // 현재 아이템 선택
                item.style.borderColor = '#667eea';
                item.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
                
                selectProperty({
                    id: property.propertyId,
                    displayName: property.displayName
                });
            });
            
            propertiesContainer.appendChild(item);
        });
        
        propertyList.appendChild(propertiesContainer);
    });
    
    // 총 속성 수 표시
    const totalProperties = accounts.reduce((sum, acc) => sum + acc.properties.length, 0);
    const summary = document.createElement('div');
    summary.style.cssText = 'text-align: center; padding: 20px; color: #6b7280; font-size: 14px;';
    summary.innerHTML = `총 ${accounts.length}개 계정, ${totalProperties}개 속성`;
    propertyList.appendChild(summary);
}

function selectProperty(property) {
    // Update UI
    document.querySelectorAll('.property-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Store selection
    selectedPropertyId = property.id;
    document.getElementById('selectedPropertyName').textContent = property.displayName || property.id;
    
    // Show control section
    console.log('Showing control section for property:', property.id);
    controlSection.style.display = 'block';
    
    // 스크롤해서 보이게
    controlSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleManualPropertyInput() {
    let propertyId = document.getElementById('manualPropertyId').value.trim();
    if (!propertyId) {
        alert('속성 ID를 입력해주세요.');
        return;
    }
    
    // G-로 시작하면 경고
    if (propertyId.startsWith('G-')) {
        alert('⚠️ G-로 시작하는 것은 Measurement ID입니다.\n\nGA4 Property ID는 숫자로만 되어 있습니다.\n예: 123456789\n\nGoogle Analytics → 관리 → 속성 설정에서 확인하세요.');
        return;
    }
    
    // 숫자만 추출
    propertyId = propertyId.replace(/\D/g, '');
    
    if (!propertyId) {
        alert('올바른 Property ID를 입력해주세요. (숫자만)');
        return;
    }
    
    // Create property object
    const property = {
        id: propertyId,
        displayName: `Property ${propertyId}`
    };
    
    selectProperty(property);
    
    // 입력 필드 업데이트
    document.getElementById('manualPropertyId').value = propertyId;
}

// Date Controls
function handleDatePresetChange() {
    const preset = document.getElementById('datePreset').value;
    const customRange = document.getElementById('customDateRange');
    
    if (preset === 'custom') {
        customRange.style.display = 'flex';
    } else {
        customRange.style.display = 'none';
    }
}

// Data Fetching and Processing
async function fetchAndProcessData() {
    // 속성 ID 확인 - 여러 소스에서 확인
    let propertyId = selectedPropertyId || 
                    window.selectedPropertyId || 
                    sessionStorage.getItem('selectedPropertyId');
    
    if (!propertyId) {
        alert('❌ 속성이 선택되지 않았습니다!\n\n먼저 GA4 속성을 선택해주세요.\n\n속성 선택 화면으로 돌아갑니다.');
        
        // 속성 선택 화면으로 돌아가기
        propertySection.style.display = 'block';
        controlSection.style.display = 'none';
        return;
    }
    
    // 전역 변수에 확실히 저장
    selectedPropertyId = propertyId;
    window.selectedPropertyId = propertyId;
    
    // Show progress
    progressSection.style.display = 'block';
    resultsSection.style.display = 'none';
    updateProgress(10, 'GA4 데이터 가져오는 중...');
    
    try {
        // Get filter values
        const filters = {
            propertyId: propertyId, // 확인된 propertyId 변수 사용
            minPageviews: parseInt(document.getElementById('minPageviews').value) || 0,
            includePaths: document.getElementById('includePaths').value.split(',').filter(p => p.trim()),
            excludePaths: document.getElementById('excludePaths').value.split(',').filter(p => p.trim())
        };
        
        // Get date range
        const datePreset = document.getElementById('datePreset').value;
        if (datePreset === 'custom') {
            filters.startDate = document.getElementById('startDate').value;
            filters.endDate = document.getElementById('endDate').value;
        } else {
            filters.startDate = datePreset;
            filters.endDate = 'today';
        }
        
        // Fetch GA4 data
        updateProgress(30, '데이터 수집 중...');
        const fetchResponse = await fetch('/api/analytics/fetch-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
        });
        
        let fetchData;
        try {
            fetchData = await fetchResponse.json();
        } catch (parseError) {
            throw new Error('서버 응답을 읽을 수 없습니다.');
        }
        
        if (!fetchData.success) {
            throw new Error(fetchData.error || 'GA4 데이터 수집에 실패했습니다.');
        }
        
        if (!fetchData.data || fetchData.data.length === 0) {
            alert('⚠️ 설정된 필터 조건에 맞는 데이터가 없습니다.\n\n확인사항:\n1. 속성 ID가 올바른지 확인\n2. 날짜 범위에 데이터가 있는지 확인\n3. 최소 조회수 설정을 낮춰보세요');
            progressSection.style.display = 'none';
            return;
        }
        
        updateProgress(60, 'AI 한글 매핑 처리 중...');
        
        // Process with AI mapping
        const websiteContext = document.getElementById('websiteContext').value;
        const mappingResponse = await fetch('/api/analytics/process-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: fetchData.data,
                websiteContext,
                useCache: true
            })
        });
        
        const mappingData = await mappingResponse.json();
        
        if (!mappingData.success) {
            throw new Error(mappingData.error || 'Mapping failed');
        }
        
        updateProgress(90, '결과 준비 중...');
        
        // Store and display results
        currentData = mappingData.data;
        originalData = [...mappingData.data]; // 원본 데이터 보관
        displayResults(currentData);
        
        updateProgress(100, '완료!');
        setTimeout(() => {
            progressSection.style.display = 'none';
            resultsSection.style.display = 'block';
        }, 500);
        
    } catch (error) {
        console.error('데이터 처리 오류:', error);
        
        let errorMessage = '처리 중 오류가 발생했습니다:\n\n';
        
        if (error.message.includes('Property ID is required')) {
            errorMessage += '속성 ID가 전송되지 않았습니다.\n속성을 다시 선택해주세요.';
        } else if (error.message.includes('로그인')) {
            errorMessage += '구글 계정 인증이 만료되었습니다.\n페이지를 새로고침하여 다시 로그인해주세요.';
        } else if (error.message.includes('403') || error.message.includes('권한')) {
            errorMessage += '해당 GA4 속성에 접근 권한이 없습니다.\n올바른 속성 ID를 확인해주세요.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
        progressSection.style.display = 'none';
    }
}

function updateProgress(percent, message) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressMessage').textContent = message;
}

// Results Display
function displayResults(data) {
    // Update summary
    document.getElementById('totalUrls').textContent = data.length.toLocaleString();
    document.getElementById('totalPageviews').textContent = 
        data.reduce((sum, item) => sum + (item.pageviews || 0), 0).toLocaleString();
    document.getElementById('mappedCount').textContent = 
        data.filter(item => item.koreanPath).length.toLocaleString();
    
    // Update table
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';
    
    data.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="clickable-cell" title="${item.fullPath}" data-full-text="${item.fullPath}">
                <span class="cell-content">${truncateText(item.cleanPath || item.fullPath, 30)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth1 || ''}" data-full-text="${item.depth1 || ''}">
                <span class="cell-content">${truncateText(item.depth1 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth2 || ''}" data-full-text="${item.depth2 || ''}">
                <span class="cell-content">${truncateText(item.depth2 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth3 || ''}" data-full-text="${item.depth3 || ''}">
                <span class="cell-content">${truncateText(item.depth3 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth4 || ''}" data-full-text="${item.depth4 || ''}">
                <span class="cell-content">${truncateText(item.depth4 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth5 || ''}" data-full-text="${item.depth5 || ''}">
                <span class="cell-content">${truncateText(item.depth5 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth6 || ''}" data-full-text="${item.depth6 || ''}">
                <span class="cell-content">${truncateText(item.depth6 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth7 || ''}" data-full-text="${item.depth7 || ''}">
                <span class="cell-content">${truncateText(item.depth7 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth8 || ''}" data-full-text="${item.depth8 || ''}">
                <span class="cell-content">${truncateText(item.depth8 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth9 || ''}" data-full-text="${item.depth9 || ''}">
                <span class="cell-content">${truncateText(item.depth9 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.depth10 || ''}" data-full-text="${item.depth10 || ''}">
                <span class="cell-content">${truncateText(item.depth10 || '-', 15)}</span>
            </td>
            <td class="clickable-cell" title="${item.koreanPath || ''}" data-full-text="${item.koreanPath || ''}">
                <span class="cell-content">${truncateText(item.koreanPath || '-', 25)}</span>
            </td>
            <td>${(item.pageviews || 0).toLocaleString()}</td>
            <td>
                <button class="edit-btn" onclick="openMappingModal(${index})">수정</button>
            </td>
        `;
    });
    
    // Add click event listeners to clickable cells
    addCellClickListeners();
}

function filterTable() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#resultsBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Mapping Editor
function openMappingModal(index) {
    const item = currentData[index];
    // 10개 depth까지 모두 수집
    const path = [
        item.depth1, item.depth2, item.depth3, item.depth4, item.depth5,
        item.depth6, item.depth7, item.depth8, item.depth9, item.depth10
    ].filter(Boolean).join(' > ');
    
    document.getElementById('modalPath').textContent = path;
    document.getElementById('modalKorean').value = item.koreanPath || '';
    document.getElementById('modalKorean').dataset.index = index;
    
    mappingModal.style.display = 'flex';
}

function closeMappingModal() {
    mappingModal.style.display = 'none';
}

async function saveMappingEdit() {
    const index = document.getElementById('modalKorean').dataset.index;
    const newValue = document.getElementById('modalKorean').value;
    const item = currentData[index];
    
    // Update local data
    currentData[index].koreanPath = newValue;
    
    // Update server cache
    const paths = [item.depth1, item.depth2, item.depth3, item.depth4].filter(Boolean);
    for (const path of paths) {
        await fetch('/api/analytics/update-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, koreanValue: newValue })
        });
    }
    
    // Refresh display
    displayResults(currentData);
    closeMappingModal();
}

// 현재 테이블에 표시된 데이터 가져오기
function getCurrentTableData() {
    const table = document.getElementById('resultsTable');
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr:not([style*="display: none"])'); // 숨겨지지 않은 행만
    
    const tableData = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            // 행에서 데이터 추출
            const pagePath = cells[0].textContent.trim();
            
            // currentData에서 해당 행 찾기
            const dataItem = currentData.find(item => item.pagePath === pagePath);
            if (dataItem) {
                tableData.push(dataItem);
            }
        }
    });
    
    return tableData;
}

// Export Functions
async function exportData(format) {
    // currentData를 직접 사용 (테이블 DOM이 아닌 실제 데이터)
    if (!currentData || currentData.length === 0) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }
    
    console.log(`${format} 내보내기: currentData ${currentData.length}개 행`);
    
    // 현재 필터 상태 확인
    const isFiltered = document.getElementById('filterStatus') !== null;
    const statusMessage = isFiltered ? 
        `AI 처리된 ${currentData.length}개 URL을 내보냅니다.` : 
        `전체 ${currentData.length}개 URL을 내보냅니다.`;
    
    try {
        // 구글 시트의 경우 다른 처리
        if (format === 'sheets') {
            const button = document.getElementById('exportSheetsBtn');
            const originalText = button.textContent;
            button.textContent = '📋 시트 생성 중...';
            button.disabled = true;

            const response = await fetch(`/api/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    data: dataToExport,
                    title: `GA4 컨텐츠 그룹핑 결과_${new Date().toLocaleString('ko-KR')}`
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`서버 오류: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                alert(`구글 시트가 성공적으로 생성되었습니다!\n${result.rowCount}개 행이 추가되었습니다.`);
                // 새 탭에서 스프레드시트 열기
                window.open(result.spreadsheetUrl, '_blank');
            } else {
                throw new Error(result.error || '구글 시트 생성에 실패했습니다.');
            }

            button.textContent = originalText;
            button.disabled = false;
            return;
        }

        // Excel/CSV의 경우 기존 로직
        const response = await fetch(`/api/export/${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataToExport })
        });
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ga4-content-grouping-${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        
        let errorMessage = '내보내기 중 오류가 발생했습니다.';
        if (error.message.includes('로그인')) {
            errorMessage = '구글 계정 로그인이 필요합니다. 다시 로그인해주세요.';
        } else if (error.message.includes('권한')) {
            errorMessage = '구글 시트 접근 권한이 없습니다. 다시 로그인해주세요.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        alert(errorMessage);
        
        // 구글 시트 버튼 복원
        if (format === 'sheets') {
            const button = document.getElementById('exportSheetsBtn');
            button.textContent = '📋 구글 시트로 내보내기';
            button.disabled = false;
        }
    }
}

// Clipboard Copy Function
async function copyDataToClipboard() {
    // DEBUG: 현재 상태 확인
    console.log('\n=== 클립보드 복사 시작 ===');
    console.log(`currentData.length: ${currentData.length}`);
    console.log(`originalData.length: ${originalData.length}`);
    
    // 현재 currentData를 직접 사용하여 정확한 카운트 보장
    const dataToExport = currentData.filter(item => {
        // 검색 필터가 적용된 경우 필터된 데이터만
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        if (searchTerm) {
            return item.pagePath.toLowerCase().includes(searchTerm) || 
                   (item.koreanPath && item.koreanPath.toLowerCase().includes(searchTerm));
        }
        return true;
    });
    
    console.log(`복사할 데이터: ${dataToExport.length}개`);
    
    if (!dataToExport || dataToExport.length === 0) {
        alert('복사할 데이터가 없습니다.');
        return;
    }
    
    console.log(`클립보드 복사: 테이블 표시 데이터 ${dataToExport.length}개 행`);
    
    // 현재 필터 상태 확인
    const isFiltered = document.getElementById('filterStatus') !== null;

    try {
        const button = document.getElementById('copyDataBtn');
        const originalText = button.textContent;
        button.textContent = '📋 복사 중...';
        button.disabled = true;

        // 실제 테이블과 동일한 헤더 생성
        const headers = [
            'URL 경로',
            '1 Depth', '2 Depth', '3 Depth', '4 Depth', '5 Depth', 
            '6 Depth', '7 Depth', '8 Depth', '9 Depth', '10 Depth',
            '한글 경로',
            '조회수'
        ];
        
        // 데이터 행 생성 (탭으로 구분)
        const rows = [headers.join('\t')];
        
        dataToExport.forEach(item => {
            const row = [
                item.pagePath || '',
                item.depth1 || '-',
                item.depth2 || '-',
                item.depth3 || '-',
                item.depth4 || '-',
                item.depth5 || '-',
                item.depth6 || '-',
                item.depth7 || '-',
                item.depth8 || '-',
                item.depth9 || '-',
                item.depth10 || '-',
                item.koreanPath || '',
                (item.pageviews || 0).toLocaleString()
            ].join('\t');
            rows.push(row);
        });

        // 클립보드에 복사 (줄바꿈으로 행 구분)
        const clipboardText = rows.join('\n');
        
        await navigator.clipboard.writeText(clipboardText);
        
        // 성공 메시지
        button.textContent = '✅ 복사 완료!';
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
        }, 2000);

        // 사용자에게 안내
        const statusMessage = isFiltered ? 
            `AI 처리된 ${dataToExport.length}개 URL이 클립보드에 복사되었습니다!` : 
            `전체 ${dataToExport.length}개 URL이 클립보드에 복사되었습니다!`;
        alert(`${statusMessage}\n\n구글 시트나 Excel에서 Ctrl+V로 붙여넣기 하세요.`);

    } catch (error) {
        console.error('클립보드 복사 오류:', error);
        
        // 레거시 방식으로 재시도
        try {
            const textArea = document.createElement('textarea');
            const headers = [
                'URL 경로',
                '1 Depth', '2 Depth', '3 Depth', '4 Depth', '5 Depth', 
                '6 Depth', '7 Depth', '8 Depth', '9 Depth', '10 Depth',
                '한글 경로',
                '조회수'
            ];
            const rows = [headers.join('\t')];
            
            dataToExport.forEach(item => {
                const row = [
                    item.pagePath || '',
                    item.depth1 || '-',
                    item.depth2 || '-',
                    item.depth3 || '-',
                    item.depth4 || '-',
                    item.depth5 || '-',
                    item.depth6 || '-',
                    item.depth7 || '-',
                    item.depth8 || '-',
                    item.depth9 || '-',
                    item.depth10 || '-',
                    item.koreanPath || '',
                    (item.pageviews || 0).toLocaleString()
                ].join('\t');
                rows.push(row);
            });

            textArea.value = rows.join('\n');
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const statusMessage = isFiltered ? 
                `AI 처리된 ${dataToExport.length}개 URL이 클립보드에 복사되었습니다!` : 
                `전체 ${dataToExport.length}개 URL이 클립보드에 복사되었습니다!`;
            alert(`${statusMessage}\n\n구글 시트나 Excel에서 Ctrl+V로 붙여넣기 하세요.`);
            
        } catch (legacyError) {
            console.error('레거시 복사도 실패:', legacyError);
            alert('클립보드 복사에 실패했습니다. 브라우저가 복사 기능을 지원하지 않을 수 있습니다.');
        }
        
        // 버튼 복원
        const button = document.getElementById('copyDataBtn');
        button.textContent = '📋 클립보드 복사';
        button.disabled = false;
    }
}

async function clearMappingCache() {
    if (!confirm('모든 한글 매핑 캐시를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/analytics/mappings', {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('캐시가 초기화되었습니다.');
        }
    } catch (error) {
        console.error('Cache clear error:', error);
    }
}

// Logout function
async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 페이지 새로고침으로 초기 상태로 돌아가기
            window.location.reload();
        } else {
            alert('로그아웃 실패: ' + data.error);
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
}

// AI Processing Functions
let aiClassificationResults = null;
let aiGroupingResults = null;

async function classifyWithAI() {
    if (!currentData || currentData.length === 0) {
        alert('먼저 데이터를 가져와주세요.');
        return;
    }
    
    const urls = currentData.map(item => item.pagePath);
    const websiteContext = document.getElementById('websiteContext').value;
    
    showAIProcessing('개인화 페이지 분류 중...');
    
    try {
        const response = await fetch('/api/url-processor/classify-personalized', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, websiteContext })
        });
        
        const result = await response.json();
        
        if (result.success) {
            aiClassificationResults = result;
            displayClassificationResults(result);
            document.getElementById('aiResults').style.display = 'block';
            switchTab('classification');
        } else {
            alert('분류 실패: ' + result.error);
        }
    } catch (error) {
        console.error('AI classification error:', error);
        alert('AI 분류 중 오류가 발생했습니다.');
    } finally {
        hideAIProcessing();
    }
}

async function groupWithPath() {
    if (!currentData || currentData.length === 0) {
        alert('먼저 데이터를 가져와주세요.');
        return;
    }
    
    const urls = currentData.map(item => item.pagePath);
    
    showAIProcessing('Path 패턴 분석 중...');
    
    try {
        const response = await fetch('/api/url-processor/group-by-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
        });
        
        const result = await response.json();
        
        if (result.success) {
            aiGroupingResults = result;
            displayGroupingResults(result);
            document.getElementById('aiResults').style.display = 'block';
            switchTab('grouping');
        } else {
            alert('그룹핑 실패: ' + result.error);
        }
    } catch (error) {
        console.error('Path grouping error:', error);
        alert('Path 그룹핑 중 오류가 발생했습니다.');
    } finally {
        hideAIProcessing();
    }
}

async function processAllWithAI() {
    if (!currentData || currentData.length === 0) {
        alert('먼저 데이터를 가져와주세요.');
        return;
    }
    
    const urls = currentData.map(item => item.pagePath);
    const websiteContext = document.getElementById('websiteContext').value || 
                            '파라다이스시티 호텔 및 카지노 리조트 웹사이트';
    
    showAIProcessing('AI URL 분석 및 정리 중...');
    
    try {
        const response = await fetch('/api/url-processor/process-with-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                urls, 
                websiteContext
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayProcessedResults(result);
            document.getElementById('aiResults').style.display = 'block';
        } else {
            alert('처리 실패: ' + result.error);
        }
    } catch (error) {
        console.error('AI processing error:', error);
        alert('AI 처리 중 오류가 발생했습니다.');
    } finally {
        hideAIProcessing();
    }
}

function displayClassificationResults(result) {
    const personalizedBox = document.querySelector('#classificationResults .result-box:first-child');
    const generalBox = document.querySelector('#classificationResults .result-box:last-child');
    
    // Update counts
    personalizedBox.querySelector('.url-count').textContent = result.personalized.count;
    generalBox.querySelector('.url-count').textContent = result.general.count;
    
    // Display personalized URLs
    const personalizedList = personalizedBox.querySelector('.url-list');
    personalizedList.innerHTML = result.personalized.urls
        .slice(0, 50)
        .map(url => `<div style="padding: 2px 0; color: #6b7280; font-size: 12px;">${url}</div>`)
        .join('');
    
    // Display general URLs
    const generalList = generalBox.querySelector('.url-list');
    generalList.innerHTML = result.general.urls
        .slice(0, 50)
        .map(url => `<div style="padding: 2px 0; color: #6b7280; font-size: 12px;">${url}</div>`)
        .join('');
}

function displayGroupingResults(result) {
    document.getElementById('groupCount').textContent = result.groupCount;
    document.getElementById('groupedUrlCount').textContent = result.totalUrls;
    
    const groupList = document.querySelector('#groupingResults .group-list');
    groupList.innerHTML = '';
    
    Object.entries(result.groups).forEach(([pattern, group]) => {
        const groupDiv = document.createElement('div');
        groupDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; background: white; border-radius: 8px;';
        groupDiv.innerHTML = `
            <div style="font-weight: bold; color: #1f2937;">패턴: ${pattern}</div>
            <div style="color: #6b7280; font-size: 14px;">
                URL 수: ${group.count} | 카테고리: ${group.category} | Depth: ${group.depth}
            </div>
            <div style="margin-top: 5px; max-height: 100px; overflow-y: auto;">
                ${group.urls.slice(0, 5).map(url => 
                    `<div style="font-size: 12px; color: #9ca3af; padding: 2px 0;">${url}</div>`
                ).join('')}
                ${group.urls.length > 5 ? `<div style="font-size: 12px; color: #9ca3af;">... 외 ${group.urls.length - 5}개</div>` : ''}
            </div>
        `;
        groupList.appendChild(groupDiv);
    });
}

function displayProcessedResults(result) {
    // Create summary display
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'padding: 20px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; margin: 20px 0;';
    
    // Show processed URLs as a simple list
    let html = `
        <h4 style="color: #065f46; margin-bottom: 15px;">✅ AI URL 분석 완료</h4>
        <div style="margin-bottom: 15px; color: #047857; font-size: 16px;">
            <strong>원본:</strong> ${result.originalCount}개 URL → 
            <strong>정리 후:</strong> ${result.processedCount}개 URL
            <span style="color: #dc2626; margin-left: 10px;">
                (🔥 ${result.originalCount - result.processedCount}개 제거됨)
            </span>
        </div>
        <div style="color: #059669; margin-bottom: 10px;">
            사용자별 변수가 있는 URL들이 자동으로 그룹화되었습니다.
        </div>
    `;
    
    // Add button to filter table
    html += `
        <button id="filterProcessedBtn" class="btn btn-primary" style="margin-top: 10px;">
            🔍 처리된 URL만 테이블에 표시 (${result.processedCount}개)
        </button>
        <button id="showAllBtn" class="btn btn-secondary" style="margin-top: 10px; margin-left: 10px; display: none;">
            📋 전체 URL 보기
        </button>
    `;
    
    // Show removed URLs if any
    if (result.removedUrls && result.removedUrls.length > 0) {
        html += `
            <details style="margin-top: 15px; background: #fee2e2; padding: 10px; border-radius: 6px;">
                <summary style="cursor: pointer; color: #991b1b; font-weight: 500;">
                    🚫 그룹화로 제거된 URL 보기 (${result.removedUrls.length}개)
                </summary>
                <div style="margin-top: 10px; background: white; padding: 10px; border-radius: 6px; max-height: 300px; overflow-y: auto;">
        `;
        
        // Group removed URLs by representative
        const groupedRemoved = {};
        result.removedUrls.forEach(item => {
            if (!groupedRemoved[item.representative]) {
                groupedRemoved[item.representative] = [];
            }
            groupedRemoved[item.representative].push(item.url);
        });
        
        Object.entries(groupedRemoved).forEach(([rep, urls]) => {
            html += `
                <div style="margin-bottom: 15px; padding: 10px; background: #fef2f2; border-radius: 4px;">
                    <div style="font-weight: bold; color: #7f1d1d; margin-bottom: 5px;">
                        🎯 대표 URL: ${rep}
                    </div>
                    <div style="font-size: 12px; color: #991b1b; margin-bottom: 5px;">
                        제거된 URL (${urls.length}개):
                    </div>
            `;
            urls.slice(0, 5).forEach(url => {
                html += `<div style="padding: 2px 0 2px 20px; font-size: 11px; color: #b91c1c; font-family: monospace;">• ${url}</div>`;
            });
            if (urls.length > 5) {
                html += `<div style="padding: 2px 0 2px 20px; font-size: 11px; color: #b91c1c;">... 외 ${urls.length - 5}개</div>`;
            }
            html += `</div>`;
        });
        
        html += `
                </div>
            </details>
        `;
    }
    
    // Show processed URL list (first 50)
    if (result.result && result.result.length > 0) {
        html += `
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #065f46; font-weight: 500;">
                    ✅ 최종 정리된 URL 목록 (${result.result.length}개)
                </summary>
                <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 6px; max-height: 300px; overflow-y: auto;">
        `;
        
        result.result.slice(0, 50).forEach(url => {
            html += `<div style="padding: 5px; border-bottom: 1px solid #f3f4f6; font-family: monospace; font-size: 13px;">${url}</div>`;
        });
        
        if (result.result.length > 50) {
            html += `<div style="padding: 10px; color: #6b7280; text-align: center;">... 외 ${result.result.length - 50}개</div>`;
        }
        
        html += `
                </div>
            </details>
        `;
    }
    
    summaryDiv.innerHTML = html;
    
    // Clear previous results and show new ones
    const aiResults = document.getElementById('aiResults');
    aiResults.innerHTML = '';
    aiResults.appendChild(summaryDiv);
    aiResults.style.display = 'block';
    
    // Store processed URLs for filtering
    window.processedUrls = result.result || [];
    
    console.log('AI 처리 결과 저장:', {
        totalProcessedUrls: window.processedUrls.length,
        sampleUrls: window.processedUrls.slice(0, 3),
        currentDataLength: currentData.length
    });
    
    // Add event listeners to filter buttons
    setTimeout(() => {
        const filterBtn = document.getElementById('filterProcessedBtn');
        const showAllBtn = document.getElementById('showAllBtn');
        
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                filterTableByProcessedUrls();
                filterBtn.style.display = 'none';
                showAllBtn.style.display = 'inline-block';
            });
        }
        
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                // 원본 데이터로 복원
                currentData = [...originalData];
                displayResults(currentData);
                showAllBtn.style.display = 'none';
                filterBtn.style.display = 'inline-block';
                
                // 필터 상태 제거
                const filterStatus = document.getElementById('filterStatus');
                if (filterStatus) {
                    filterStatus.remove();
                }
                
                console.log('전체 URL 보기:', {
                    복원된데이터: currentData.length,
                    원본데이터: originalData.length
                });
            });
        }
    }, 100);
    
    // Update current data with processed URLs - 이게 핵심!
    if (result.result && Array.isArray(result.result)) {
        console.log(`\n=== AI 처리 결과 확인 ===`);
        console.log(`AI 결과 URL 개수: ${result.result.length}`);
        console.log(`현재 데이터 개수: ${currentData.length}`);
        console.log(`원본 데이터 개수: ${originalData.length}`);
        
        // CRITICAL: Show sample URLs from AI result
        console.log(`AI 결과 샘플 URLs (처음 10개):`);
        result.result.slice(0, 10).forEach((url, idx) => {
            console.log(`  ${idx + 1}. ${url}`);
        });
        
        // currentData를 AI 처리 결과로 필터링하여 업데이트
        const beforeFilter = currentData.length;
        
        // DEBUG: 매칭 확인
        console.log('\n=== 매칭 확인 ===');
        const matchedPaths = [];
        const unmatchedFromResult = [];
        const unmatchedFromData = [];
        
        // AI 결과에 있는 패스들
        result.result.forEach(aiPath => {
            const found = currentData.find(item => item.pagePath === aiPath);
            if (found) {
                matchedPaths.push(aiPath);
            } else {
                unmatchedFromResult.push(aiPath);
            }
        });
        
        // currentData에서 AI 결과에 없는 것들
        currentData.forEach(item => {
            if (!result.result.includes(item.pagePath)) {
                unmatchedFromData.push(item.pagePath);
            }
        });
        
        console.log(`매칭된 경로: ${matchedPaths.length}개`);
        console.log(`AI결과에 있지만 데이터에 없음: ${unmatchedFromResult.length}개`);
        console.log(`데이터에 있지만 AI결과에 없음: ${unmatchedFromData.length}개`);
        
        // 샘플 출력
        if (unmatchedFromResult.length > 0) {
            console.log('AI결과에만 있는 샘플:', unmatchedFromResult.slice(0, 3));
        }
        if (unmatchedFromData.length > 0) {
            console.log('데이터에만 있는 샘플:', unmatchedFromData.slice(0, 3));
        }
        
        currentData = currentData.filter(item => 
            result.result.includes(item.pagePath)
        );
        
        console.log(`\n=== 필터링 후 결과 ===`);
        console.log(`필터링 전: ${beforeFilter}개`);
        console.log(`AI 결과: ${result.result.length}개`);
        console.log(`필터링 후: ${currentData.length}개`);
        
        // 심각한 데이터 손실이 있는 경우 경고
        if (currentData.length < originalData.length * 0.1) {
            console.error(`⚠️ 심각한 데이터 손실 감지!`);
            console.error(`원본: ${originalData.length}개 → 최종: ${currentData.length}개 (${Math.round(currentData.length/originalData.length*100)}%만 남음)`);
        }
        
        // 테이블 다시 표시
        displayResults(currentData);
    }
}

function applyAIClassification() {
    if (!aiClassificationResults) {
        alert('먼저 AI 분류를 실행해주세요.');
        return;
    }
    
    // Filter out personalized URLs from current data
    const generalUrls = aiClassificationResults.general.urls;
    currentData = currentData.filter(item => generalUrls.includes(item.pagePath));
    
    // Refresh table
    displayResults(currentData);
    
    alert(`개인화 페이지 ${aiClassificationResults.personalized.count}개가 제외되었습니다.`);
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const tabMap = {
        'classification': 'classificationResults',
        'grouping': 'groupingResults',
        'duplicates': 'duplicateResults'
    };
    
    const targetTab = document.getElementById(tabMap[tabName]);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
}

function showAIProcessing(message) {
    const progressSection = document.getElementById('progressSection');
    const progressMessage = document.getElementById('progressMessage');
    
    progressSection.style.display = 'block';
    progressMessage.textContent = message;
}

function hideAIProcessing() {
    document.getElementById('progressSection').style.display = 'none';
}

// Text truncation helper
function truncateText(text, maxLength) {
    if (!text || text === '-') return text;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Add click listeners to table cells
function addCellClickListeners() {
    const clickableCells = document.querySelectorAll('.clickable-cell');
    clickableCells.forEach(cell => {
        cell.addEventListener('click', function() {
            const fullText = this.getAttribute('data-full-text');
            const cellContent = this.querySelector('.cell-content');
            
            if (!fullText || fullText === '' || fullText === '-') {
                return;
            }
            
            // Toggle between truncated and full text
            if (this.classList.contains('expanded')) {
                // Collapse
                const originalLength = fullText === this.getAttribute('title') ? 30 : 15;
                if (this.querySelector('.cell-content').textContent.includes('한글')) {
                    // Korean text gets more space
                    cellContent.textContent = truncateText(fullText, 25);
                } else {
                    cellContent.textContent = truncateText(fullText, originalLength);
                }
                this.classList.remove('expanded');
                this.style.background = '';
                this.style.border = '';
            } else {
                // Expand
                cellContent.textContent = fullText;
                this.classList.add('expanded');
                this.style.background = '#f0f9ff';
                this.style.border = '2px solid #0ea5e9';
            }
        });
        
        // Add hover effect
        cell.addEventListener('mouseenter', function() {
            if (!this.classList.contains('expanded')) {
                this.style.background = '#f9fafb';
                this.style.cursor = 'pointer';
            }
        });
        
        cell.addEventListener('mouseleave', function() {
            if (!this.classList.contains('expanded')) {
                this.style.background = '';
            }
        });
    });
}

// Manual input toggle functions
function showManualInput() {
    document.getElementById('manualInputSection').style.display = 'block';
    document.getElementById('toggleManualInput').style.display = 'none';
}

function hideManualInput() {
    document.getElementById('manualInputSection').style.display = 'none';
    document.getElementById('toggleManualInput').style.display = 'inline-block';
    // 입력 필드 이기화
    document.getElementById('manualPropertyId').value = '';
}

function showManualInputOnError() {
    // 오류시 버튼 숨기고 직접 입력 섹션 바로 보이기
    document.getElementById('toggleManualInput').style.display = 'none';
    document.getElementById('manualInputSection').style.display = 'block';
}

// Filter table to show only processed URLs
function filterTableByProcessedUrls() {
    if (!window.processedUrls || window.processedUrls.length === 0) {
        alert('처리된 URL이 없습니다.');
        return;
    }
    
    console.log('필터링: AI 처리된 URL만 표시', {
        currentDataCount: currentData.length,
        processedUrlsCount: window.processedUrls.length
    });
    
    // AI 처리 후에는 currentData 자체가 이미 처리된 URL만 포함
    // 따라서 별도 필터링이 필요없고, 그냥 현재 데이터 표시
    displayResults(currentData);
    
    // Update summary to show filtered status
    const summarySection = document.querySelector('.result-summary');
    if (summarySection) {
        const filterStatus = document.createElement('div');
        filterStatus.id = 'filterStatus';
        filterStatus.style.cssText = 'padding: 10px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; margin: 10px 0; text-align: center;';
        filterStatus.innerHTML = `🔍 <strong>필터 적용됨:</strong> AI 처리된 ${filteredData.length}개 URL만 표시 중`;
        
        // Remove existing filter status if any
        const existingStatus = document.getElementById('filterStatus');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        summarySection.appendChild(filterStatus);
    }
}