const fs = require('fs');

async function test() {
    const API_BASE = 'https://worldcup26.ir';
    const API_EMAIL = 'sistemas@origeniglesia.org';
    const API_PASSWORD = 'SistemasOrigen2026!';

    const loginRes = await fetch(`${API_BASE}/auth/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: API_EMAIL, password: API_PASSWORD })
    });
    
    const { token } = await loginRes.json();
    
    const gamesRes = await fetch(`${API_BASE}/get/games`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await gamesRes.json();
    fs.writeFileSync('api_games_resp.txt', JSON.stringify(data, null, 2));
}

test().catch(console.error);
