const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { fetchFromDexScreener } = require('./fetchers/dexscreener');
const { fetchFromGeckoTerminal } = require('./fetchers/geckoterminal');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/ws',
  cors: { origin: '*', methods: ['GET','POST'] }
});

// Serve the client page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// Enhanced /tokens endpoint with filtering, sorting & pagination
app.get('/tokens', (req, res) => {
  // Extract query parameters
  const {
    sort = 'volume_usd',           // default sort by volume
    order = 'desc',                // default descending
    limit = '30',                  // default 30 results
    offset = '0',                  // default start at 0
    minPrice,                      // filter: minimum price
    maxPrice,                      // filter: maximum price
    minVolume,                     // filter: minimum volume
    minLiquidity,                  // filter: minimum liquidity
    search,                        // filter: search by name/ticker
  } = req.query;

  // Start with cached tokens
  let tokens = [...cachedTokens];

  // FILTERING
  if (minPrice) {
    const min = parseFloat(minPrice);
    tokens = tokens.filter(t => t.price_usd >= min);
  }
  
  if (maxPrice) {
    const max = parseFloat(maxPrice);
    tokens = tokens.filter(t => t.price_usd <= max);
  }
  
  if (minVolume) {
    const min = parseFloat(minVolume);
    tokens = tokens.filter(t => (t.volume_usd || 0) >= min);
  }
  
  if (minLiquidity) {
    const min = parseFloat(minLiquidity);
    tokens = tokens.filter(t => (t.liquidity_usd || 0) >= min);
  }
  
  if (search) {
    const searchLower = search.toLowerCase();
    tokens = tokens.filter(t => 
      t.token_name?.toLowerCase().includes(searchLower) ||
      t.token_ticker?.toLowerCase().includes(searchLower) ||
      t.token_address?.toLowerCase().includes(searchLower)
    );
  }

  // SORTING
  const validSortFields = ['price_usd', 'volume_usd', 'liquidity_usd', 'price_change_24h', 'last_updated'];
  const sortField = validSortFields.includes(sort) ? sort : 'volume_usd';
  const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;

  tokens.sort((a, b) => {
    const valA = a[sortField] ?? 0;
    const valB = b[sortField] ?? 0;
    return (valA - valB) * sortOrder;
  });

  // PAGINATION
  const limitNum = Math.min(parseInt(limit) || 30, 100); // max 100 per page
  const offsetNum = parseInt(offset) || 0;
  const totalCount = tokens.length;
  const paginatedTokens = tokens.slice(offsetNum, offsetNum + limitNum);

  // Response with metadata
  res.json({
    data: paginatedTokens,
    meta: {
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < totalCount,
      sortBy: sortField,
      sortOrder: order
    }
  });
});

// In-memory cache for merged tokens
let cachedTokens = [];
let prevSnapshot = new Map();

// Configs
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30000;
const PRICE_CHANGE_THRESHOLD = Number(process.env.PRICE_CHANGE_THRESHOLD) || 0.05;

/**
 * Fetch and merge tokens from all sources
 */
async function fetchAndMergeTokens() {
  console.log('Fetching tokens...');
  const [dexTokens, geckoTokens] = await Promise.all([
    fetchFromDexScreener().catch(e => { console.error('DexScreener error:', e); return []; }),
    fetchFromGeckoTerminal().catch(e => { console.error('GeckoTerminal error:', e); return []; })
  ]);

  const allTokens = [...dexTokens, ...geckoTokens];
  const merged = new Map();

  for (const token of allTokens) {
    const key = token.token_address?.toLowerCase();
    if (!key) continue;

    if (!merged.has(key)) {
      merged.set(key, token);
    } else {
      const existing = merged.get(key);
      // Prefer higher volume or more recent data
      if ((token.volume_usd || 0) > (existing.volume_usd || 0)) {
        merged.set(key, token);
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Poll for new data and emit changes via WebSocket
 */
async function pollAndUpdate() {
  const merged = await fetchAndMergeTokens();
  console.log(`Fetched ${merged.length} merged tokens.`);
  cachedTokens = merged;

  // Detect changes
  const currentSnapshot = new Map(merged.map(t => [t.token_address, t.price_usd]));
  const newTokens = [];
  const priceChanges = [];

  for (const token of merged) {
    const addr = token.token_address;
    if (!prevSnapshot.has(addr)) {
      newTokens.push(token);
    } else {
      const oldPrice = prevSnapshot.get(addr);
      const newPrice = token.price_usd;
      if (oldPrice && newPrice) {
        const change = Math.abs((newPrice - oldPrice) / oldPrice);
        if (change >= PRICE_CHANGE_THRESHOLD) {
          priceChanges.push({ ...token, price_change_pct: change });
        }
      }
    }
  }

  // Emit to all connected clients
  if (newTokens.length > 0) {
    io.emit('new_tokens', newTokens);
    console.log(`📢 Emitted ${newTokens.length} new tokens`);
  }
  if (priceChanges.length > 0) {
    io.emit('price_changes', priceChanges);
    console.log(`📢 Emitted ${priceChanges.length} price changes`);
  }

  prevSnapshot = currentSnapshot;
}

/**
 * Start polling on server launch
 */
(async () => {
  await pollAndUpdate();
  console.log(`Initial token load: ${cachedTokens.length}`);
  setInterval(pollAndUpdate, POLL_INTERVAL_MS);
})();

/**
 * WebSocket connection handler
 */
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send current data immediately
  socket.emit('initial_data', cachedTokens);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});







// // index.js — real DexScreener + GeckoTerminal aggregation with safer poller
// const express = require('express');
// const http = require('http');
// const path = require('path');
// const { Server } = require('socket.io');
// const { fetchFromDexScreener } = require('./fetchers/dexscreener');
// const { fetchFromGeckoTerminal } = require('./fetchers/geckoterminal');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   path: '/ws',
//   cors: { origin: '*', methods: ['GET', 'POST'] } // dev only: allow all origins
// });

// // Serve the client page
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'client.html'));
// });

// // Simple /tokens endpoint (slice for demo)
// app.get('/tokens', (req, res) => {
//   res.json({ data: cachedTokens.slice(0, 30) });
// });

// // In-memory cache for merged tokens (simple for dev)
// let cachedTokens = [];
// let prevSnapshot = new Map();

// // Configs (tweak as needed)
// const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30000); // 30s
// const PRICE_CHANGE_THRESHOLD = Number(process.env.PRICE_CHANGE_THRESHOLD || 0.02); // 2%

// /**
//  * Merge two token lists into unique tokens keyed by token_address.
//  * Simple heuristics: sum volumes, take max liquidity and latest last_updated.
//  */
// function mergeTokens(listA = [], listB = []) {
//   const map = new Map();
//   [...listA, ...listB].forEach((t) => {
//     if (!t || !t.token_address) return;
//     if (!map.has(t.token_address)) {
//       map.set(t.token_address, { ...t });
//     } else {
//       const existing = map.get(t.token_address);
//       existing.token_name = existing.token_name || t.token_name;
//       existing.token_ticker = existing.token_ticker || t.token_ticker;
//       existing.price_usd = existing.price_usd ?? t.price_usd;
//       existing.volume_usd = (existing.volume_usd || 0) + (t.volume_usd || 0);
//       existing.liquidity_usd = Math.max(existing.liquidity_usd || 0, t.liquidity_usd || 0);
//       existing.last_updated = Math.max(existing.last_updated || 0, t.last_updated || Date.now());
//       map.set(t.token_address, existing);
//     }
//   });
//   return Array.from(map.values());
// }

// /**
//  * Fetch from both sources and update cachedTokens.
//  * This function is resilient: if one fetcher fails, we still keep the other result.
//  */
// async function refreshTokens() {
//   console.log('Fetching tokens...');
//   try {
//     const [dex, gecko] = await Promise.allSettled([
//       fetchFromDexScreener('solana'),
//       fetchFromGeckoTerminal()
//     ]);

//     const dexList = dex.status === 'fulfilled' ? dex.value : [];
//     if (dex.status === 'rejected') console.warn('DexScreener fetch failed:', dex.reason?.message || dex.reason);
//     const geckoList = gecko.status === 'fulfilled' ? gecko.value : [];
//     if (gecko.status === 'rejected') console.warn('GeckoTerminal fetch failed:', gecko.reason?.message || gecko.reason);

//     cachedTokens = mergeTokens(dexList, geckoList);
//     console.log(`Fetched ${cachedTokens.length} merged tokens.`);
//   } catch (err) {
//     console.error('refreshTokens unexpected error:', err?.message || err);
//     // keep old cachedTokens if available
//   }
// }

// // Poller control: suppress initial "token:new" emits for a short grace period
// let suppressInitialEmit = true;

// /**
//  * Start the service: initial load, start server, then poll periodically.
//  */
// (async () => {
//   // initial load (populate cachedTokens and prevSnapshot)
//   try {
//     await refreshTokens();
//     prevSnapshot = new Map(cachedTokens.map(t => [t.token_address, t]));
//     console.log('Initial token load:', cachedTokens.length);
//   } catch (e) {
//     console.error('Initial load failed', e?.message || e);
//   }

//   // start server
//   const PORT = process.env.PORT || 3000;
//   server.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));

//   // allow clients a short window to connect before emitting token:new
//   setTimeout(() => { suppressInitialEmit = false; }, 5000); // 5s grace period

//   // poll loop
//   setInterval(async () => {
//     try {
//       // refresh tokens (uses fetchers)
//       await refreshTokens();

//       // build current map for diffing
//       const nowMap = new Map(cachedTokens.map(t => [t.token_address, t]));

//       // detect new tokens and price updates
//       for (const [addr, token] of nowMap.entries()) {
//         const prev = prevSnapshot.get(addr);
//         if (!prev) {
//           // only emit new tokens after initial grace period
//           if (!suppressInitialEmit) {
//             io.emit('token:new', token);
//             console.log('New token:', token.token_ticker || addr);
//           }
//           continue;
//         }

//         // check price change (guard against undefined / zero)
//         const prevPrice = prev.price_usd;
//         const newPrice = token.price_usd;
//         let pricePct = 0;
//         if (typeof prevPrice === 'number' && typeof newPrice === 'number' && prevPrice !== 0) {
//           pricePct = Math.abs((newPrice - prevPrice) / prevPrice);
//         }

//         if (pricePct > PRICE_CHANGE_THRESHOLD) {
//           io.emit('token:update', { token_address: addr, price_usd: newPrice });
//           console.log(`price update ${token.token_ticker || addr} ${(pricePct*100).toFixed(2)}%`);
//         }
//       }

//       // refresh prevSnapshot
//       prevSnapshot = nowMap;
//     } catch (err) {
//       console.error('Poller error:', err?.message || err);
//     }
//   }, POLL_INTERVAL_MS);
// })();
