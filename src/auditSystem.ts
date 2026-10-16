import { Client } from "xrpl";
import * as dotenv from "dotenv";

dotenv.config();

const XRPL_SERVER = process.env.XRPL_NODE_URL || "wss://xrplcluster.com";
const POSITION_WALLET = process.env.POSITION_WALLET_ADDRESS || "rSUA_CARTEIRA_POSICAO_AQUI";

export async function runSystemAudit(): Promise<void> {
  console.log("=================================================");
  console.log("      AUDITORIA INSTITUCIONAL DE SEGURANÇA       ");
  console.log("=================================================");

  const client = new Client(XRPL_SERVER);

  try {
    await client.connect();
    console.log("[CHECK 1] Conexão com o Cluster XRPL: OK");

    // 1. Verificação do Status do Nó e Reservas de Rede
    const serverInfo = await client.request({ command: "server_info" });
    const info = serverInfo.result.info;

    // Proteção contra undefined (Optional Chaining & Fallbacks)
    const ledgerSeq = info.validated_ledger?.seq ?? "N/A";
    const reserveBase = info.validated_ledger?.reserve_base_xrp ?? "N/A";

    console.log(`[CHECK 2] Ledger Validado Atual: #${ledgerSeq}`);
    console.log(`[CHECK 3] Reserve Base: ${reserveBase} XRP`);

    // 2. Verificação de Saldo da Carteira (Gas Tank)
    const accountInfo = await client.request({
      command: "account_info",
      account: POSITION_WALLET,
      ledger_index: "validated"
    });

    const balanceXrp = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
    console.log(`[CHECK 4] Saldo Livre de Gás: ${balanceXrp.toFixed(4)} XRP`);

    if (balanceXrp < 20) {
      console.warn("  --> ALERTA: Saldo de XRP abaixo da margem de conforto (20 XRP). Recomenda-se recarga.");
    } else {
      console.log("  --> Status de Gás: SEGURO E OPERACIONAL.");
    }

    console.log("\n[RESULTADO] Auditoria de Infraestrutura Concluída com Sucesso!");

  } catch (error: any) {
    console.error("[FALHA DE AUDITORIA] Erro detectado:", error.message);
  } finally {
    await client.disconnect();
  }
}

runSystemAudit();