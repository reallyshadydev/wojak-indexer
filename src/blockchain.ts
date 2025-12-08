import fs from "fs";
import path from "path";
import axios from "axios";
import { BlockData, Transaction } from "./types";
import { Transaction as BitcoinJsTransaction } from "bitcoinjs-lib";
import { FullTransaction, FullAPIError } from "./types";

export const WojakCoinNetwork = {
  messagePrefix: "\u0018WojakCoin Signed Message:\n",
  bech32: "wojak",
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 73, // W prefix for WojakCoin
  scriptHash: 50, // X prefix for WojakCoin
  wif: 201, // WojakCoin WIF prefix
};

// ✅ Utility: Get auth header from username/password or cookie
const getAuthHeader = (): string => {
  // Try username/password first (WojakCoin uses this)
  if (process.env.RPC_USER && process.env.RPC_PASSWORD) {
    const credentials = `${process.env.RPC_USER}:${process.env.RPC_PASSWORD}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }
  
  // Fallback to cookie file if available
  const cookiePath = process.env.RPC_COOKIE_PATH ?? "/root/.wojakcoin/.cookie";
  try {
  const cookie = fs.readFileSync(path.resolve(cookiePath), "utf8").trim();
  const encoded = Buffer.from(cookie).toString("base64");
  return `Basic ${encoded}`;
  } catch (e) {
    throw new Error("No RPC authentication method found. Set RPC_USER and RPC_PASSWORD or RPC_COOKIE_PATH");
  }
};

export const txJsonToHex = (tx: Transaction): string => {
  const transaction = new BitcoinJsTransaction();

  transaction.version = tx.version;
  transaction.locktime = tx.locktime;

  tx.vin.forEach((input) => {
    if (input.coinbase) {
      transaction.addInput(
        Buffer.alloc(32),
        0xffffffff,
        0xffffffff,
        Buffer.from(input.coinbase, "hex")
      );
      return;
    }

    const txidBuffer = Buffer.from(input.txid, "hex").reverse();
    const scriptSigBuffer = Buffer.from(input.scriptSig.hex, "hex");

    const vinIndex = transaction.addInput(
      txidBuffer,
      input.vout,
      input.sequence
    );

    transaction.ins[vinIndex].script = scriptSigBuffer;
  });

  tx.vout.forEach((output) => {
    const scriptPubKeyBuffer = Buffer.from(output.scriptPubKey.hex, "hex");
    const valueSatoshis = Math.round(output.value * 1e8);
    transaction.addOutput(scriptPubKeyBuffer, BigInt(valueSatoshis));
  });

  return transaction.toHex();
};

export const getBlock = async (
  blockNumber: number
): Promise<BlockData<FullTransaction>> => {
  const rpcBaseURL = process.env.RPC_BASE_URL;
  if (!rpcBaseURL) {
    throw new Error("RPC_BASE_URL is not defined");
  }

  const auth = getAuthHeader();

  try {
    const { data: blockHashResponse } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "getblockhash",
        method: "getblockhash",
        params: [blockNumber],
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    const blockHash = blockHashResponse.result;
    if (!blockHash) throw new Error("Failed to retrieve block hash");

    const { data: blockResponse } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "getblock",
        method: "getblock",
        params: [blockHash, true], // Use true for verbose (full transaction details) - WojakCoin format
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    if (!blockResponse.result) {
      throw new Error("Failed to retrieve block data.");
    }

    const blockData = blockResponse.result;

    // With verbosity=2, transactions are in 'tx' field for WojakCoin (standard Bitcoin format)
    const transactions = blockData.tx || blockData.rawtx || [];

    const fullTxs: FullTransaction[] = [];

    // If rawtx contains full transactions, use them directly
    if (transactions.length > 0 && typeof transactions[0] === 'object' && 'vout' in transactions[0]) {
      // Transactions are already full, add rawHex if not present
      for (const tx of transactions as any[]) {
        if (!tx.rawHex) {
          tx.rawHex = txJsonToHex(tx as Transaction);
        }
        fullTxs.push(tx as FullTransaction);
      }
    } else {
      // Otherwise, decode each transaction
      for (const txid of transactions as string[]) {
      try {
        const { data: txResponse } = await axios.post(
          rpcBaseURL,
          {
            jsonrpc: "1.0",
            id: "getrawtransaction",
            method: "getrawtransaction",
            params: [txid, 1],
          },
          {
            headers: {
              Authorization: auth,
            },
          }
        );

        fullTxs.push(txResponse.result as FullTransaction);
      } catch (e: unknown) {
        continue;
        }
      }
    }

    blockData.tx = fullTxs;

    blockData.tx = blockData.tx.map((tx: Transaction) => ({
      ...tx,
      rawHex: txJsonToHex(tx),
    }));

    return blockData as BlockData<FullTransaction>;
  } catch (e: unknown) {
    throw "Error fetching block";
  }
};

export const pushTx = async (
  signedTransactionHex: string
): Promise<{ txid: Transaction["txid"] }> => {
  const rpcBaseURL = process.env.RPC_BASE_URL;

  if (!rpcBaseURL) {
    throw new Error("RPC_BASE_URL is not defined");
  }

  const auth = getAuthHeader();

  try {
    const { data } = await axios.post(
      rpcBaseURL,
      {
        jsonrpc: "1.0",
        id: "sendrawtransaction",
        method: "sendrawtransaction",
        params: [signedTransactionHex],
      },
      {
        headers: {
          Authorization: auth,
        },
      }
    );

    return { txid: data.result };
  } catch (e: unknown) {
    throw (
      "Internal server error " +
      JSON.stringify((e as FullAPIError)?.response?.data ?? {})
    );
  }
};
