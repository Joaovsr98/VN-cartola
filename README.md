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
