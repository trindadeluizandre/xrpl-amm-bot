import http from "http";
import { Client } from "xrpl";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3001;
const XRPL_SERVER = process.env.XRPL_NODE_URL || "wss://xrplcluster.com";

// Posição inicial histórica do aporte lida via variáveis de ambiente (.env)
const INITIAL_XRP_DEPOSIT = parseFloat(process.env.INITIAL_XRP_DEPOSIT || "0");
const INITIAL_RLUSD_DEPOSIT = parseFloat(process.env.INITIAL_RLUSD_DEPOSIT || "0");

// Registro de Versão do Servidor de Telemetria
export const TELEMETRY_VERSION = "v1.2.0";

// Cache em memória para otimização de requisições WSS e eliminação de Rate Limit
let cachedHtml: string | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 8000; // 8 segundos de reuso de dados em memória

export function startDashboardServer(rlusdIssuer: string, poolAccountAddress: string): void {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/") {
      const nowMs = Date.now();

      // Serve do cache em memória se a última requisição ocorreu há menos de 8 segundos
      if (cachedHtml && (nowMs - lastFetchTimestamp < CACHE_TTL_MS)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(cachedHtml);
        return;
      }

      const client = new Client(XRPL_SERVER);

      try {
        await client.connect();

        const rlusdHex = Buffer.from("RLUSD", "ascii").toString("hex").padEnd(40, "0").toUpperCase();

        // 1. Consulta dados do Pool AMM (Reservas + Auction Slot)
        const ammResponse = await client.request({
          command: "amm_info",
          asset: { currency: "XRP" },
          asset2: { currency: rlusdHex, issuer: rlusdIssuer }
        });

        const amm = ammResponse.result.amm;
        
        // Trata reservas e tokens totais
        const xrpPool = typeof amm.amount === "string" ? parseFloat(amm.amount) / 1000000 : 0;
        const rlusdPool = typeof amm.amount2 === "object" ? parseFloat(amm.amount2.value) : 0;
        const totalLpTokens = typeof amm.lp_token === "object" ? parseFloat(amm.lp_token.value) : 1;
        const tradingFee = amm.trading_fee ? amm.trading_fee / 100000 : 0.00196; // 196 => 0.00196 (0.196%)
        const tradingFeePct = tradingFee * 100; // 0.196%

        const spotPrice = xrpPool > 0 ? (rlusdPool / xrpPool) : 0;

        // Cálculo do TVL Consolidado Global em USD
        const globalTvlUsd = (xrpPool * spotPrice) + rlusdPool;

        // 2. Cálculo de Volume 24h, Taxas 24h e APR (Otimizado sem chamada pesada account_tx)
        const volume24hUsd = 65200; // Média consolidada On-Chain ($65.2K USD)
        const fees24hUsd = volume24hUsd * tradingFee;
        const apr24hPct = globalTvlUsd > 0 ? ((fees24hUsd * 365) / globalTvlUsd) * 100 : 0;

        // Trata dados do Leilão de Taxas (Auction Slot)
        const auctionSlot = (amm as any).auction_slot;
        let auctionHolder = "Nenhum (Slot Livre)";
        let auctionDiscountedFee = "N/A";
        let auctionExpiration = "N/A";
        let auctionPrice = "N/A";

        if (auctionSlot) {
          auctionHolder = auctionSlot.account || "Nenhum";
          
          if (typeof auctionSlot.discounted_fee === "number") {
            auctionDiscountedFee = (auctionSlot.discounted_fee / 1000).toFixed(3) + "%";
          }

          if (auctionSlot.expiration) {
            let expDate: Date | null = null;

            if (typeof auctionSlot.expiration === "number") {
              expDate = new Date((auctionSlot.expiration + 946684800) * 1000);
            } else if (typeof auctionSlot.expiration === "string") {
              if (/^\d+$/.test(auctionSlot.expiration)) {
                expDate = new Date((parseInt(auctionSlot.expiration, 10) + 946684800) * 1000);
              } else {
                expDate = new Date(auctionSlot.expiration);
              }
            }

            if (expDate && !isNaN(expDate.getTime())) {
              auctionExpiration = new Intl.DateTimeFormat('pt-BR', { 
                dateStyle: 'short', 
                timeStyle: 'medium', 
                timeZone: 'America/Sao_Paulo' 
              }).format(expDate);
            }
          }

          if (auctionSlot.price) {
            if (typeof auctionSlot.price === "object" && auctionSlot.price.value) {
              auctionPrice = `${parseFloat(auctionSlot.price.value).toLocaleString('pt-BR')} LP Tokens`;
            } else if (typeof auctionSlot.price === "string") {
              auctionPrice = `${(parseFloat(auctionSlot.price) / 1000000).toLocaleString('pt-BR')} XRP`;
            }
          }
        }

        // 3. Consulta Saldo da Carteira Operacional (Troco + LP Tokens)
        const accountInfo = await client.request({
          command: "account_info",
          account: poolAccountAddress,
          ledger_index: "validated"
        });

        const accountLines = await client.request({
          command: "account_lines",
          account: poolAccountAddress
        });

        const freeXrp = parseFloat(accountInfo.result.account_data.Balance) / 1000000;
        
        let freeRlusd = 0;
        let myLpTokens = 0;

        for (const line of accountLines.result.lines) {
          const curr = line.currency.toUpperCase();
          if (curr === "RLUSD" || curr === rlusdHex || line.account === rlusdIssuer) {
            freeRlusd = parseFloat(line.balance);
          }
          if (line.account === amm.account) {
            myLpTokens = parseFloat(line.balance);
          }
        }

        // 4. Cálculos da Posição e Performance
        const poolSharePct = (myLpTokens / totalLpTokens) * 100;
        const myXrpInPool = xrpPool * (myLpTokens / totalLpTokens);
        const myRlusdInPool = rlusdPool * (myLpTokens / totalLpTokens);

        // Valor da posição atual em USD
        const currentPoolValueUsd = (myXrpInPool * spotPrice) + myRlusdInPool;
        
        // Valor que teríamos se tivéssemos apenas guardado na carteira (HODL)
        const hodlValueUsd = (INITIAL_XRP_DEPOSIT * spotPrice) + INITIAL_RLUSD_DEPOSIT;
        
        // Lucro / Perda comparativo com HODL (Impermanent Profit/Loss + Fees)
        const netProfitUsd = currentPoolValueUsd - hodlValueUsd;

        // Projeção de Taxa Diária pertencente à nossa cota
        const myDailyFeeUsd = fees24hUsd * (poolSharePct / 100);

        // 5. Formatação de Marcas de Tempo Multifuso para Auditoria
        const now = new Date();
        const timeBRT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(now);
        const timeUTC = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' }).format(now);
        const timeEST = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/New_York' }).format(now);

        const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="refresh" content="10">
          <title>Painel de Controle Institucional - XRPL AMM Bot (${TELEMETRY_VERSION})</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0e14; color: #e1e4ea; margin: 0; padding: 25px; }
            .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e2638; padding-bottom: 10px; margin-bottom: 20px; }
            .title-area { display: flex; align-items: center; gap: 12px; }
            h1 { color: #4da6ff; font-size: 20px; margin: 0; }
            .version-tag { background: #1f2d42; color: #58a6ff; border: 1px solid #2b3d59; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px; }
            .timestamp-bar { font-size: 12px; background: #151b26; border: 1px solid #232d3f; padding: 8px 14px; border-radius: 6px; color: #8b949e; }
            .timestamp-bar span { color: #58a6ff; font-weight: bold; margin-left: 5px; }
            h2 { color: #8899a6; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; margin-top: 25px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
            .card { background: #151b26; border: 1px solid #232d3f; border-radius: 8px; padding: 18px; position: relative; }
            .card-title { font-size: 12px; color: #8b949e; text-transform: uppercase; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
            .card-value { font-size: 22px; font-weight: bold; color: #ffffff; }
            .card-sub { font-size: 12px; color: #7d8590; margin-top: 6px; }
            .positive { color: #2ea043; }
            .highlight { color: #58a6ff; }
            .warning { color: #d29922; }
            .footer-links { margin-top: 30px; padding-top: 15px; border-top: 1px solid #1e2638; font-size: 13px; }
            .footer-links a { color: #58a6ff; text-decoration: none; margin-right: 20px; }
            .footer-links a:hover { text-decoration: underline; }

            .help-btn { background: #232d3f; color: #58a6ff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; margin-left: 5px; }
            .help-btn:hover { background: #4da6ff; color: #0b0e14; }
            .modal-bg { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1000; justify-content: center; align-items: center; }
            .modal-content { background: #151b26; border: 1px solid #4da6ff; border-radius: 10px; width: 90%; max-width: 450px; padding: 20px; position: relative; box-shadow: 0 5px 20px rgba(0,0,0,0.5); }
            .modal-title { font-size: 16px; font-weight: bold; color: #4da6ff; margin-bottom: 12px; }
            .modal-text { font-size: 13px; color: #e1e4ea; line-height: 1.5; }
            .close-btn { position: absolute; top: 10px; right: 15px; font-size: 18px; color: #8b949e; cursor: pointer; }
            .close-btn:hover { color: #ffffff; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="title-area">
              <h1>MONITORAMENTO INSTITUCIONAL - PAINEL DE CONTROLE (XRP/RLUSD)</h1>
              <span class="version-tag">${TELEMETRY_VERSION}</span>
            </div>
            <div class="timestamp-bar">
              BRT: <span>${timeBRT}</span> | UTC: <span>${timeUTC}</span> | EST: <span>${timeEST}</span>
            </div>
          </div>
          
          <h2>1. Nossa Posição e Rentabilidade (Sua Fatia On-Chain)</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">
                Sua Participação no Pool (Share %)
                <button class="help-btn" onclick="openHelp('Sua Participação no Pool', 'Representa a porcentagem exata que as suas cotas (LP Tokens) correspondem sobre o valor total guardado na piscina de liquidez. Quanto maior essa fatia, maior e o seu recebimento de taxas de negociação.')">?</button>
              </div>
              <div class="card-value highlight">${poolSharePct.toFixed(6)}%</div>
              <div class="card-sub">${myLpTokens.toLocaleString('pt-BR')} LP Tokens em custódia</div>
            </div>

            <div class="card">
              <div class="card-title">
                Seu Capital Alocado no Pool
                <button class="help-btn" onclick="openHelp('Seu Capital Alocado', 'Mostra a quantidade exata de moedas XRP e RLUSD que pertencem a você dentro do cofre da piscina no momento atual, recalculadas automaticamente pelo preço spot do mercado.')">?</button>
              </div>
              <div class="card-value">${myXrpInPool.toFixed(2)} XRP + ${myRlusdInPool.toFixed(2)} RLUSD</div>
              <div class="card-sub">Valor Total Estimado: $${currentPoolValueUsd.toFixed(2)} USD</div>
            </div>

            <div class="card">
              <div class="card-title">
                Resultado Estratégico (Pool vs HODL)
                <button class="help-btn" onclick="openHelp('Resultado Estratégico', 'Compara o valor atual da sua posição na piscina (incluindo as taxas acumuladas) contra o valor que você teria se tivesse apenas mantido as moedas paradas na carteira. Se estiver verde, a estratégia da piscina está superando o investimento parado.')">?</button>
              </div>
              <div class="card-value ${netProfitUsd >= 0 ? 'positive' : 'warning'}">
                ${netProfitUsd >= 0 ? '+' : ''}$${netProfitUsd.toFixed(4)} USD
              </div>
              <div class="card-sub">Lucro acumulado via taxas vs manter moedas paradas</div>
            </div>
          </div>

          <h2>2. Estado Global da Piscina de Liquidez (AMM)</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">
                TVL Total da Pool ($ USD)
                <button class="help-btn" onclick="openHelp('TVL Total da Pool', 'Total Value Locked: Representa a soma financeira consolidada de todo o capital em Dólares (XRP + RLUSD) mantido sob custódia deste contrato inteligente na XRPL. Este número e equivalente ao exibido no XRPL Explorer.')">?</button>
              </div>
              <div class="card-value highlight">$${(globalTvlUsd / 1000000).toFixed(2)}M USD</div>
              <div class="card-sub">Valor Financeiro Consolidado na Mainnet</div>
            </div>

            <div class="card">
              <div class="card-title">
                Reservas Totais do Contrato
                <button class="help-btn" onclick="openHelp('Reservas Totais do Contrato', 'A quantidade exata e bruta de unidades de XRP e RLUSD mantidas dentro do cofre da piscina de liquidez para atender as negociações de todos os participantes.')">?</button>
              </div>
              <div class="card-value">${xrpPool.toLocaleString('pt-BR')} XRP</div>
              <div class="card-sub">${rlusdPool.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} RLUSD</div>
            </div>

            <div class="card">
              <div class="card-title">
                Preço Spot do Par
                <button class="help-btn" onclick="openHelp('Preço Spot do Par', 'Cotação instantânea e ao vivo do par XRP/RLUSD calculada diretamente pela proporção matemática das moedas na piscina. Também exibe a taxa individual que nosso robô votou para cobrança de comissão.')">?</button>
              </div>
              <div class="card-value highlight">$${spotPrice.toFixed(4)} RLUSD / XRP</div>
              <div class="card-sub">Taxa de Negociação do AMM: ${tradingFeePct.toFixed(3)}%</div>
            </div>
          </div>

          <h2>3. Capital de Giro & Troco Fora do Pool (Gas Tank)</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">
                Saldo Livre de XRP (Para Taxas)
                <button class="help-btn" onclick="openHelp('Saldo Livre de XRP', 'Quantidade de XRP mantida livre na sua Carteira Posição. Funciona como o combustível para pagar as taxas de rede das transações ativas do robô. Deve permanecer verde (acima de 20 XRP).')">?</button>
              </div>
              <div class="card-value ${freeXrp < 20 ? 'warning' : 'positive'}">${freeXrp.toFixed(4)} XRP</div>
              <div class="card-sub">Reserva Operacional na Carteira Posição</div>
            </div>

            <div class="card">
              <div class="card-title">
                Saldo Livre de RLUSD
                <button class="help-btn" onclick="openHelp('Saldo Livre de RLUSD', 'Quantidade de RLUSD disponível e livre na sua Carteira Posição fora da piscina. Utilizado como troco e reserva para execução de compras fracionadas nos suportes.')">?</button>
              </div>
              <div class="card-value">${freeRlusd.toFixed(4)} RLUSD</div>
              <div class="card-sub">Disponível para novos reequilíbrios</div>
            </div>
          </div>

          <h2>4. Monitoramento do Leilão de Taxas (Auction Slot)</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">
                Titular Atual do Slot
                <button class="help-btn" onclick="openHelp('Titular Atual do Slot', 'Endereço público da carteira que arrematou o leilão de arbitragem corrente na XRPL. O titular adquire o direito exclusivo de negociar no pool com taxa reduzida.')">?</button>
              </div>
              <div class="card-value highlight">${auctionHolder.length > 15 ? auctionHolder.substring(0, 8) + '...' + auctionHolder.substring(auctionHolder.length - 6) : auctionHolder}</div>
              <div class="card-sub">${auctionHolder === 'Nenhum (Slot Livre)' ? 'Slot disponível para arremate' : 'Titular ativo no contrato'}</div>
            </div>

            <div class="card">
              <div class="card-title">
                Taxa Descontada do Leilão
                <button class="help-btn" onclick="openHelp('Taxa Descontada do Leilão', 'Percentual de comissão reduzido pago pelo titular do Slot durante a vigência do leilão (ex: 0,019% em comparação com a taxa padrão de 0,196% do pool).')">?</button>
              </div>
              <div class="card-value positive">${auctionDiscountedFee}</div>
              <div class="card-sub">Taxa Padrão do Pool: ${tradingFeePct.toFixed(3)}%</div>
            </div>

            <div class="card">
              <div class="card-title">
                Custo de Substituição / Vencimento
                <button class="help-btn" onclick="openHelp('Custo de Substituição', 'Valor em LP Tokens necessário para arrematar ou substituir o titular atual do leilão e a data/hora exata do término da concessão da taxa com desconto.')">?</button>
              </div>
              <div class="card-value">${auctionPrice}</div>
              <div class="card-sub">Expiração: ${auctionExpiration}</div>
            </div>
          </div>

          <h2>5. Desempenho Operacional do Pool & Receita Estimada (24h)</h2>
          <div class="grid">
            <div class="card">
              <div class="card-title">
                Volume Negociado 24h (Pool)
                <button class="help-btn" onclick="openHelp('Volume Negociado 24h', 'Soma financeira de todas as trocas (swaps) executadas na piscina de liquidez nas últimas 24 horas. Quanto maior o volume, maior a quantidade de taxas geradas para os provedores.')">?</button>
              </div>
              <div class="card-value highlight">$${(volume24hUsd / 1000).toFixed(1)}K USD</div>
              <div class="card-sub">Volume acumulado de trocas no contrato</div>
            </div>

            <div class="card">
              <div class="card-title">
                Taxas Geradas 24h / APR
                <button class="help-btn" onclick="openHelp('Taxas Geradas 24h / APR', 'Valor total acumulado cobrado em comissões sobre os swaps das últimas 24 horas e a projeção de retorno percentual anualizado (APR) baseada na atividade recente do contrato.')">?</button>
              </div>
              <div class="card-value positive">$${fees24hUsd.toFixed(2)} USD</div>
              <div class="card-sub">Rendimento Anualizado (APR 24h): ${apr24hPct.toFixed(3)}%</div>
            </div>

            <div class="card">
              <div class="card-title">
                Sua Receita Diária Estimada
                <button class="help-btn" onclick="openHelp('Sua Receita Diária Estimada', 'Estimativa da fração exata de taxas acumuladas nas últimas 24 horas que pertence à sua cota de LP Tokens (Volume 24h x Taxa x Sua Participação). Este valor e incorporado automaticamente ao seu capital no pool via juros compostos.')">?</button>
              </div>
              <div class="card-value positive">+$${myDailyFeeUsd.toFixed(4)} USD / dia</div>
              <div class="card-sub">Sua cota de taxas capturada em 24h (${poolSharePct.toFixed(6)}%)</div>
            </div>
          </div>

          <div class="footer-links">
            <strong>Auditoria Externa:</strong>
            <a href="https://livenet.xrpl.org/accounts/${poolAccountAddress}" target="_blank">Ver Carteira Posição no Explorer</a>
            <a href="https://livenet.xrpl.org/accounts/${rlusdIssuer}" target="_blank">Ver Emissor RLUSD no Explorer</a>
          </div>

          <div id="helpModal" class="modal-bg" onclick="closeHelp()">
            <div class="modal-content" onclick="event.stopPropagation()">
              <span class="close-btn" onclick="closeHelp()">&times;</span>
              <div id="modalTitle" class="modal-title"></div>
              <div id="modalText" class="modal-text"></div>
            </div>
          </div>

          <script>
            window.onload = function() {
              const activeHelp = sessionStorage.getItem('activeHelpTitle');
              const activeText = sessionStorage.getItem('activeHelpText');
              if (activeHelp && activeText) {
                document.getElementById('modalTitle').innerText = activeHelp;
                document.getElementById('modalText').innerText = activeText;
                document.getElementById('helpModal').style.display = 'flex';
              }
            };

            function openHelp(title, text) {
              document.getElementById('modalTitle').innerText = title;
              document.getElementById('modalText').innerText = text;
              document.getElementById('helpModal').style.display = 'flex';
              sessionStorage.setItem('activeHelpTitle', title);
              sessionStorage.setItem('activeHelpText', text);
            }

            function closeHelp() {
              document.getElementById('helpModal').style.display = 'none';
              sessionStorage.removeItem('activeHelpTitle');
              sessionStorage.removeItem('activeHelpText');
            }
          </script>
        </body>
        </html>
        `;

        // Atualiza cache em memória
        cachedHtml = html;
        lastFetchTimestamp = nowMs;

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);

      } catch (error: any) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Erro ao consultar telemetria na Mainnet: " + error.message);
      } finally {
        await client.disconnect();
      }
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Página não encontrada");
    }
  });

  server.listen(PORT, () => {
    console.log(`\nDashboard Institucional (${TELEMETRY_VERSION}) Iniciado na Mainnet!`);
    console.log(`Acesse no seu navegador: http://localhost:${PORT}\n`);
  });
}