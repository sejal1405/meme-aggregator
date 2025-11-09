# Meme Token Aggregator

A real-time cryptocurrency token aggregator that fetches, merges, and streams live data from multiple decentralized exchanges (DEXs). Built with Node.js, Express, and WebSocket for real-time updates.

## Features

### ✅ Data Aggregation
- Fetches token data from multiple sources:
  - **DexScreener API** - Multi-chain DEX aggregator
  - **GeckoTerminal API** - Trending pools and token data
- Intelligent token deduplication based on contract addresses
- Merges data from multiple sources, prioritizing higher volume sources

### ✅ Real-time Updates
- **WebSocket integration** for live data streaming
- Broadcasts new token discoveries to all connected clients
- Alerts on significant price changes (configurable threshold)
- Auto-polling every 30 seconds (configurable)

### ✅ Advanced Filtering, Sorting & Pagination
- **Sorting**: Sort by price, volume, liquidity, or last updated
- **Filtering**: Filter by price range, volume, liquidity, or search terms
- **Pagination**: Efficient data retrieval with offset-based pagination
- Response metadata for client-side pagination UI

## Tech Stack

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io (WebSocket)
- **HTTP Client**: Axios with retry logic
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd meme-aggregator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** (optional)
   
   Create a `.env` file:
   ```env
   PORT=3000
   POLL_INTERVAL_MS=30000
   PRICE_CHANGE_THRESHOLD=0.05
   ```

4. **Run the server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3000`

## API Documentation

### Get Tokens
**Endpoint**: `GET /tokens`

**Query Parameters**:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `sort` | string | Field to sort by: `price_usd`, `volume_usd`, `liquidity_usd`, `last_updated` | `volume_usd` |
| `order` | string | Sort order: `asc` or `desc` | `desc` |
| `limit` | number | Results per page (max 100, default 30) | `10` |
| `offset` | number | Starting position for pagination | `0` |
| `minPrice` | number | Minimum price in USD | `0.01` |
| `maxPrice` | number | Maximum price in USD | `100` |
| `minVolume` | number | Minimum 24h volume in USD | `10000` |
| `minLiquidity` | number | Minimum liquidity in USD | `50000` |
| `search` | string | Search by name, ticker, or address | `SOL` |

**Example Requests**:

```bash
# Get top 10 tokens by volume
http://localhost:3000/tokens?sort=volume_usd&order=desc&limit=10

# Filter high-volume tokens
http://localhost:3000/tokens?minVolume=100000

# Search for SOL tokens
http://localhost:3000/tokens?search=SOL

# Combined filters
http://localhost:3000/tokens?minVolume=5000&maxPrice=1&sort=volume_usd&order=desc&limit=5

# Pagination (page 2)
http://localhost:3000/tokens?limit=30&offset=30
```

**Response Format**:

```json
{
  "data": [
    {
      "token_address": "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF",
      "token_name": "SOLANA",
      "token_ticker": "SOL",
      "price_usd": 159.25,
      "volume_usd": 2605444.8,
      "liquidity_usd": 2961701.59,
      "protocol": "pancakeswap",
      "last_updated": 1762674930385,
      "source": "dexscreener"
    }
  ],
  "meta": {
    "total": 9,
    "limit": 10,
    "offset": 0,
    "hasMore": true,
    "sortBy": "volume_usd",
    "sortOrder": "desc"
  }
}
```

## WebSocket Events

Connect to WebSocket at `ws://localhost:3000` with path `/ws`

### Client → Server
No events needed. Server automatically sends updates.

### Server → Client

**`initial_data`** - Sent immediately on connection
```javascript
socket.on('initial_data', (tokens) => {
  console.log('Received initial tokens:', tokens);
});
```

**`new_tokens`** - New tokens discovered
```javascript
socket.on('new_tokens', (tokens) => {
  console.log('New tokens found:', tokens);
});
```

**`price_changes`** - Significant price changes (>5% by default)
```javascript
socket.on('price_changes', (tokens) => {
  console.log('Price alerts:', tokens);
});
```

## Project Structure

```
meme-aggregator/
├── fetchers/
│   ├── dexscreener.js      # DexScreener API integration
│   └── geckoterminal.js    # GeckoTerminal API integration
├── utils/
│   └── retry.js            # Axios retry logic
├── index.js                # Main server & API routes
├── client.html             # Frontend demo page
├── package.json
└── README.md
```

## Configuration

Edit these values in `index.js` or set environment variables:

```javascript
const POLL_INTERVAL_MS = 30000;  // Fetch interval (30 seconds)
const PRICE_CHANGE_THRESHOLD = 0.05;  // 5% price change alert
```

## Error Handling

- **Network errors**: Automatic retry with exponential backoff
- **API failures**: Graceful fallback, continues with available data
- **Invalid queries**: Returns empty array with metadata

## Development

**Run in development mode** (with auto-restart):
```bash
npm run dev
```

**Run in production**:
```bash
npm start
```

## Troubleshooting

### Network Restrictions
If you see certificate errors or 403 blocks:
- Use a VPN or mobile hotspot
- Or change DNS: `sudo networksetup -setdnsservers Wi-Fi 1.1.1.1`

### No Data Returned
- Check if APIs are accessible: `curl "https://api.dexscreener.com/latest/dex/search?q=SOL"`
- Ensure you're connected to internet
- Check server logs for error messages

## Future Enhancements

- [ ] Add more DEX sources (Jupiter, Raydium)
- [ ] Implement Redis caching for better performance
- [ ] Add user authentication and watchlists
- [ ] Create advanced charting with historical data
- [ ] Add price alerts via email/SMS

## License

MIT

## Author

Sejal - Cryptocurrency Data Aggregation Assignment

---

**Note**: This project is for educational purposes. Always verify trading data from official sources before making financial decisions.