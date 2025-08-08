class DataProcessor {
    processData(rawData, filters = {}) {
        let processedData = [...rawData];

        // Apply minimum pageviews filter
        if (filters.minPageviews && filters.minPageviews > 0) {
            processedData = processedData.filter(item => 
                item.pageviews >= filters.minPageviews
            );
        }

        // Apply include paths filter
        if (filters.includePaths && filters.includePaths.length > 0) {
            const includePatterns = filters.includePaths.map(pattern => 
                new RegExp(pattern, 'i')
            );
            processedData = processedData.filter(item =>
                includePatterns.some(pattern => pattern.test(item.pagePath))
            );
        }

        // Apply exclude paths filter
        if (filters.excludePaths && filters.excludePaths.length > 0) {
            const excludePatterns = filters.excludePaths.map(pattern => 
                new RegExp(pattern, 'i')
            );
            processedData = processedData.filter(item =>
                !excludePatterns.some(pattern => pattern.test(item.pagePath))
            );
        }

        // Remove duplicates and aggregate pageviews
        const aggregated = this.aggregateDuplicates(processedData);

        // Sort by pageviews descending
        aggregated.sort((a, b) => b.pageviews - a.pageviews);

        return aggregated;
    }

    aggregateDuplicates(data) {
        const aggregated = new Map();

        data.forEach(item => {
            const key = item.pagePath;
            
            if (aggregated.has(key)) {
                const existing = aggregated.get(key);
                existing.pageviews += item.pageviews;
                // Keep the most common page title
                if (item.pageTitle && item.pageTitle !== '(not set)') {
                    existing.pageTitle = item.pageTitle;
                }
            } else {
                aggregated.set(key, { ...item });
            }
        });

        return Array.from(aggregated.values());
    }

    cleanPageTitle(title) {
        if (!title || title === '(not set)') {
            return '';
        }

        // Remove common suffixes
        let cleaned = title;
        const suffixPatterns = [
            / - .+$/,  // Remove everything after " - "
            / \| .+$/,  // Remove everything after " | "
            / – .+$/,  // Remove everything after " – " (en dash)
            / — .+$/,  // Remove everything after " — " (em dash)
        ];

        for (const pattern of suffixPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        return cleaned.trim();
    }

    validateData(data) {
        const errors = [];
        const warnings = [];

        if (!Array.isArray(data)) {
            errors.push('Data must be an array');
            return { valid: false, errors, warnings };
        }

        if (data.length === 0) {
            warnings.push('No data to process');
        }

        // Check for required fields
        const sampleItem = data[0];
        if (sampleItem) {
            if (!sampleItem.pagePath) {
                errors.push('Missing required field: pagePath');
            }
            if (!sampleItem.pageviews && sampleItem.pageviews !== 0) {
                warnings.push('Missing pageviews data');
            }
        }

        // Check for suspicious patterns
        const suspiciousUrls = data.filter(item => 
            item.pagePath && (
                item.pagePath.includes('admin') ||
                item.pagePath.includes('api') ||
                item.pagePath.includes('wp-') ||
                item.pagePath.includes('test')
            )
        );

        if (suspiciousUrls.length > 0) {
            warnings.push(`Found ${suspiciousUrls.length} potentially system/admin URLs`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    enrichData(data) {
        return data.map(item => {
            const enriched = { ...item };

            // Add cleaned page title
            enriched.cleanedTitle = this.cleanPageTitle(item.pageTitle);

            // Add URL validation flag
            enriched.isValidForAnalysis = this.isValidForAnalysis(item.pagePath);

            // Add engagement level based on pageviews
            if (item.pageviews > 1000) {
                enriched.engagementLevel = 'High';
            } else if (item.pageviews > 100) {
                enriched.engagementLevel = 'Medium';
            } else {
                enriched.engagementLevel = 'Low';
            }

            return enriched;
        });
    }

    isValidForAnalysis(pagePath) {
        if (!pagePath) return false;

        // Exclude system/resource URLs
        const excludePatterns = [
            /\.(js|css|jpg|jpeg|png|gif|svg|ico|webp|pdf|xml|json|txt)$/i,
            /^\/api\//,
            /^\/admin\//,
            /^\/wp-/,
            /^\/_/,
            /^\/\./
        ];

        for (const pattern of excludePatterns) {
            if (pattern.test(pagePath)) {
                return false;
            }
        }

        return true;
    }

    groupByCategory(data) {
        const grouped = {};

        data.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });

        return grouped;
    }

    calculateMetrics(data) {
        const metrics = {
            totalUrls: data.length,
            totalPageviews: 0,
            averagePageviews: 0,
            medianPageviews: 0,
            uniqueDepth1: new Set(),
            uniqueDepth2: new Set(),
            pageviewsDistribution: {
                '0-10': 0,
                '11-50': 0,
                '51-100': 0,
                '101-500': 0,
                '501-1000': 0,
                '1000+': 0
            }
        };

        const pageviewsArray = [];

        data.forEach(item => {
            const views = item.pageviews || 0;
            metrics.totalPageviews += views;
            pageviewsArray.push(views);

            // Track unique depths
            if (item.depth1) metrics.uniqueDepth1.add(item.depth1);
            if (item.depth2) metrics.uniqueDepth2.add(item.depth2);

            // Distribution
            if (views <= 10) metrics.pageviewsDistribution['0-10']++;
            else if (views <= 50) metrics.pageviewsDistribution['11-50']++;
            else if (views <= 100) metrics.pageviewsDistribution['51-100']++;
            else if (views <= 500) metrics.pageviewsDistribution['101-500']++;
            else if (views <= 1000) metrics.pageviewsDistribution['501-1000']++;
            else metrics.pageviewsDistribution['1000+']++;
        });

        // Calculate average
        metrics.averagePageviews = metrics.totalUrls > 0 
            ? Math.round(metrics.totalPageviews / metrics.totalUrls)
            : 0;

        // Calculate median
        pageviewsArray.sort((a, b) => a - b);
        const mid = Math.floor(pageviewsArray.length / 2);
        metrics.medianPageviews = pageviewsArray.length % 2 === 0
            ? Math.round((pageviewsArray[mid - 1] + pageviewsArray[mid]) / 2)
            : pageviewsArray[mid];

        // Convert Sets to counts
        metrics.uniqueDepth1Count = metrics.uniqueDepth1.size;
        metrics.uniqueDepth2Count = metrics.uniqueDepth2.size;
        delete metrics.uniqueDepth1;
        delete metrics.uniqueDepth2;

        return metrics;
    }
}

module.exports = new DataProcessor();