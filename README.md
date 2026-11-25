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
