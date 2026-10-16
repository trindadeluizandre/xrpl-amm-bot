import { checkMainnetStatus } from "./checkMainnetBalance.js";
import { startDashboardServer } from "./server.js";

async function main(): Promise<void> {
  console.log("=================================================");
  console.log("    INICIANDO PROCESSO DE TELEMETRIA E BOT      ");
  console.log("=================================================");

  // 1. Auditoria de Saldo da Carteira Operacional
  await checkMainnetStatus();

  // 2. Leitura de Configurações do Ambiente via .env
  const rlusdIssuer = process.env.RLUSD_ISSUER_ADDRESS || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
  const poolAccountAddress = process.env.POSITION_WALLET_ADDRESS || "rSUA_CARTEIRA_POSICAO_AQUI";

  // 3. Inicialização do Dashboard de Monitoramento
  startDashboardServer(rlusdIssuer, poolAccountAddress);
}

main();