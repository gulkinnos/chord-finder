const axios = require('axios');
const { songOperations } = require('./db/database');

const BASE_URL = 'http://localhost:3000';
let testResults = [];
let testSongId = null;
let testShareId = null;

// Helper function to log test results
function logTest(testName, passed, message = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const result = `${status} - ${testName}${message ? ': ' + message : ''}`;
    console.log(result);
    testResults.push({ testName, passed, message });
}

// Helper function to make HTTP requests
async function makeRequest(method, url, data = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${url}`,
            timeout: 10000
        };
        
        if (data) {
            config.data = data;
            config.headers = { 'Content-Type': 'application/json' };
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status || 500
        };
    }
}

// Test 1: Database Operations
async function testDatabaseOperations() {
    console.log('\n🗄️  Testing Database Operations...');
    
    try {
        // Test song creation
        const songData = {
            title: 'Test Song',
            artist: 'Test Artist',
            chord_content: 'Am F C G\nTest chord progression',
            source_url: 'https://example.com/test',
            personal_notes: 'Test notes'
        };
        
        const createResult = songOperations.create(songData);
        testSongId = createResult.id;
        testShareId = createResult.share_id;
        
        logTest('Database - Create Song', 
            createResult.id && createResult.share_id,
            `ID: ${createResult.id}, Share ID: ${createResult.share_id}`
        );
        
        // Test get by ID
        const getResult = songOperations.getById(testSongId);
        logTest('Database - Get Song by ID', 
            getResult && getResult.title === songData.title
        );
        
        // Test get by share ID
        const getByShareResult = songOperations.getByShareId(testShareId);
        logTest('Database - Get Song by Share ID', 
            getByShareResult && getByShareResult.id === testSongId
        );
        
        // Test update
        const updateData = { ...songData, title: 'Updated Test Song' };
        const updateResult = songOperations.update(testSongId, updateData);
        logTest('Database - Update Song', updateResult === true);
        
        // Test search
        const searchResult = songOperations.search('Updated');
        logTest('Database - Search Songs', 
            searchResult.length > 0 && searchResult[0].title.includes('Updated')
        );
        
        // Test get all
        const allSongs = songOperations.getAll();
        logTest('Database - Get All Songs', 
            Array.isArray(allSongs) && allSongs.length > 0
        );
        
    } catch (error) {
        logTest('Database Operations', false, error.message);
    }
}

// Test 2: API Endpoints
async function testAPIEndpoints() {
    console.log('\n🌐 Testing API Endpoints...');
    
    // Test chord search
    const searchResult = await makeRequest('GET', '/api/chords?q=wonderwall');
    logTest('API - Chord Search', 
        searchResult.success && searchResult.data.results,
        searchResult.success ? `Found ${searchResult.data.results.length} results` : searchResult.error
    );
    
    // Test Russian chord search
    const russianSearchResult = await makeRequest('GET', '/api/chords?q=кино');
    logTest('API - Russian Chord Search', 
        russianSearchResult.success && russianSearchResult.data.results,
        russianSearchResult.success ? `Found ${russianSearchResult.data.results.length} results` : russianSearchResult.error
    );
    
    // Test chord extraction
    const extractResult = await makeRequest('POST', '/api/extract-chords', {
        url: 'https://www.ultimate-guitar.com/tab/oasis/wonderwall-chords-1112'
    });
    logTest('API - Chord Extraction', 
        extractResult.success && extractResult.data.chord_content,
        extractResult.success ? 'Content extracted' : extractResult.error
    );
    
    // Test save song via API
    const saveData = {
        title: 'API Test Song',
        artist: 'API Test Artist',
        chord_content: 'C G Am F\nAPI test progression',
        source_url: 'https://example.com/api-test',
        personal_notes: 'API test notes'
    };
    
    const saveResult = await makeRequest('POST', '/api/songs', saveData);
    let apiTestSongId = null;
    if (saveResult.success) {
        apiTestSongId = saveResult.data.id;
    }
    
    logTest('API - Save Song', 
        saveResult.success && saveResult.data.id,
        saveResult.success ? `Song ID: ${saveResult.data.id}` : saveResult.error
    );
    
    // Test get all songs via API
    const getAllResult = await makeRequest('GET', '/api/songs');
    logTest('API - Get All Songs', 
        getAllResult.success && Array.isArray(getAllResult.data.songs),
        getAllResult.success ? `Found ${getAllResult.data.songs.length} songs` : getAllResult.error
    );
    
    // Test get song by ID via API
    if (apiTestSongId) {
        const getByIdResult = await makeRequest('GET', `/api/songs/${apiTestSongId}`);
        logTest('API - Get Song by ID', 
            getByIdResult.success && getByIdResult.data.song,
            getByIdResult.success ? 'Song retrieved' : getByIdResult.error
        );
        
        // Test update song via API
        const updateData = { ...saveData, title: 'Updated API Test Song' };
        const updateResult = await makeRequest('PUT', `/api/songs/${apiTestSongId}`, updateData);
        logTest('API - Update Song', 
            updateResult.success,
            updateResult.success ? 'Song updated' : updateResult.error
        );
        
        // Test delete song via API
        const deleteResult = await makeRequest('DELETE', `/api/songs/${apiTestSongId}`);
        logTest('API - Delete Song', 
            deleteResult.success,
            deleteResult.success ? 'Song deleted' : deleteResult.error
        );
    }
    
    // Test search saved songs via API
    const searchSavedResult = await makeRequest('GET', '/api/search?q=Test');
    logTest('API - Search Saved Songs', 
        searchSavedResult.success && Array.isArray(searchSavedResult.data.songs),
        searchSavedResult.success ? `Found ${searchSavedResult.data.songs.length} matching songs` : searchSavedResult.error
    );
}

// Test 3: Share Functionality
async function testShareFunctionality() {
    console.log('\n📤 Testing Share Functionality...');
    
    if (testShareId) {
        const shareResult = await makeRequest('GET', `/share/${testShareId}`);
        logTest('Share - Get Shared Song', 
            shareResult.success && shareResult.status === 200,
            shareResult.success ? 'Share page loaded' : shareResult.error
        );
    } else {
        logTest('Share - Get Shared Song', false, 'No test share ID available');
    }
    
    // Test invalid share ID
    const invalidShareResult = await makeRequest('GET', '/share/invalid-id');
    logTest('Share - Invalid Share ID', 
        invalidShareResult.status === 404,
        'Correctly returns 404 for invalid share ID'
    );
}

// Test 4: Error Handling
async function testErrorHandling() {
    console.log('\n⚠️  Testing Error Handling...');
    
    // Test missing query parameter
    const noQueryResult = await makeRequest('GET', '/api/chords');
    logTest('Error - Missing Query Parameter', 
        noQueryResult.status === 400,
        'Correctly returns 400 for missing query'
    );
    
    // Test invalid song ID
    const invalidIdResult = await makeRequest('GET', '/api/songs/99999');
    logTest('Error - Invalid Song ID', 
        invalidIdResult.status === 404,
        'Correctly returns 404 for invalid song ID'
    );
    
    // Test missing required fields
    const incompleteDataResult = await makeRequest('POST', '/api/songs', {
        title: 'Incomplete Song'
        // Missing artist and chord_content
    });
    logTest('Error - Missing Required Fields', 
        incompleteDataResult.status === 400,
        'Correctly returns 400 for missing required fields'
    );
    
    // Test invalid URL for chord extraction
    const invalidUrlResult = await makeRequest('POST', '/api/extract-chords', {
        url: 'https://invalid-site.com/test'
    });
    logTest('Error - Invalid Extraction URL', 
        invalidUrlResult.success, // Should succeed but return error message in content
        'Handles invalid URLs gracefully'
    );
}

// Test 5: Frontend Static Files
async function testStaticFiles() {
    console.log('\n📁 Testing Static Files...');
    
    const indexResult = await makeRequest('GET', '/');
    logTest('Static - Index Page', 
        indexResult.success && indexResult.status === 200,
        'Index page loads successfully'
    );
}

// Cleanup function
function cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    if (testSongId) {
        try {
            songOperations.delete(testSongId);
            logTest('Cleanup - Delete Test Song', true, 'Test song deleted');
        } catch (error) {
            logTest('Cleanup - Delete Test Song', false, error.message);
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log('🎸 Chord Finder - Comprehensive Test Suite');
    console.log('==========================================');
    
    const startTime = Date.now();
    
    try {
        // Check if server is running
        const healthCheck = await makeRequest('GET', '/');
        if (!healthCheck.success) {
            console.log('❌ Server is not running. Please start the server with "npm start" first.');
            process.exit(1);
        }
        
        console.log('✅ Server is running, starting tests...\n');
        
        // Run all test suites
        await testDatabaseOperations();
        await testAPIEndpoints();
        await testShareFunctionality();
        await testErrorHandling();
        await testStaticFiles();
        
        // Cleanup
        cleanup();
        
        // Summary
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log('\n📊 Test Summary');
        console.log('================');
        
        const totalTests = testResults.length;
        const passedTests = testResults.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} ✅`);
        console.log(`Failed: ${failedTests} ❌`);
        console.log(`Duration: ${duration}s`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
        
        if (failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            testResults.filter(r => !r.passed).forEach(test => {
                console.log(`   - ${test.testName}: ${test.message}`);
            });
        }
        
        console.log('\n🎉 Test suite completed!');
        
        // Exit with appropriate code
        process.exit(failedTests > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testDatabaseOperations,
    testAPIEndpoints,
    testShareFunctionality,
    testErrorHandling,
    testStaticFiles
};