

async function test() {
    const url = 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/email-notifier';
    const payload = {
        type: 'INSERT',
        table: 'leader_applications',
        record: {
            first_name: 'NodeFetch',
            last_name: 'Test',
            email: 'johanasute@gmail.com',
            phone: '+12'
        }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}
test();
