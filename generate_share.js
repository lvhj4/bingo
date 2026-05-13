const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'images-list.js');
const txt = fs.readFileSync(file, 'utf8');
const arrStr = txt.slice(txt.indexOf('['), txt.lastIndexOf(']')+1);
const names = JSON.parse(arrStr);
function shuffledCopy(list){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const rows=4, cols=4, total=rows*cols;
const pool = shuffledCopy(names);
const selected = pool.slice(0,total/2);
let deck = [];
selected.forEach(n=>{deck.push(n);deck.push(n)});
deck = shuffledCopy(deck);
const state = {page:'memory', rows, cols, deck};
const json = JSON.stringify(state);
const b64 = Buffer.from(json, 'utf8').toString('base64');
console.log('STATE_JSON:', json);
console.log('\nSHARE_URL: https://lvhj4.github.io/bingo/?state=' + b64);
