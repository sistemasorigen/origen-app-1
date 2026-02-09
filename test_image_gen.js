
const fetch = global.fetch;

async function testModel(modelName, version) {
    const apiKey = 'AIzaSyDrevR_K1HjaGYCvjoCkxnLdvTqSpdPWq4';
    const url = `https://generativelanguage.googleapis.com/${version}/models/${modelName}:predict?key=${apiKey}`;

    console.log(`Testing ${version}: ${modelName}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: 'Test prompt' }],
                parameters: { sampleCount: 1, aspectRatio: '16:9' }
            })
        });

        if (!response.ok) {
            console.log(`FAILED ${version} ${modelName}:`, response.status);
        } else {
            const data = await response.json();
            console.log(`SUCCESS ${version} ${modelName}!`);
        }
    } catch (error) {
        console.error(`ERROR ${version} ${modelName}:`, error.message);
    }
}

async function runTests() {
    await testModel('imagen-3.0-generate-001', 'v1');
    await testModel('imagen-3.0-generate-002', 'v1');
    // Also try without 'models/' prefix? No, it's usually required.
}

runTests();
