const url = 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1';

async function testGenerateImage() {
    console.log('--- Testing generate-image ---');
    try {
        const res = await fetch(`${url}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'A futuristic city' })
        });
        console.log('generate-image status:', res.status);
        console.log('generate-image body:', await res.text());
    } catch (e) {
        console.error(e);
    }
}

async function testWhatsapp() {
    console.log('--- Testing send-whatsapp ---');
    try {
        const res = await fetch(`${url}/send-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '+123', message: 'test' })
        });
        console.log('send-whatsapp status:', res.status);
        console.log('send-whatsapp body:', await res.text());
    } catch (e) {
        console.error(e);
    }
}

async function testGroupConfirmation() {
    console.log('--- Testing send-gcx-welcome ---');
    try {
        const res = await fetch(`${url}/send-gcx-welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Direct invocation payload
            body: JSON.stringify({ registration_ids: ['invalid-id-for-testing'] })
        });
        console.log('send-gcx-welcome status:', res.status);
        console.log('send-gcx-welcome body:', await res.text());
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    await testGenerateImage();
    await testWhatsapp();
    await testGroupConfirmation();
}
run();
