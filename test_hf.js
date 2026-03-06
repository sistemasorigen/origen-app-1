const url = 'https://router.huggingface.co/hf-inference/models/prompthero/openjourney-v4';

async function testHF() {
    console.log('Testing HF model...');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: "A futuristic city with flying cars, cyberpunk style, vivid colors",
                parameters: {
                    guidance_scale: 7.5
                }
            })
        });

        if (response.ok) {
            console.log('Success!', response.headers.get('content-type'));
            const blob = await response.blob();
            console.log('Image Blob size:', blob.size);
        } else {
            console.error('Failed:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response:', text);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

testHF();
