
// Use built-in fetch in Node 18+
const fetch = global.fetch;

async function testPollinations() {
    const prompt = 'Grupo de jovenes riendo en una iglesia moderna';
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

    console.log('Fetching from:', url);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.error('Error fetching image:', response.status);
            return;
        }

        const buffer = await response.arrayBuffer();
        console.log('Image received. Size:', buffer.byteLength);

        const header = new Uint8Array(buffer.slice(0, 4));
        console.log('Header bytes:', header); // Should be JPEG or PNG

    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

testPollinations();
