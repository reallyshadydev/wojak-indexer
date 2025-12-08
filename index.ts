import dotenv from "dotenv";
dotenv.config();

import { createApiServer } from "./src/api";
import { databaseConnection } from "./src/database";
import { runIndexer } from "./src/indexer";
import { createInternalApiServer } from "./src/internalapi";
import { createRpcProxy } from "./src/rpcproxy";
import { checkEnvForFields, log } from "./src/utils";

const requiredEnvFields = [
  "DB_USER",
  "DB_PASSWORD",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "RPC_BASE_URL",
  "RPC_USER",
  "RPC_PASSWORD",
  "API_PORT",
  "USE_RATE_LIMIT",
];

const start = async () => {
  if (!checkEnvForFields(requiredEnvFields, "main")) {
    return;
  }

  const models = await databaseConnection(process.argv.includes("-new"));
  log("Database connection established", "Database");

  if (process.argv.includes("-indexer")) {
    runIndexer(models);
  }

  if (process.argv.includes("-rpcproxy")) {
    createRpcProxy(models);
  }

  if (process.argv.includes("-internalapi")) {
    createInternalApiServer(models);
  }

  if (process.argv.includes("-api")) {
    createApiServer(models);
  }
};

start();
