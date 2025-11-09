// fetchers/geckoterminal.js
const axios = require('axios');
let axiosWithBackoff;
try { axiosWithBackoff = require('../utils/retry').axiosWithBackoff; } catch (e) { /* optional */ }

async function fetchFromGeckoTerminal() {
  const url = 'https://api.geckoterminal.com/api/v2/networks/solana/trending_pools';
  const headers = {
    // 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    // 'Accept': 'application/json, text/plain, */*'
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.geckoterminal.com/'
  };

  try {
  const res = (typeof axiosWithBackoff === 'function')
    ? await axiosWithBackoff({ url, method: 'GET', timeout: 10000, headers }, 3)
    : await axios.get(url, { timeout: 10000, headers });
  
  // Fix: extract data properly
  const responseData = res.data?.data || res?.data || [];
  
  const tokens = responseData.map((item) => {
    const attr = item.attributes || {};
    const baseToken = attr.base_token || {};
    
    return {
      token_address: baseToken.address,
      token_name: baseToken.name,
      token_ticker: baseToken.symbol,
      price_usd: attr.base_token_price_usd ? Number(attr.base_token_price_usd) : null,
      volume_usd: attr.volume_usd?.h24 ? Number(attr.volume_usd.h24) : null,
      liquidity_usd: attr.reserve_in_usd ? Number(attr.reserve_in_usd) : null,
      last_updated: Date.now(),
      source: 'geckoterminal'
    };
  });
  
  return tokens.filter(t => t.token_address && t.price_usd !== null);
} 
  catch (err) {
    const status = err?.response?.status;
    console.error('GeckoTerminal fetch error:', status || err?.message || err);
    // fallback to Jupiter for SOL price if needed
    try {
      const jurl = 'https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112';
      const jr = await axios.get(jurl, { timeout: 8000, headers });
      const priceMap = jr.data || {};
      const solPrice = priceMap?.SOL?.price ?? null;
      if (solPrice != null) {
        return [{
          token_address: 'SOL',
          token_name: 'SOL',
          token_ticker: 'SOL',
          price_usd: Number(solPrice),
          volume_usd: null,
          liquidity_usd: null,
          last_updated: Date.now(),
          source: 'jupiter-fallback'
        }];
      }
    } catch (je) {
      console.error('Jupiter fallback failed:', je?.message || je);
    }
    return [];
  }
}

module.exports = { fetchFromGeckoTerminal };
