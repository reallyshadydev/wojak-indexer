# WojakCoin Indexer Setup

This is the WojakCoin version of FeelingSats indexer, adapted to work with WojakCoin blockchain.

## Changes Made

1. **RPC Authentication**: Changed from cookie-based auth to username/password (WojakCoin uses `rpcuser`/`rpcpassword`)
2. **Network Parameters**: Updated network name to WojakCoin
3. **Block Verbosity**: Uses verbosity=2 to get full transaction details in `rawtx` field
4. **RPC URL**: Default changed to WojakCoin RPC port (20760)
5. **Package Name**: Changed from `flokicoin-indexer` to `wojak-indexer`

## Configuration

The `.env` file has been created with WojakCoin RPC settings:
- RPC_BASE_URL: http://127.0.0.1:20760/
- RPC_USER: wojakcoinrpc
- RPC_PASSWORD: (from wojakcoin.conf)

## Database

PostgreSQL database `wojak_indexer` should be created.

## Usage

### Start the Indexer
```bash
cd /root/wojak-indexer
npm start -- -indexer
```

### Start the API Server
```bash
npm start -- -api
```

### Start RPC Proxy
```bash
npm start -- -rpcproxy
```

### Start Internal API
```bash
npm start -- -internalapi
```

### Start Multiple Services
```bash
npm start -- -indexer -api
```

### Initialize Database (First Time)
```bash
npm start -- -new -indexer
```

## API Endpoints

Once the API server is running, you can access:

- `GET /block/{blocknumber}` - Get block information
- `GET /utxos/all_by_address/{address}` - Get all UTXOs for an address
- `GET /utxos/fetch_by_address/{address}/{amount}` - Fetch UTXOs for a specific amount
- `POST /transaction/broadcast` - Broadcast a transaction

## Requirements

- Node.js (with npm)
- PostgreSQL
- WojakCoin node running with RPC enabled
- Address index enabled (`addrindex=1` in wojakcoin.conf)

