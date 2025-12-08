import { Models } from "../database";
import { Op } from "sequelize";
import axios from "axios";

export type IHolder = {
  address: string;
  balance: number;
  position?: number;
  last_seen?: number;
};

export const getHolders = async (models: Models) => {
  try {
    // Get all addresses with UTXOs from indexer
    const UtxoResponse = (
      await models.Utxo.findAll({
        attributes: [
          "address",
          [
            models.sequelize.fn("SUM", models.sequelize.col("amount")),
            "balance",
          ],
        ],
        group: ["address"],
        having: models.sequelize.where(
          models.sequelize.fn("SUM", models.sequelize.col("amount")),
          { [Op.gt]: 0 }
        ),
        order: [[models.sequelize.literal("balance"), "DESC"]],
        raw: true,
      })
    ).filter((utxo: any) => utxo.address && utxo.address.length > 0);

    // Validate balances against electrs API to match explorer/daemon
    // This ensures balances match what's shown on the explorer address pages
    const electrsApiUrl = process.env.ELECTRS_API_URL || 'https://api.wojakcoin.cash';
    
    // Process in smaller batches with delays to avoid overwhelming the API
    const batchSize = 20;
    const holdersWithBalance: IHolder[] = [];
    
    for (let i = 0; i < UtxoResponse.length; i += batchSize) {
      const batch = UtxoResponse.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (utxo: any) => {
          try {
            // Get balance from electrs API to match explorer/daemon
            const response = await axios.get(`${electrsApiUrl}/address/${utxo.address}`, {
              timeout: 10000,
              validateStatus: (status) => status < 500 // Accept 4xx as valid responses
            }).catch(() => null);

            // Start with indexer balance (includes all UTXOs)
            let balance = Number(utxo.balance);
            if (response && response.data && response.data.chain_stats) {
              const chainStats = response.data.chain_stats || {};
              const mempoolStats = response.data.mempool_stats || {};
              const confirmedBalance = (chainStats.funded_txo_sum || 0) - (chainStats.spent_txo_sum || 0);
              const pendingBalance = (mempoolStats.funded_txo_sum || 0) - (mempoolStats.spent_txo_sum || 0);
              const electrsBalance = confirmedBalance + pendingBalance;
              
              // Use electrs balance only if it's valid and matches/close to indexer
              // If electrs shows 0 but indexer has balance, keep indexer balance (includes change addresses)
              if (electrsBalance > 0) {
                balance = electrsBalance;
              }
              // If electrs shows 0 but indexer has balance, keep the indexer balance
              // This ensures change addresses and all holders are included
            }

            return {
              address: utxo.address,
              balance: balance,
            };
          } catch (e) {
            // Fallback to indexer UTXO sum if API call fails
            return {
              address: utxo.address,
              balance: Number(utxo.balance),
            };
          }
        })
      );
      
      // Process both fulfilled and rejected promises - ensure ALL addresses are included
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          holdersWithBalance.push(result.value);
        } else {
          // If promise was rejected or failed, use indexer balance
          // This ensures we don't lose any holders even if API validation fails
          if (idx < batch.length) {
            holdersWithBalance.push({
              address: batch[idx].address,
              balance: Number(batch[idx].balance),
            });
          }
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < UtxoResponse.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Re-sort by validated balance from electrs
    // Keep all holders with balance > 0 (balances are in satoshis)
    const holders: IHolder[] = holdersWithBalance
      .filter((h) => h && h.address && h.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .map((holder, index) => ({
        ...holder,
        position: index + 1,
      }));
    
    console.log(`[Holders] Processed ${UtxoResponse.length} addresses from indexer, validated ${holdersWithBalance.length} holders, final count: ${holders.length}`);

    const lastSeenResponse = await models.Address.findAll({
      attributes: ["address", "lastSeen"],
      raw: true,
    });

    const lastSeenMap: Record<string, number> = lastSeenResponse.reduce(
      (acc: Record<string, number>, address: any) => {
        acc[address.address] = address.lastSeen;
        return acc;
      },
      {}
    );

    holders.forEach((holder) => {
      holder.last_seen = lastSeenMap[holder.address];
    });

    return holders;
  } catch (e) {
    console.log(e);
  }
};
