const fs = require('fs');
fetch('https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/prode-sync-results', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(res => res.text().then(text => ({ status: res.status, text })))
.then(data => {
  fs.writeFileSync('output.txt', JSON.stringify(data));
  console.log('done');
})
.catch(err => {
  fs.writeFileSync('output.txt', err.toString());
  console.log('error');
});
