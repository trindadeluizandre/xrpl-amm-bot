import { Client, Wallet, convertStringToHex, type AMMWithdraw, AMMWithdrawFlags } from "xrpl";

export async function withdrawFromAMMPool(
  client: Client,
  wallet: Wallet,
  rlusdIssuer: string,
  lpTokenValueToWithdraw: string,
  rlusdCurrencyCode: string = "RLUSD"
): Promise<string | null> {
  try {
    const formattedCurrency = rlusdCurrencyCode.length === 3 
      ? rlusdCurrencyCode 
      : convertStringToHex(rlusdCurrencyCode).padEnd(40, "0").toUpperCase();

    const ammWithdrawTx: AMMWithdraw = {
      TransactionType: "AMMWithdraw",
      Account: wallet.classicAddress,
      Asset: {
        currency: "XRP"
      },
      Asset2: {
        currency: formattedCurrency,
        issuer: rlusdIssuer
      },
      LPTokenIn: {
        currency: "",
        issuer: "",
        value: lpTokenValueToWithdraw
      },
      Flags: AMMWithdrawFlags.tfLPToken
    };

    const prepared = await client.autofill(ammWithdrawTx);
    // Margem de resiliência estendendo o limite de expiração da ordem
    prepared.LastLedgerSequence = (prepared.LastLedgerSequence ?? 0) + 50;

    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    if (typeof meta === "object" && meta?.TransactionResult === "tesSUCCESS") {
      return result.result.hash;
    } else {
      console.error("Resultado do AMMWithdraw:", meta);
      return null;
    }

  } catch (error) {
    console.error("Erro ao executar AMMWithdraw:", error);
    return null;
  }
}