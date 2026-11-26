# VN Cartola / VN Arena — 0.2.0
Protótipo independente de gestão de ligas fantasy, temporada 2027. Somente dados fictícios. Nenhum pagamento ou integração externa ativado.

## Executar localmente
Node.js 22.13+ (SQLite nativo experimental no Node 22). Não precisa instalar dependências.
`ADMIN_PASSWORD='troque-esta-senha-local' npm start`
Abra http://localhost:3000. Use uma senha exclusiva de teste. O banco fica em data/arena.sqlite.
`npm test` executa os testes de motor e API HTTP.

## Arquitetura
core.js: classificação e mata-mata. provider.js: fronteira para fonte autorizada. store.js: SQLite. server.js: API HTTP e autenticação. public/: interface responsiva e PWA.
Regras provisórias: segundo turno 20–38; 16 classificados nas rodadas 20–29, mata-mata 30–33, empate por melhor seed. Confirmação manual. Sessões e limites locais ao processo. Não inserir dados reais. Não usar SQLite em serverless efêmero. PostgreSQL em db/postgres.sql é apenas rascunho não aplicado. Multi-tenant, autenticação gerenciada, proteção distribuída, fechamento de rodadas e backup pendentes. Integração Cartola somente mediante autorização. Pagamentos desativados.

## Sprint 03 — v0.3.0
Administrador central pode criar ligas públicas independentes. As regras são definidas na criação (temporada, intervalo de rodadas e tamanho/início da chave); não há alteração retroativa. A seleção usa `?league=ID`. Uma conta pode ter uma inscrição por liga. Ranking, pontuações e aprovações são filtrados por liga. Ainda não há administradores independentes por organização, ligas privadas ou banco remoto. Dados fictícios, sem cobrança e sem acesso automatizado ao Cartola.

## Bloco 04 — v0.4.0
Importação manual de até 200 pontuações por lote (ID;rodada;pontos), com prévia sem escrita, validação por liga, aplicação transacional, trilha de auditoria e reenvio idempotente. Dados de parciais reais não estão habilitados. A rotina de exportação PostgreSQL gera SQL para um destino vazio e preserva identificadores e relacionamentos. Faça backup e pare escritas antes da migração. Execute o esquema `db/postgres.sql` em um banco exclusivo vazio e depois importe o arquivo de exportação com `psql -v ON_ERROR_STOP=1 -f arquivo.private.sql`. O arquivo contém dados privados e hashes de senha: não publique ou compartilhe. Use `node scripts/export-postgres.js data/arena.sqlite data/export.private.sql --confirm-sensitive`. O backend ainda usa SQLite; conexão PostgreSQL em tempo de execução, testes em nuvem e autorização de dados externos são pendências. A CI inclui um teste de migração com PostgreSQL 16.

## Bloco 05 — v0.5.0
Estatísticas de time e histórico por rodada, média e melhor pontuação, simulação hipotética sem alterar o banco. Dados registrados não são parciais ao vivo. Backup SQLite consistente com verificação de integridade e arquivo privado: `node scripts/backup.js data/arena.sqlite backups/arena.sqlite --confirm-sensitive` (crie a pasta backups antes; destino deve ser novo). O backup contém informações privadas e hashes. Não publique. O backend ainda utiliza SQLite; PostgreSQL remoto, notificações e pagamentos não estão ativos.

## Bloco 06 — Docker local
Requisitos: Docker Engine ou Docker Desktop com Compose v2. Copie .env.example para .env, defina ADMIN_PASSWORD (senha exclusiva de teste, 12–128 caracteres) e execute:

```sh
docker compose up -d --build --wait
docker compose ps
```

Abra http://localhost:3000 (ou altere ARENA_PORT). Os dados SQLite persistem no volume arena_data. Para parar, use docker compose down; não utilize down -v se quiser preservar dados. O container é executado sem root, sem capabilities extras, com sistema de arquivos somente leitura e volume de dados gravável. O acesso é local (loopback), sem TLS, exclusivamente para testes. A CI executa testes dentro do Docker e verifica persistência ao recriar o container.

Cloudflare: o backend atual usa Node HTTP e SQLite nativo. Não publique diretamente como Worker ou Pages até adaptar runtime, autenticação e persistência. Docker local não equivale a Cloudflare Containers. Nenhum plano pago, deploy ou banco remoto foi criado neste bloco. Dados fictícios e pagamentos desativados.

## Bloco 07 — Cloudflare Workers (prévia pública)
Worker independente, sem banco e sem autenticação, usando dados sintéticos. Inclui ranking, rodadas, mata-mata, estatísticas e simulador que não grava dados. Cadastro, login, painel admin, importações e pagamentos estão bloqueados no Worker. A versão completa local continua disponível pelo Docker. A suíte local valida a interface Fetch do Worker com binding de assets simulado; ainda não equivale a execução no runtime Cloudflare.

Em Workers & Pages, importe o repositório VN-cartola, escolha a branch bloco07-cloudflare-preview, nome vn-arena, diretório raiz, comando de build npm test e comando de deploy npx wrangler deploy. Não selecione Containers/Workers Paid. O arquivo wrangler.jsonc define assets e entrypoint. A conta deve permanecer no Free. Confira o endereço workers.dev antes de adicionar um domínio personalizado. Não há deploy realizado pelo GitHub neste bloco; a conta Cloudflare precisa ser operada pelo titular. Banco remoto e autenticação continuam pendentes; D1 ou PostgreSQL serão avaliados separadamente.

### Correção 0.6.1 — Cloudflare
O nome em wrangler.jsonc deve coincidir com o Worker criado: vn-cartola. Configure a branch de produção como bloco07-cloudflare-preview, diretório raiz do repositório, build npm test e deploy npx wrangler deploy. O endpoint /api/health deve retornar JSON com version 0.6.1, mode demo e payments false. A interface mostra a versão no rodapé. Se houver HTML no lugar de JSON, confira se foi implantado o Worker e não somente os assets estáticos. O domínio publicado ainda precisa ser validado. Não contém banco remoto, pagamentos ou dados reais.

### v0.6.2 — Ranking detalhado (prévia)
Pesquisa por time/cartoleiro, ordenação por total acumulado até a rodada selecionada ou pontos da rodada, evolução da posição, patrimônio e variação simulados, capitão, diferença para o líder, escudos tipográficos próprios e escalações fictícias (11 titulares + 5 reservas). A soma dos pontos individuais demonstrativos corresponde aos pontos da rodada; não representa a regra oficial de pontuação. Rodadas sem resultados não geram parciais, patrimônio ou escalação. Todos os dados são fictícios. Sem pagamentos e sem API externa. A branch D1 continua separada; este bloco não ativa o banco remoto.

### v0.6.3 — Experiência de competição
Pódio parcial até a rodada escolhida, campo demonstrativo 4-3-3 ao abrir um time, e mata-mata por fases em colunas navegáveis. O chaveamento segue o motor existente; não são traçadas conexões fixas entre confrontos. O pódio não declara campeão antecipadamente. Dados fictícios, sem pagamentos, sem banco remoto. Testes de pódio e formação foram acrescentados; execução em navegador e deploy dependem de validação.

### v0.6.4 — Navegação mobile e meu time
Página inicial, menu inferior, seleção de time fictício para visualizar (sem autenticação ou edição), orçamento em cartoletas com custo dos titulares e técnico e saldo, calendário ilustrativo sem datas reais, atalhos para estatísticas e eliminatórias. Preços e clubes são sintéticos. Técnico sem pontuação nesta simulação. Sem dados oficiais, pagamentos ou conexão D1. Testes de orçamento e calendário adicionados.

### v0.6.5 — Mercado demonstrativo
Mercado de 48 atletas fictícios, quatro formações, 11 titulares e técnico, escolha de capitão, filtro de posição, busca, orçamento de C$145,75, preenchimento automático pelo menor custo e salvamento local de escalação completa. Não inclui reservas no editor, nem sincronização de contas, resultados ou escalações reais. O simulador roda no navegador e não consome consultas adicionais ao Worker. Uniformes genéricos coloridos, sem escudos oficiais. Testes das regras de escalação adicionados.

### v0.6.6 — Central de competições e favoritos
Favoritos locais por liga, atalhos no início e menu Mais, central de campeonato, mata-mata e mito, regulamento demonstrativo e histórico somente para temporadas completas na base simulada. O término é inferido da presença de todos os resultados, não de homologação oficial; o fechamento administrativo real e armazenamento de temporadas anteriores continuam pendentes. Nenhum prêmio financeiro, cobrança ou notificação push está ativo. O Docker conserva os recursos anteriores; a central usa os dados demonstrativos da prévia Cloudflare. Novos testes de conclusão e dados ausentes.

### v0.6.7 — Ligas, jogos e compartilhamento
Catálogo de três ligas fictícias (liga piloto com 16, duas ligas com oito times cada), seleção independente e isolamento de participantes. Jogos ilustrativos nas rodadas 32–34, sem calendário ou probabilidades oficiais; placares apenas na rodada passada. Exportação CSV e compartilhamento do ranking por texto no dispositivo. Não permite criação/inscrição real na prévia Cloudflare; administração local preservada. Sem pagamentos e sem banco remoto.

### v0.6.8 — Comparação de times
Detalhes por rodada, alternância campo/lista, comparação de dois times da mesma liga por posição, destaque de titulares comuns por ID, valorização ilustrativa, pontos com/sem bônus de capitão. A base fictícia foi regenerada com atletas estáveis, pontuação base comum e bônus demonstrativo de 50%; totais e patrimônio fictícios podem mudar em relação às versões anteriores. Não representa scouts ou regras oficiais do Cartola; técnico e reservas não pontuam nesta simulação. Sem integração externa, banco remoto ou pagamentos.
