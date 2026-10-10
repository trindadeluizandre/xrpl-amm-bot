MANUAL DE PROCEDIMENTOS OPERACIONAIS PADRÃO (SOP)

Projeto: xrpl-amm-bot  
Ambiente: Production / XRPL Mainnet  
Função: Diretrizes de Manutenção, Telemetria e Auditoria de Infraestrutura Financeira  

______________________________________________________________________________________

CAPÍTULO 1: PROGRAMA DIÁRIO - INSPEÇÃO DE TELEMETRIA E DADOS ON-CHAIN

Frequência: Duas vistorias fixas por dia (Abertura da Manhã e Encerramento da Noite).

1.1 Turno de Abertura (Manhã)

1. Inicialização da Telemetria:
   - Executar o comando no terminal: `npm start`
   - Confirmar o status HTTP 200 OK e acessar a interface local em `http://localhost:3001`.

2. Coleta de Métricas Sequenciais On-Chain (Mapeamento 1:1 Dashboard v1.2.0):
   - SEÇÃO 1: Posição e Rentabilidade (Fatia On-Chain):
     * B1.1 - Participação no Pool: Cota percentual (Share %) e volume de LP Tokens em custódia.
     * B1.2 - Capital Alocado Pool: Volume fracionado em XRP + RLUSD e Valor Total Estimado em USD.
     * B1.3 - Resultado Estratégico: Lucro acumulado via taxas vs manter HODL ($ USD).
   - SEÇÃO 2: Estado Global da Piscina de Liquidez (AMM):
     * B2.1 - TVL Total da Pool: Valor financeiro consolidado no contrato Mainnet ($ USD).
     * B2.2 - Reservas do Contrato: Custódia global de XRP e RLUSD depositados no contrato.
     * B2.3 - Preço Spot do Par: Cotação instantânea XRP/RLUSD e Taxa Padrão do AMM (0.196%).
   - SEÇÃO 3: Capital de Giro & Troco Fora do Pool (Gas Tank):
     * B3.1 - Gas Tank (Reserva XRP): Saldo livre na Carteira Posição (> 20.0000 XRP).
     * B3.2 - Saldo Livre (RLUSD): Disponibilidade de liquidez fora do pool para reequilíbrios.
   - SEÇÃO 4: Monitoramento do Leilão de Taxas (Auction Slot):
     * B4.1 - Titular do Slot: Identificação do endereço ativo no contrato.
     * B4.2 - Taxa Descontada: Percentual de taxa reduzida do titular atual (%).
     * B4.3 - Custo de Substituição: LP Tokens necessários para lance e Data/Hora de Vencimento.
   - SEÇÃO 5: Desempenho Operacional do Pool & Receita Estimada (24h):
     * B5.1 - Volume Negociado 24h: Volume financeiro total movimentado no contrato ($ USD).
     * B5.2 - Taxas Geradas / APR: Rendimento bruto em 24h ($ USD) e Taxa Anualizada (APR %).
     * B5.3 - Receita Diária Estimada: Cota diária capturada em dólares (+ $ USD / dia).
   - Extremos Históricos (ATH / Mínimas):
     * Comparar Preço Spot, Capital Alocado, Resultado Estratégico e Custódia XRP/RLUSD com a tabela de recordes históricos e atualizar os limites caso ocorra rompimento de topo ou fundo.

3. Coleta de Evidência e Registro:
   - Salvar captura de tela da interface no diretório: `docs/assets/YYYYMMDD_manha_dashboard.png`.
   - Preencher a tabela e o bloco de observações da Vistoria Diária de Abertura no arquivo local `docs/LOG_BOOK.md`.

------------------------------------------------------------------------------------------------------

1.2 Turno de Encerramento (Noite)

1. Conferência de Fechamento:
   - Realizar a leitura sequencial das métricas das Seções 1 a 5 no Dashboard (`http://localhost:3001`).

2. Cálculo de Rendimento Intraday e Revisão de Extremos:
   - Apurar a variação do rendimento diário na SEÇÃO 6: `B6.1 - Rendimento Intraday (Delta Profit = Profit_Noite - Profit_Manhã)`.
   - Conferir se as oscilações do turno da noite estabeleceram novos picos (ATH) ou pisos (Mínimas) para atualização da tabela de referência de Extremos Históricos.

3. Registro e Governança de Sincronização:
   - Salvar a captura de tela no diretório: `docs/assets/YYYYMMDD_noite_dashboard.png`.
   - Preencher a tabela de Vistoria Diária de Encerramento no arquivo local `docs/LOG_BOOK.md`.
   - Validar via `git status` que os arquivos `.env` e `LOG_BOOK.md` permanecem ignorados pelo repositório.
   - Executar a sincronização no terminal:
     ```bash
     git add docs/
     git commit -m "docs(audit): relatorio de vistoria diaria YYYYMMDD encerramento"
     git push origin main
     ```

____________________________________________________________________________________________________________

CAPÍTULO 2: PROGRAMA SEMANAL - AUDITORIA DE CÓDIGO E SEGURANÇA DE SEGREDOS

Frequência: Executado no encerramento de cada ciclo semanal (Domingo às 21:00 BRT ou Segunda-feira na Abertura).  
Duração Estimada: 15 a 30 minutos.

2.1 Procedimentos de Inspeção e Execução

1. S1 - Integridade do Motor Operacional:
   - Executar no terminal o script de auditoria: `npx tsx src/auditSystem.ts`
   - Validar a comunicação WebSocket (WSS), a altura do ledger corrente na XRPL e a ausência de erros de runtime.

2. S2 - Varredura de Vulnerabilidades (CVEs):
   - Executar a análise de dependências: `npm audit`
   - Verificar se existem vulnerabilidades críticas ou de alta severidade nos pacotes instalados.

3. S3 - Isolamento do Arquivo `.env` e Segredos:
   - Executar a checagem no terminal: `git status --ignored`
   - Confirmar que os arquivos `.env`, `LOG_BOOK.md` e a pasta `.vscode` permanecem omitidos da área de staging do Git.

4. S4 - Manutenção das Dependências e SDK:
   - Verificar a existência de pacotes desatualizados: `npm outdated`
   - Avaliar a estabilidade das versões do `xrpl` SDK antes de aplicar atualizações operacionais.

5. S5 - Saúde dos Processos do Bot (PM2):
   - Inspecionar a execução do processo em segundo plano: `pm2 status`
   - Garantir que o processo `xrpl-dashboard` ou `xrpl-amm-bot` esteja no status `online` com 0 reinicializações inesperadas (`restarts`).

6. Registro de Conformidade:
   - Copiar a máscara de auditoria do `LOG_BOOK.template.md` e preencher a seção semanal no arquivo local `docs/LOG_BOOK.md`.

_____________________________________________________________________________________________________________________________

CAPÍTULO 3: PROGRAMA QUINZENAL - RESILIÊNCIA E SANITY CHECK DA INFRAESTRUTURA

Frequência: Executado quinzenalmente (Dias 15 e 30/31 de cada mês).  
Duração Estimada: 15 a 20 minutos.

3.1 Procedimentos de Inspeção e Execução

1. Q1 - Conectividade e Redundância de Nós WSS/RPC:
   - Testar o tempo de resposta e a estabilidade da conexão WebSocket com os clusters da XRPL (`wss://xrplcluster.com` e nós de failover).
   - Confirmar a ausência de desconexões frequentes ou drop de pacotes durante a escuta de novos ledgers.

2. Q2 - Validação do Disjuntor Financeiro (Circuit Breaker):
   - Inspecionar as rotinas de envio de transações no módulo `src/secureSubmit.ts`.
   - Validar se os limites de taxa de rede (network fee spike threshold) estão configurados para interromper submissões automatizadas em caso de oscilações anômalas na XRPL.

3. Q3 - Manutenção e Organização de Logs Locais:
   - Inspecionar o volume ocupado pelos arquivos de log do servidor e do PM2 no ambiente local.
   - Executar a rotação/limpeza de logs antigos e arquivos temporários de compilação no diretório do projeto, mantendo a estrutura de diretórios limpa.

4. Registro de Conformidade:
   - Copiar a máscara de auditoria do `LOG_BOOK.template.md` e preencher a seção quinzenal no arquivo local `docs/LOG_BOOK.md`.

_______________________________________________________________________________________________________________________________

CAPÍTULO 4: PROGRAMA MENSAL - BALANÇO FINANCEIRO, EMENDAS E TESTE DE FLUXO

Frequência: Executado no último dia útil/corrido de cada mês.  
Duração Estimada: 30 a 45 minutos.

4.1 Procedimentos de Inspeção e Governança Financeira

1. M1 - Consolidação de Lucro (DRE do Bot):
   - Consolidar a receita total capturada via taxas do pool durante o mês em dólares ($ USD).
   - Calcular a taxa de retorno mensal (%) em relação ao capital total alocado no contrato AMM.

2. M2 - Teste Funcional de Rota On-Chain (Saque Hold):
   - Executar a transferência simulada/real de até 10% do lucro líquido mensal para a Carteira Hold.
   - Validar a integridade da rota de saída, a tarifação de rede da transação e a chegada do ativo ao destino.

3. M3 - Taxa de Reinvestimento (Compounding Ratio):
   - Manter de 90% a 100% do rendimento gerado retido no pool da DEX.
   - Garantir a maximização do efeito de juros compostos (compounding) para expansão da custódia de LP Tokens.

4. M4 - Monitoramento de Emendas da Rede XRPL (XRPL Amendments):
   - Inspecionar as proposições de protocolo em votação pelos validadores da XRPL.
   - Avaliar a necessidade de adequação prévia das bibliotecas do bot antes da ativação das emendas na Mainnet.

5. M5 - Atualização de Snapshots e Documentação:
   - Atualizar os arquivos `docs/CONTEXT_SNAPSHOT.md` e `docs/PROCEDURES.md` com as novas métricas e parâmetros consolidados.
   - Executar a sincronização de fechamento mensal via Git (`git add`, `git commit -m "docs(audit): fechamento mensal YYYYMM"` e `git push origin main`).

_________________________________________________________________________________________________________________________________________________________

CAPÍTULO 5: PROTOCOLO DE SANITIZAÇÃO E RELEASE DE CÓDIGO ABERTO (OPEN SOURCE CHECKLIST)

Frequência: Executado obrigatoriamente antes de qualquer mesclagem (merge), release pública, alteração de visibilidade do repositório ou compartilhamento de código.  
Duração Estimada: 15 a 20 minutos.

5.1 Procedimentos de Inspeção e Validação de Segurança

1. P1 - Varredura de Endereços e Fallbacks Hardcoded:
   - Inspecionar todos os arquivos no diretório `src/` e subpastas.
   - Confirmar que nenhuma variável possui endereços de carteiras reais em valores padrão (fallbacks), como `process.env.VAR || "rSUA_CARTEIRA_POSICAO_AQUI"`.

2. P2 - Validação de Variáveis Financeiras no `.env`:
   - Garantir que aportes históricos, saldos de custódia e chaves de API sejam estritamente carregados via `process.env`.
   - Certificar que os fallbacks no código fonte sejam atribuídos como `0`, `""` ou valores genéricos desprovidos de informações reais.

3. P3 - Expurgo de Hashes de Transações e Logs:
   - Realizar busca no código fonte por hashes de transações passadas, identificadores de transação (tx_hash) ou payloads de testes anteriores retidos em comentários ou arquivos de log.
   - Limpar e remover qualquer registro de rastro operacional que possa identificar movimentações da Carteira Posição.

4. P4 - Verificação de Omissão de Segredos no Git:
   - Executar o comando `git status --ignored` antes de realizar a preparação de commits.
   - Certificar que os arquivos `.env`, `.vscodeignore`, `docs/LOG_BOOK.md` e pastas temporárias não estejam listados na área de staging.