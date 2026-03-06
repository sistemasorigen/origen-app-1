const url = 'https://image.pollinations.ai/prompt/Hombres%20riendose%20tomando%20mate%20en%20una%20mesa%20realistic,%204k,%20photography?width=800&height=600&seed=123456&nologo=true&model=flux';

fetch(url)
    .then(res => {
        console.log('Status:', res.status, res.statusText);
        console.log('Content-Type:', res.headers.get('content-type'));
        return res.text();
    })
    .then(text => console.log('Response body start:', text.substring(0, 100)))
    .catch(err => console.error('Fetch error:', err));
