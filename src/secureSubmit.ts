import { Client, Wallet, type SubmittableTransaction } from "xrpl";

// Parâmetros Globais de Segurança Operacional
const MAX_FEE_DROPS = "100000"; // Teto máximo de taxa: 0,10 XRP (100.000 drops)
const MAX_RETRIES = 3;           // Número máximo de tentativas do disjuntor
const BASE_DELAY_MS = 2000;      // Tempo base de espera (2 segundos)

export async function submitTransactionWithSafety(
  client: Client,
  wallet: Wallet,
  tx: SubmittableTransaction
): Promise<string | null> {
  let attempt = 1;

  while (attempt <= MAX_RETRIES) {
    try {
      console.log(`\n[SEGURANÇA] Iniciando verificação de pré-voo (Tentativa ${attempt}/${MAX_RETRIES})...`);

      // 1. Preenche taxas e sequência automaticamente
      const prepared = await client.autofill(tx);

      // 2. VALIDAÇÃO DO FEE CAP (Teto de Taxa)
      const calculatedFee = parseInt(prepared.Fee || "0", 10);
      const maxAllowedFee = parseInt(MAX_FEE_DROPS, 10);

      if (calculatedFee > maxAllowedFee) {
        console.error(`[ALERTA DE SEGURANÇA] Taxa da rede (${calculatedFee / 1000000} XRP) excede o teto permitido (${maxAllowedFee / 1000000} XRP). Transação abortada.`);
        return null;
      }

      // 3. VALIDAÇÃO DE PRAZO DE VALIDADE (LastLedgerSequence)
      const currentLedger = await client.getLedgerIndex();
      // Define limite rigoroso de +4 blocos (~16 a 20 segundos)
      prepared.LastLedgerSequence = currentLedger + 4;

      // 4. Assina e Submete
      const signed = wallet.sign(prepared);
      const response = await client.submit(signed.tx_blob);

      const resultCode = response.result.engine_result;
      console.log(`[REDE XRPL] Código de Resposta: ${resultCode}`);

      if (resultCode === "tesSUCCESS" || resultCode.startsWith("ter")) {
        console.log(`[SUCESSO] Transação aceita no ledger! Hash: ${signed.hash}`);
        return signed.hash;
      } else {
        throw new Error(`Falha no processamento da transação. Código: ${resultCode}`);
      }

    } catch (error: any) {
      console.warn(`[AVISO] Tentativa ${attempt} falhou: ${error.message || error}`);

      if (attempt === MAX_RETRIES) {
        console.error(`[DISJUNTOR ATIVADO] Limite de ${MAX_RETRIES} tentativas atingido. Interrompendo operação para proteger a carteira.`);
        return null;
      }

      // Cálculo do Backoff Exponencial (2s, 4s, 8s...)
      const waitTime = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[DISJUNTOR] Aguardando ${waitTime / 1000}s antes de tentar novamente...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      attempt++;
    }
  }

  return null;
}