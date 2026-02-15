import { Router, Request, Response } from "express";
import axios from "axios";

export const NetworkRouter = Router();

// Helper to get RPC auth
const getRpcAuth = () => {
  const user = process.env.RPC_USER || "";
  const pass = process.env.RPC_PASSWORD || "";
  return Buffer.from(`${user}:${pass}`).toString("base64");
};

const rpcUrl = process.env.NODE_RPC_URL || "http://127.0.0.1:20760";

// Get network info (peers, version, etc.)
NetworkRouter.get("/", async (req: Request, res: Response) => {
  try {
    const auth = getRpcAuth();

    // Get network info
    const { data: networkInfo } = await axios.post(
      rpcUrl,
      {
        jsonrpc: "1.0",
        id: "getnetworkinfo",
        method: "getnetworkinfo",
        params: [],
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    // Get peer info
    const { data: peerInfo } = await axios.post(
      rpcUrl,
      {
        jsonrpc: "1.0",
        id: "getpeerinfo",
        method: "getpeerinfo",
        params: [],
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const network = networkInfo.result || {};
    const peers = peerInfo.result || [];

    res.json({
      version: network.version,
      subversion: network.subversion,
      protocolversion: network.protocolversion,
      connections: network.connections,
      relayfee: network.relayfee,
      peers: peers.map((peer: any) => ({
        addr: peer.addr,
        network: peer.network || "ipv4",
        inbound: peer.inbound,
        subver: peer.subver,
        synced_blocks: peer.synced_blocks,
        startingheight: peer.startingheight,
        conntime: peer.conntime,
      })),
    });
  } catch (error: any) {
    console.error("Network info error:", error.message);
    res.status(500).json({
      error: true,
      details: error.message,
    });
  }
});
