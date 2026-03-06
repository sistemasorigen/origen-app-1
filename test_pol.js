const url = "https://image.pollinations.ai/prompt/Hombres%20riendo?nologo=true&model=flux";

fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
})
    .then(async res => {
        console.log('Status', res.status);
        console.log('Content-Type', res.headers.get('content-type'));
        if (res.ok) {
            const buffer = await res.arrayBuffer();
            console.log('Got image bytes:', buffer.byteLength);
        } else {
            console.log('Text:', await res.text());
        }
    })
    .catch(console.error);
