import express, { Request, Response } from "express";
import { getHolders, IHolder } from "../utils/holders";

export const HoldersRouter = express.Router();

HoldersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Get holders from global cache (updated every minute)
    const allHolders: IHolder[] = req.global.holders || [];

    // Convert balance from satoshis to coins
    const holdersWithCoins = allHolders.map((holder) => ({
      ...holder,
      balance: holder.balance / 1e8, // Convert satoshis to coins
      balance_satoshis: holder.balance,
    }));

    const paginatedHolders = holdersWithCoins.slice(offset, offset + limit);

    res.json({
      page,
      limit,
      total: allHolders.length,
      total_pages: Math.ceil(allHolders.length / limit),
      holders: paginatedHolders,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

HoldersRouter.get("/top/:limit", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.params.limit) || 100;
    const maxLimit = Math.min(limit, 1000); // Cap at 1000

    const allHolders: IHolder[] = req.global.holders || [];

    const topHolders = allHolders.slice(0, maxLimit).map((holder) => ({
      ...holder,
      balance: holder.balance / 1e8, // Convert satoshis to coins
      balance_satoshis: holder.balance,
    }));

    res.json({
      limit: maxLimit,
      total: allHolders.length,
      holders: topHolders,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default HoldersRouter;

