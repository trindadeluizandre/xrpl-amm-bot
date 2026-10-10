import { Client } from "xrpl";
import * as dotenv from "dotenv";
import { getProductionWallet } from "./walletManager.js";

dotenv.config();

const XRPL_SERVER = (process.env.XRPL_NODE_URL || "wss://xrplcluster.com").trim();
const RLUSD_ISSUER = (process.env.RLUSD_ISSUER_ADDRESS || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De").trim();

// Código Hexadecimal de 40 caracteres do RLUSD (524C555344)
const RLUSD_HEX = "524C555344000000000000000000000000000000";

export async function setupRLUSDTrustline(): Promise<string | null> {
  const client = new Client(XRPL_SERVER);

  try {
    console.log(`\n[MAINNET] Conectando ao cluster para configurar TrustSet: ${XRPL_SERVER}...`);
    await client.connect();

    const wallet = getProductionWallet();

    // Payload de transação em JSON
    const trustSetTx: any = {
      TransactionType: "TrustSet",
      Account: wallet.classicAddress,
      LimitAmount: {
        currency: RLUSD_HEX,
        issuer: RLUSD_ISSUER,
        value: "1000000000"
      }
    };

    console.log(`Submetendo TrustSet para a conta ${wallet.classicAddress}...`);
    console.log(`Emissor do RLUSD: ${RLUSD_ISSUER}`);

    const prepared = await client.autofill(trustSetTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    if (typeof meta === "object" && meta?.TransactionResult === "tesSUCCESS") {
      console.log(`TrustSet ativado com sucesso na Mainnet! Hash: ${result.result.hash}`);
      return result.result.hash;
    } else {
      console.error("Resultado do TrustSet:", meta);
      return null;
    }

  } catch (error: any) {
    console.error("Erro ao configurar TrustSet na Mainnet:", error.message || error);
    return null;
  } finally {
    await client.disconnect();
  }
}