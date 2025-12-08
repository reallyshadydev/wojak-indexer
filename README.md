![wojak](https://github.com/user-attachments/assets/3ca7d1a4-cb76-4bd1-8a91-61441ca338c3)

# WojakCoin Indexer

WojakCoin Indexer (based on FeelingSats) creates a queryable dataset for WojakCoin blockchain.



## Installation (Ubuntu)

to be added

## RPC Docs

### Error response

All error responses will return a 200 status code with a JSON body containing the error message. You should
check agains thtis by seeing if the error key is present in the response.

```json
{
  "error": { "code": 404, "message": "Not Found" }
}
```

### /block

#### GET /block/{blocknumber}

Get WojakCoin block information by block number

https://wojak-indexer.example.com/block/50

success respose: 200

```json
{
  "hash": "e4c406c29f2db53a0dbc640fed7c8473924d183e710eb08ae00eec6b515d1fc9",
  "confirmations": 164708,
  "strippedsize": 190,
  "size": 190,
  "weight": 760,
  "height": 50,
  "version": 1,
  "versionHex": "00000001",
  "merkleroot": "6fab347be1af789ff52cd0f4f9bd29433ac62338afbeb5bdbb48e8b0d8440d4e",
  "tx": [
    {
      "txid": "6fab347be1af789ff52cd0f4f9bd29433ac62338afbeb5bdbb48e8b0d8440d4e",
      "hash": "6fab347be1af789ff52cd0f4f9bd29433ac62338afbeb5bdbb48e8b0d8440d4e",
      "size": 109,
      "vsize": 109,
      "version": 1,
      "locktime": 0,
      "vin": [
        {
          "coinbase": "04e39a9f51010a062f503253482f",
          "sequence": 4294967295
        }
      ],
      "vout": [
        {
          "value": 88,
          "n": 0,
          "scriptPubKey": {
            "asm": "03f05ad912e322ab5e74ee57c1264540bde65db5154a536fe19999d31a65aaedb2 OP_CHECKSIG",
            "hex": "2103f05ad912e322ab5e74ee57c1264540bde65db5154a536fe19999d31a65aaedb2ac",
            "reqSigs": 1,
            "type": "pubkey",
            "addresses": ["WkAVjvXbDx3KH5TAAPYx"]
          }
        }
      ],
      "rawHex": "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0e04e39a9f51010a062f503253482fffffffff010058850c02000000232103f05ad912e322ab5e74ee57c1264540bde65db5154a536fe19999d31a65aaedb2ac00000000"
    }
  ],
  "time": 1369414371,
  "mediantime": 1369414284,
  "nonce": 4100587776,
  "bits": "1e0ffff0",
  "difficulty": 0.000244140625,
  "chainwork": "0000000000000000000000000000000000000000000000000000000003300330",
  "previousblockhash": "4319fcba3af30b0615bab400aca532e94f724debd7153451addad7b75045d4f6",
  "nextblockhash": "e6024f86fbb78e8437af70144013b3590e1ab4899444ab76dab8bc7f0c5e943a"
}
```

### /transaction

#### POST /transaction/broadcast

Broadcast a signed transaction on WojakCoin network

https://wojak-indexer.example.com/transaction/broadcast

success respose: 200

```json
{
  "txid": "6fab347be1af789ff52cd0f4f9bd29433ac62338afbeb5bdbb48e8b0d8440d4e"
}
```

### /utxos

#### GET /utxos/all_by_address/{address}

Get all UTXOs for a given address

https://wojak-indexer.example.com/utxos/all_by_address/WkAVjvXbDx3KH5TAAPYx

```json
[
  {
    "txid": "3e72ca01728d0535755f66a3a6063316f4919fe54a5f4e3707c23b54ba18e5c7",
    "vout": 1,
    "address": "WkAVjvXbDx3KH5TAAPYx",
    "amount": "899995000",
    "hex": "0200000001c49f450f97cecce93778dbfd16967084825a6e866c0bcc5cb49270cf7eb50d9d010000006b483045022100905c3dbde5ac8b78fb943a1496ef6d5884ef382dfa5f3341107b72f07f833c2902207142ba2c435723db7e65c658dee5e529426697a15b1e0cc67208c59f275c690b0121022e15e6c680395fac7d8f0b4936cc57ed00e859aa835dbb1b62c59b9d7fc3d16bffffffff0200e1f505000000001976a91440c16e5067810f625bfa80be1181422acfe476a388ac78d5a435000000001976a914e9c5b3dcb4db556e185a89825e9190bec6ecf63388ac00000000",
    "block": 163377,
    "block_hash": "99402f16ca75fcea899a83f86b1f16cb264365d48736ff9713e934a247441f2b"
  }
]
```

#### GET /utxos/fetch_by_address/{address}/{amount_in_satoshi}

Fetch relevant utxos for a given address and amount. Used for creating a transaction and wallet management.

https://wojak-indexer.example.com/utxos/fetch_by_address/WkAVjvXbDx3KH5TAAPYx/500

```json
[
  {
    "txid": "3e72ca01728d0535755f66a3a6063316f4919fe54a5f4e3707c23b54ba18e5c7",
    "vout": 1,
    "address": "WkAVjvXbDx3KH5TAAPYx",
    "amount": "899995000",
    "hex": "0200000001c49f450f97cecce93778dbfd16967084825a6e866c0bcc5cb49270cf7eb50d9d010000006b483045022100905c3dbde5ac8b78fb943a1496ef6d5884ef382dfa5f3341107b72f07f833c2902207142ba2c435723db7e65c658dee5e529426697a15b1e0cc67208c59f275c690b0121022e15e6c680395fac7d8f0b4936cc57ed00e859aa835dbb1b62c59b9d7fc3d16bffffffff0200e1f505000000001976a91440c16e5067810f625bfa80be1181422acfe476a388ac78d5a435000000001976a914e9c5b3dcb4db556e185a89825e9190bec6ecf63388ac00000000",
    "block": 163377,
    "block_hash": "99402f16ca75fcea899a83f86b1f16cb264365d48736ff9713e934a247441f2b"
  }
]
```
