// fetchers/dexscreener.js
const axios = require('axios');
let axiosWithBackoff;
try { axiosWithBackoff = require('../utils/retry').axiosWithBackoff; } catch (e) { /* optional */ }

async function fetchFromDexScreener(query = 'solana') {
  const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
  const headers = {
    // 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    // 'Accept': 'application/json, text/plain, */*'
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://dexscreener.com/'
  };

  try {
    const res = (typeof axiosWithBackoff === 'function')
      ? await axiosWithBackoff({ url, method: 'GET', timeout: 10000, headers }, 4)
      : await axios.get(url, { timeout: 10000, headers });

    const pairs = res.data?.pairs || [];
    const tokens = pairs.map((p) => {
      const base = p.baseToken || {};
      return {
        token_address: base.address || p.tokenAddress || null,
        token_name: base.name || 'Unknown',
        token_ticker: base.symbol || '',
        price_usd: Number(p.priceUsd) || null,
        volume_usd: Number(p.volume?.h24) || Number(p.volumeUsd) || null,
        liquidity_usd: Number(p.liquidity?.usd) || null,
        protocol: p.dexId || '',
        last_updated: Date.now(),
        source: 'dexscreener'
      };
    });
    return tokens.filter(t => t.token_address && t.price_usd !== null);
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.error('DexScreener fetch error:', status || err?.message || err, body ? (typeof body === 'object' ? JSON.stringify(body).slice(0,200) : body) : '');
    return [];
  }
}

module.exports = { fetchFromDexScreener };
