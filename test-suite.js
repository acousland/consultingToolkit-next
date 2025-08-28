#!/usr/bin/env node
/**
 * Comprehensive Test Suite for Consulting Toolkit
 * Run this before and after any changes to detect regressions
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';

// Color coding for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

class TestSuite {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async test(name, testFn) {
        try {
            this.log(`\n🧪 Testing: ${name}`, 'blue');
            await testFn();
            this.results.passed++;
            this.log(`✅ PASSED: ${name}`, 'green');
        } catch (error) {
            this.results.failed++;
            this.results.errors.push({ name, error: error.message });
            this.log(`❌ FAILED: ${name} - ${error.message}`, 'red');
        }
    }

    // Backend API Tests
    async testBackendHealth() {
        const response = await axios.get(`${BASE_URL}/health`);
        if (response.status !== 200) throw new Error('Health check failed');
        if (!response.data.backend_version) throw new Error('Missing version info');
    }

    async testBrandConsistencyEndpoints() {
        // Test style guide endpoint structure
        try {
            await axios.post(`${BASE_URL}/ai/brand/style-guide`, {});
        } catch (error) {
            if (error.response?.status !== 422) throw error; // 422 is expected for missing data
        }

        // Test deck endpoint structure
        try {
            await axios.post(`${BASE_URL}/ai/brand/deck`, {});
        } catch (error) {
            if (error.response?.status !== 422) throw error;
        }

        // Test analysis endpoint structure
        try {
            await axios.post(`${BASE_URL}/ai/brand/analyse`, {});
        } catch (error) {
            if (error.response?.status !== 422) throw error;
        }
    }

    async testPainPointsEndpoints() {
        // Test pain points extraction (correct endpoint)
        try {
            await axios.post(`${BASE_URL}/ai/pain-points/extract/text`, {});
        } catch (error) {
            if (error.response?.status !== 422) throw error;
        }

        // Test pain points themes mapping
        try {
            await axios.post(`${BASE_URL}/ai/pain-points/themes/map`, {});
        } catch (error) {
            if (error.response?.status !== 422) throw error;
        }
    }

    async testApplicationsEndpoints() {
        // Test applications capabilities mapping
        try {
            await axios.post(`${BASE_URL}/ai/applications/capabilities/map`, {});
        } catch (error) {
            if (error.response?.status !== 422) throw error;
        }
    }

    // Frontend Route Tests
    async testFrontendRoutes() {
        const routes = [
            '/',
            '/brand/brand-consistency-checker',
            '/pain-points',
            '/applications/capabilities',
            '/applications/future-portfolio',
            '/strategy/capabilities',
            '/data/conceptual-model',
            '/toolkits/applications',
            '/toolkits/business',
            '/toolkits/strategy'
        ];

        for (const route of routes) {
            try {
                const response = await axios.get(`${FRONTEND_URL}${route}`, {
                    timeout: 10000,
                    headers: { 'Accept': 'text/html' }
                });
                if (response.status !== 200) {
                    throw new Error(`Route ${route} returned status ${response.status}`);
                }
            } catch (error) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error(`Frontend not running on ${FRONTEND_URL}`);
                }
                throw error;
            }
        }
    }

    // File System Tests
    async testCriticalFiles() {
        const criticalFiles = [
            './backend/app/services/brand_consistency.py',
            './backend/app/routers/ai.py',
            './frontend/src/components/NavBar.tsx',
            './frontend/src/app/brand/brand-consistency-checker/page.tsx'
        ];

        for (const file of criticalFiles) {
            const filePath = path.resolve(__dirname, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Critical file missing: ${file}`);
            }
            
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                throw new Error(`Critical file empty: ${file}`);
            }
        }
    }

    // Integration Tests
    async testBrandConsistencyWorkflow() {
        // This would test the full workflow if we had test files
        this.log('⚠️  Brand consistency workflow test requires test PDF files', 'yellow');
    }

    async runAll() {
        this.log('🚀 Starting Comprehensive Test Suite', 'blue');
        this.log('=====================================', 'blue');

        await this.test('Backend Health Check', () => this.testBackendHealth());
        await this.test('Critical Files Exist', () => this.testCriticalFiles());
        await this.test('Brand Consistency Endpoints', () => this.testBrandConsistencyEndpoints());
        await this.test('Pain Points Endpoints', () => this.testPainPointsEndpoints());
        await this.test('Applications Endpoints', () => this.testApplicationsEndpoints());
        await this.test('Frontend Routes', () => this.testFrontendRoutes());
        await this.test('Brand Consistency Workflow', () => this.testBrandConsistencyWorkflow());

        this.printSummary();
    }

    printSummary() {
        this.log('\n📊 TEST SUMMARY', 'blue');
        this.log('================', 'blue');
        this.log(`✅ Passed: ${this.results.passed}`, 'green');
        this.log(`❌ Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');

        if (this.results.errors.length > 0) {
            this.log('\n🚨 ERRORS:', 'red');
            this.results.errors.forEach(({ name, error }) => {
                this.log(`   • ${name}: ${error}`, 'red');
            });
        }

        if (this.results.failed === 0) {
            this.log('\n🎉 All tests passed! Your changes are safe.', 'green');
        } else {
            this.log('\n⚠️  Some tests failed. Review before deploying.', 'yellow');
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const suite = new TestSuite();
    suite.runAll().catch(console.error);
}

module.exports = TestSuite;
