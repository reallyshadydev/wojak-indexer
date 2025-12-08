import http from "http";
import httpProxy from "http-proxy";
import fs from "fs";
import path from "path";
import { Models } from "./database";
import { checkEnvForFields } from "./utils";
import net from "net";
import { URL } from "url";
import axios, { AxiosError } from "axios";

const requiredEnvFields = [
  "NODE_RPC_URL",
  "HTTP_PROXY_PORT",
  "TCP_PROXY_PORT",
];

export const createRpcProxy = (db: Models) => {
  if (!checkEnvForFields(requiredEnvFields, "rpcproxy")) {
    return;
  }

  // Function to get auth header from username/password or cookie
  function getAuthHeader(): string {
    // Try username/password first (WojakCoin uses this)
    if (process.env.NODE_RPC_USER && process.env.NODE_RPC_PASSWORD) {
      const credentials = `${process.env.NODE_RPC_USER}:${process.env.NODE_RPC_PASSWORD}`;
      return `Basic ${Buffer.from(credentials).toString("base64")}`;
    }
    
    // Fallback to cookie file if available
    const cookiePath = process.env.NODE_RPC_COOKIE_PATH || "/root/.wojakcoin/.cookie";
    try {
      const cookie = fs.readFileSync(path.resolve(cookiePath), "utf-8").trim();
      return `Basic ${Buffer.from(cookie).toString("base64")}`;
    } catch (error) {
      console.error("Error reading the cookie file:", error);
      throw new Error("No RPC authentication method found. Set NODE_RPC_USER and NODE_RPC_PASSWORD or NODE_RPC_COOKIE_PATH");
    }
  }

  const AUTH_HEADER = getAuthHeader();
  const NODE_RPC_URL = process.env.NODE_RPC_URL! || "http://127.0.0.1:20760";

  // Create an HTTP proxy server
  const proxy = httpProxy.createProxyServer({
    target: NODE_RPC_URL,
    changeOrigin: true,
    ws: true, // Enable proxying of WebSocket connections if needed
  });

  // Intercept the proxy request to modify headers
  proxy.on("proxyReq", (proxyReq, req, res) => {
    // Replace the Authorization header
    proxyReq.setHeader("Authorization", AUTH_HEADER);
  });

  proxy.on("error", (err, req, res) => {
    console.error("Proxy error:", err);

    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end("Proxy server error");
    }
  });

  // Create an HTTP server that uses the proxy
  const server = http.createServer((req, res) => {
    proxy.web(req, res);
  });

  // Handle WebSocket connections if necessary
  server.on("upgrade", (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  const HTTP_PORT = process.env.HTTP_PROXY_PORT || 9922;
  server.listen(HTTP_PORT, () => {
    console.log(`HTTP proxy server running on port ${HTTP_PORT}`);
    console.log(`Proxying to: ${NODE_RPC_URL}`);
  });

  // Create a TCP server for TCP connections
  const TCP_PORT = process.env.TCP_PROXY_PORT || 9923;
  const tcpServer = net.createServer((clientSocket) => {
    let dataBuffer = "";
    let headersParsed = false;
    let contentLength = 0;
    let bodyBuffer = "";

    clientSocket.on("data", async (chunk) => {
      dataBuffer += chunk.toString();

      if (!headersParsed) {
        // Detect end of HTTP headers
        const headerEndIndex = dataBuffer.indexOf("\r\n\r\n");
        if (headerEndIndex !== -1) {
          headersParsed = true;
          // Extract headers and body
          const headersPart = dataBuffer.substring(0, headerEndIndex);
          const bodyPart = dataBuffer.substring(headerEndIndex + 4);

          // Parse headers
          const headersLines = headersPart.split("\r\n");
          headersLines.shift(); // Remove the request line (e.g., POST / HTTP/1.1)

          headersLines.forEach((line) => {
            const [key, value] = line.split(":");
            if (key && /^Content-Length$/i.test(key.trim())) {
              contentLength = parseInt(value.trim(), 10);
            }
          });

          bodyBuffer += bodyPart;

          // Check if we have received the full body
          if (bodyBuffer.length >= contentLength) {
            await handleRequest(bodyBuffer, clientSocket);
          }
        }
      } else {
        // Headers have been parsed, collect body data
        bodyBuffer += chunk.toString();

        // Check if we have received the full body
        if (bodyBuffer.length >= contentLength) {
          await handleRequest(bodyBuffer, clientSocket);
        }
      }
    });

    clientSocket.on("error", (err) => {
      console.error("Client socket error:", err);
    });

    async function handleRequest(body: string, socket: net.Socket) {
      try {
        // Send the request to the RPC server using axios
        const response = await axios.post(NODE_RPC_URL, body, {
          headers: {
            "Content-Type": "application/json",
            Authorization: AUTH_HEADER,
          },
          responseType: "arraybuffer", // Ensure we get raw data
        });

        // Send the response back to the TCP client
        socket.write(response.data);
        socket.end();
      } catch (error) {
        console.error(
          `Error making request to RPC server: ${(error as AxiosError).message}`
        );
        socket.destroy();
      }
    }
  });

  tcpServer.listen(TCP_PORT, () => {
    console.log(`TCP proxy server running on port ${TCP_PORT}`);
  });
};
