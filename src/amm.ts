import { Client, convertStringToHex, type AMMInfoRequest, type AMMInfoResponse } from "xrpl";

export interface AMMPoolData {
  poolAddress: string;
  xrpBalance: string;
  rlusdBalance: string;
  lpTokenSupply: string;
  tradingFeePercent: number;
}

export function formatCurrencyCode(currency: string): string {
  if (currency.length === 3) {
    return currency;
  }
  return convertStringToHex(currency).padEnd(40, "0");
}

export async function getAMMInfo(
  client: Client,
  rlusdIssuer: string,
  rlusdCurrencyCode: string = "RLUSD"
): Promise<AMMPoolData | null> {
  try {
    const formattedCurrency = formatCurrencyCode(rlusdCurrencyCode);
    const ammRequest: AMMInfoRequest = {
      command: "amm_info",
      asset: {
        currency: "XRP"
      },
      asset2: {
        currency: formattedCurrency,
        issuer: rlusdIssuer
      }
    };

    const response: AMMInfoResponse = await client.request(ammRequest);
    const amm = response.result.amm;

    let xrpDrops = "0";
    let rlusdValue = "0";

    if (typeof amm.amount === "string") {
      xrpDrops = amm.amount;
      rlusdValue = (amm.amount2 as { value: string }).value;
    } else {
      rlusdValue = amm.amount.value;
      xrpDrops = amm.amount2 as string;
    }

    // Preserva a precisão das frações decimais de XRP evitando truncamento de BigInt
    const xrpBalance = (parseFloat(xrpDrops) / 1000000).toString();
    const tradingFeePercent = amm.trading_fee / 1000;

    return {
      poolAddress: amm.account,
      xrpBalance,
      rlusdBalance: rlusdValue,
      lpTokenSupply: amm.lp_token.value,
      tradingFeePercent
    };

  } catch (error: any) {
    // Tratamento de erro específico para quando o Pool simplesmente não existe na Ledger
    if (error?.data?.error === "actNotFound" || error?.data?.error === "ammNotFound") {
      return null;
    }
    throw error;
  }
}