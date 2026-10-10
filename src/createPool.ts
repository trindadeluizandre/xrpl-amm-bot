import { Client, Wallet, convertStringToHex, type AMMCreate } from "xrpl";

export async function createAMMPool(
  client: Client,
  wallet: Wallet,
  rlusdIssuer: string,
  xrpAmountInDrops: string = "20000000",
  rlusdAmountValue: string = "100",
  tradingFee: number = 25,
  rlusdCurrencyCode: string = "RLUSD"
): Promise<string | null> {
  try {
    const formattedCurrency = rlusdCurrencyCode.length === 3 
      ? rlusdCurrencyCode 
      : convertStringToHex(rlusdCurrencyCode).padEnd(40, "0").toUpperCase();

    const ammCreateTx: AMMCreate = {
      TransactionType: "AMMCreate",
      Account: wallet.classicAddress,
      Amount: xrpAmountInDrops,
      Amount2: {
        currency: formattedCurrency,
        issuer: rlusdIssuer,
        value: rlusdAmountValue
      },
      TradingFee: tradingFee
    };

    // Preenchimento com ampliação do tempo limite para 50 ledgers
    const prepared = await client.autofill(ammCreateTx);
    prepared.LastLedgerSequence = (prepared.LastLedgerSequence ?? 0) + 50;

    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    if (typeof meta === "object" && meta?.TransactionResult === "tesSUCCESS") {
      return result.result.hash;
    } else {
      console.error("Resultado da Transação AMMCreate:", meta);
      return null;
    }

  } catch (error) {
    console.error("Erro ao executar AMMCreate:", error);
    return null;
  }
}