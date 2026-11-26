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

### v0.6.9 — Adversários da liga
Comparação em lote de todos os outros times da liga na rodada selecionada, ordenada por titulares em comum e pontuação. Uma consulta retorna os resumos; seleção abre o comparativo individual. Cache somente durante a visualização atual, sem atualização automática. Rodadas sem dados não geram resultados. Dados fictícios, sem cobranças, integração real ou D1 ativo.

### Bloco 09 — D1 integrado (v0.7.1)
Branch de homologação separada, com todos os recursos v0.6.9. Criar um NOVO banco vazio `vn-arena-homologacao`, exclusivo para dados fictícios. Não reutilizar o schema antigo. Executar `migrations/0001_homologacao.sql` via Wrangler migrations ou console D1. Configurar o binding DB no wrangler.jsonc com o UUID real e migrations_dir=migrations antes de publicar. Sem binding, a prévia continua em memória. Com binding inválido, retorna 503, sem mascarar falha. A API administrativa POST /api/admin/score exige ADMIN_API_TOKEN como secret (32–256 caracteres aleatórios, não compartilhar); mantenha sem secret até teste controlado. Pontuações manuais removem o marcador de escalação sintética e gravam auditoria no mesmo batch. Não há cadastro, login, dados pessoais, integração oficial ou pagamentos. Testes SQLite simulam API D1; validação em nuvem pendente. Não altere branch de produção até aprovação.

### v0.7.2 — Beta fechada manual
Migração 0002_beta.sql cria tabelas isoladas, sem misturar participantes e pontuações demonstrativas. O fluxo fica desligado até configurar DB, aplicar 0001 e 0002, cadastrar ADMIN_API_TOKEN como secret e BETA_ENABLED=true no ambiente de homologação. Convites individuais aleatórios de 256 bits, expiração de sete dias, uso único; chave de acesso aleatória armazenada apenas como hash, sessão HttpOnly/Secure/SameSite Strict, expiração de sete dias. Não há recuperação automatizada de chave, revogação de convites, exclusão de conta ou moderação após decisão; antes de abrir a beta para pessoas reais, implementar esses controles, revisar privacidade e validar navegador/runtime. Chaves não devem ser enviadas ao chat nem GitHub. ID público do Cartola declarado, sem validação oficial ou senha do Cartola; ranking manual separado, apenas para aprovados. Sem pagamentos. Admin token em memória do navegador. Testes usam SQLite adaptado, não runtime D1 real. A versão pública não é modificada.

### Conectar homologação D1
O arquivo `wrangler.homologacao.jsonc` aponta exclusivamente para o novo banco informado e para um Worker separado `vn-arena-homologacao`. O `wrangler.jsonc` padrão do Worker público permanece intacto. Em checkout da branch `bloco09-d1-integrado`, autenticado no Cloudflare, rode `npx wrangler d1 migrations apply DB --remote --config wrangler.homologacao.jsonc` e somente depois `npx wrangler deploy --config wrangler.homologacao.jsonc`. Confira `/api/health` (storage=d1) e `/api/beta/status` (enabled=false). Não habilite BETA_ENABLED nem cadastre participantes reais nesta etapa. Não guardar secrets no GitHub; nenhum token administrativo foi configurado.

### Identidade visual
Homologação clara em cinza, branco, preto e dourado; gramado e uniformes ilustrativos preservados.

### v0.7.3 — Controles de acesso e privacidade
Revogação de convites ainda não utilizados, recuperação assistida após verificação de identidade pelo organizador (substitui chave e invalida sessões), moderação reversível e exclusão da própria conta mediante sessão e chave de acesso. Exclui pontuações e auditoria vinculada da base ativa, inutilizando o convite original; backups seguem a retenção do provedor. Beta permanece desativada no config, sem cobrança. Ainda é necessário aplicar migrações, testar em D1 real, revisar aviso de privacidade e operação de recuperação, verificar proteção contra abuso e confirmar visualmente a interface antes de aceitar pessoas reais.

### Ativação controlada da homologação
BETA_ENABLED=true somente nas duas configurações do Worker vn-cartolahomologacao. A beta continua fechada sem o binding D1, a migração beta ou um ADMIN_API_TOKEN de comprimento válido. O segredo é configurado exclusivamente no Cloudflare. Primeiro teste com convite individual e dados fictícios: cadastro, login, aprovação, pontuação manual, recuperação e exclusão. Não enviar convites reais antes de validar o fluxo online, a privacidade e a proteção contra abuso. Como as migrações foram aplicadas manualmente, não executar novamente sem reconciliar o histórico.

### v0.7.4 — Convite compartilhado da liga
A interface administrativa gera um código de grupo reutilizável, sem limite de inscrições ou expiração automática, revogável a qualquer momento. A API mantém compatibilidade com convites individuais anteriores (sete dias, uso único). A base existente não precisa de migração: o marcador de grupo fica em expires_at e cada inscrição recebe um registro de convite filho inutilizável, preservando a unicidade de invite_hash. Excluir uma conta não revoga o convite do grupo. O ID externo continua único e toda inscrição fica pendente de aprovação. Revogar o código bloqueia novas inscrições sem afetar as anteriores. Não compartilhar credenciais administrativas ou chaves individuais. Teste online antes de divulgar.

### v0.7.5 — Sessão administrativa e confirmação de inscrição
Sessão administrativa de oito horas com cookie HttpOnly/Secure/SameSite=Strict, chave de sessão derivada do segredo atual e registro de expiração em arena_meta. Sem migração adicional; logout revoga a sessão, troca do segredo invalida sessões antigas. A chave administrativa não é salva no navegador. Atualizar a página restaura a sessão e permite consultar inscrições sem redigitar a chave; botão Atualizar inscrições. Cadastro mostra confirmação com nome e situação pendente; após aprovação, confirmação persistente na área do participante. Nenhum envio de WhatsApp ou email automatizado. Validar no Worker antes de divulgar convites reais.

### v0.7.6 — Cadastro administrativo manual e importação de times
Organizador autenticado pode cadastrar time aprovado pelo nome e ID público ou importar listas de IDs, inclusive `Grupo=>123;456`. Autorização dos responsáveis obrigatória. Todos entram na liga beta atual, não cria grupos extras. Sem teto de times na aplicação: importação em lotes de até 10 por requisição (40 comandos SQL para respeitar limites do D1 Free) e listagem administrativa paginada em 50, com total e pendentes. ID único; duplicados não sobrescrevem dados. Nome provisório `Time ID` se ausente, edição posterior; não consulta API externa. Não retorna chave pessoal durante importação: administrador pode emitir acesso em Recuperar acesso após verificar identidade. Sem alteração do schema ou pagamentos. Limites de infraestrutura gratuitos permanecem; testar no ambiente online antes de cadastrar pessoas reais.

### v0.7.7 — Inscrição por nome e visual esportivo
ID público opcional na inscrição por convite; ausência recebe marcador interno, não ID real. Administrador deve vincular o ID numérico, único, antes de aprovar. Erros de formulário específicos, confirmação em destaque e continuidade para login. Tema claro com cabeçalho grafite, âmbar vibrante, contraste e formulário responsivo. Sem migração adicional ou consulta oficial. Não aceitar senhas do Cartola. Testar fluxo online antes de divulgar.
