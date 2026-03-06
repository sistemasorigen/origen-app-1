const query = "youth sitting in church talking";
const encoded = encodeURIComponent(query);
const url = `https://source.unsplash.com/1600x900/?${encoded}`;

fetch(url, { redirect: 'follow' })
    .then(res => {
        console.log('Status', res.status);
        console.log('Final URL:', res.url);
    })
    .catch(console.error);
