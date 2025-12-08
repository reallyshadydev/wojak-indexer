import { Op } from "sequelize";
import { getBlock } from "./blockchain";
import { Models } from "./database";
import {
  BlockData,
  FullTransaction,
  Transaction,
  UTXO,
  UTXODeleteKey,
} from "./types";
import { log, sleep } from "./utils";
import e from "express";

const getLastProcessedBlock = async (models: Models) => {
  const { Setting } = models;

  const [setting, created] = await Setting.findOrCreate({
    where: {
      key: "last_processed_block",
    },
    defaults: {
      key: "last_processed_block",
      value: "-1", // Set to -1 to start from block 0
    },
  });

  return setting.value;
};

const setLastProcessedBlock = async (models: Models, blockNum: number) => {
  const { Setting } = models;

  await Setting.upsert({
    key: "last_processed_block",
    value: blockNum.toString(),
  });
};

const getNewUtxosFromBlock = (block: BlockData<FullTransaction>): UTXO[] => {
  const utxos: UTXO[] = [];

  for (const transaction of block.tx) {
    for (const vout of transaction.vout) {
      // Only index UTXOs with valid addresses - ignore outputs without addresses (e.g., OP_RETURN, invalid scripts)
      const address = vout.scriptPubKey?.addresses?.[0];
      if (!address || address.trim() === "") {
        continue; // Skip outputs without valid addresses (change outputs to invalid addresses)
      }

      utxos.push({
        txid: transaction.txid,
        vout: vout.n,
        address: address,
        amount: Math.round(vout.value * 1e8).toString(), // WojakCoin uses 1e8 like Bitcoin
        hex: transaction.rawHex,
        block: block.height,
        block_hash: block.hash,
        block_timestamp: BigInt(block.time),
      });
    }
  }

  return utxos;
};

const getUsedUtxosFromBlock = (
  block: BlockData<FullTransaction>
): UTXODeleteKey[] => {
  const utxos: UTXODeleteKey[] = [];

  for (const transaction of block.tx) {
    for (const vin of transaction.vin) {
      if (vin.coinbase) {
        continue;
      }

      utxos.push({
        txid: vin.txid,
        vout: vin.vout,
      });
    }
  }

  return utxos;
};

const getTransactionsFromBlock = (block: BlockData<FullTransaction>) => {
  const transactions = block.tx.map((tx) => {
    return {
      txid: tx.txid,
      block_height: block.height,
      hash: tx.hash,
      size: tx.size,
      locktime: tx.locktime,
      version: tx.version,
      vsize: tx.vsize,
      vin: tx.vin.map((input) => {
        return {
          txid: input.txid,
          vout: input.vout,
          scriptSig: input.scriptSig,
          coinbase: input.coinbase,
          sequence: input.sequence,
        };
      }),
      vout: tx.vout.map((output) => {
        if (!output.scriptPubKey.addresses) return;

        return {
          scriptPubKey: output.scriptPubKey,
          n: output.n,
          value: output.value,
        };
      }),
    };
  }) as Transaction[];

  return transactions;
};

type UpdateBlockArgs = {
  transactions: Transaction[];
  add_utxos: UTXO[];
  delete_utxos: UTXODeleteKey[];
  block_data: BlockData<FullTransaction>;
};

const createBlockArgs = async (blockNum: number): Promise<UpdateBlockArgs> => {
  const block: BlockData<FullTransaction> = await getBlock(blockNum);

  return {
    transactions: getTransactionsFromBlock(block),
    add_utxos: getNewUtxosFromBlock(block),
    delete_utxos: getUsedUtxosFromBlock(block),
    block_data: block,
  };
};

export const runIndexer = async (models: Models) => {
  console.log("Connected!");

  // Retrieve the last processed block once
  const lastProcessedBlock = await getLastProcessedBlock(models);
  let currentBlockNum = Number(lastProcessedBlock) + 1; // Start from the next block
  let deletedUtxos: UTXO[] = [];
  while (true) {
    try {
      log(`Processing block ${currentBlockNum}...`);
      const blockargs = await createBlockArgs(currentBlockNum);

      if (blockargs.add_utxos.length > 0) {
        // Filter out UTXOs with empty/invalid addresses before storing
        const validUtxos = blockargs.add_utxos.filter(utxo => utxo.address && utxo.address.trim() !== "");
        if (validUtxos.length > 0) {
          await models.Utxo.bulkCreate(validUtxos, {
            updateOnDuplicate: Object.keys(
              models.Utxo.getAttributes()
            ) as (keyof UTXO)[],
          });
        }
      }

      if (blockargs.delete_utxos.length > 0) {
        deletedUtxos = await models.Utxo.findAll({
          where: {
            [Op.or]: blockargs.delete_utxos.map((utxo) => ({
              txid: utxo.txid,
              vout: utxo.vout,
            })),
          },
        });
        await models.Utxo.destroy({
          where: {
            [Op.or]: blockargs.delete_utxos.map((utxo) => ({
              txid: utxo.txid,
              vout: utxo.vout,
            })),
          },
        });
      }
      const newUtxoAddresses = blockargs.add_utxos.map((utxo) => utxo.address);
      const existingAddresses = await models.Address.findAll({
        where: {
          address: newUtxoAddresses, // Automatically handled as IN query
        },
        attributes: ["address"], // Only fetch the address field
        raw: true, // Return plain objects instead of Sequelize instances
      });

      // Extract existing addresses into a simple array
      const existingAddressSet = new Set(
        existingAddresses.map((addr) => addr.address)
      );

      // Find addresses not in the database
      const nonExistingAddresses = newUtxoAddresses.filter(
        (address) => !existingAddressSet.has(address)
      );

      const updateLastSeenAddresses = [
        ...new Set(
          [deletedUtxos.map((utxo) => utxo.address), ...nonExistingAddresses]
            .flat(Infinity)
            .filter(Boolean) as string[]
        ),
      ];

      // Prepare data for bulk create/update
      const addressData = updateLastSeenAddresses.map((address) => ({
        address,
        lastSeen: blockargs.block_data.time,
      }));

      await models.Address.bulkCreate(addressData, {
        updateOnDuplicate: ["lastSeen"], // Fields to update if a record with the same primary key exists
      });

      if (blockargs.transactions.length > 0) {
        await models.Transaction.bulkCreate(blockargs.transactions, {
          updateOnDuplicate: Object.keys(
            models.Transaction.getAttributes()
          ) as (keyof Transaction)[],
        });
      }

      await setLastProcessedBlock(models, currentBlockNum);

      // Increment the block number for the next iteration
      currentBlockNum++;
    } catch (error) {
      log(`Error processing block ${currentBlockNum}`);
      log("Waiting for new blocks...");

      // Wait for new blocks using sleep from ./utils
      while (true) {
        await sleep(500); // Sleep for 60 seconds
        try {
          const block: BlockData<FullTransaction> = await getBlock(
            currentBlockNum + 1
          );
          if (block) {
            break;
          }
        } catch (e) {} //this is guaranteed to fail (we are actually checking if theres a failure to see if the block is there)
      }
    }
  }
};
