
// Test script for Lexica and Unsplash Source
const fetch = global.fetch;

async function testAPIs() {
    const prompt = "friends drinking wine garden";

    // 1. Test Lexica (Search existing AI images)
    console.log('--- Testing Lexica ---');
    try {
        const lexicaUrl = `https://lexica.art/api/v1/search?q=${encodeURIComponent(prompt)}`;
        const start = Date.now();
        const res = await fetch(lexicaUrl);
        const data = await res.json();
        console.log(`Lexica Status: ${res.status}`);
        console.log(`Lexica Time: ${Date.now() - start}ms`);
        if (data.images && data.images.length > 0) {
            console.log(`Lexica found ${data.images.length} images.`);
            console.log(`First Image: ${data.images[0].src}`);
        } else {
            console.log('Lexica found 0 images.');
        }
    } catch (e) {
        console.log('Lexica Failed:', e.message);
    }

    // 2. Test Unsplash Source (Redirect)
    console.log('\n--- Testing Unsplash Source ---');
    try {
        const unsplashUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(prompt)}`;
        const start = Date.now();
        const res = await fetch(unsplashUrl, { redirect: 'manual' });
        console.log(`Unsplash Status: ${res.status}`); // Should be 302
        console.log(`Unsplash Time: ${Date.now() - start}ms`);
        console.log(`Location: ${res.headers.get('location')}`);
    } catch (e) {
        console.log('Unsplash Source Failed:', e.message);
    }
}

testAPIs();
