// simulate-dex.js
const axios = require('axios');

async function sendToken(i) {
  const payload = {
    symbol: `MEME${i}`,
    name: `Meme Token ${i}`,
    price: Number((0.0001 + Math.random() * 0.001).toFixed(8)),
    market: 'dex-sim',
    source: 'mock-dex',
    liquidity: Math.floor(1000 + Math.random() * 9000)
  };

  try {
    const res = await axios.post('http://localhost:3000/tokens', payload);
    console.log(`✅ Sent ${payload.symbol} (${res.status})`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

(async () => {
  console.log(' Simulating DEX updates...');
  for (let i = 1; i <= 6; i++) {
    await sendToken(i);
    await new Promise(r => setTimeout(r, 300)); // wait 300ms between events
  }
  console.log(' Simulation complete.');
})();
