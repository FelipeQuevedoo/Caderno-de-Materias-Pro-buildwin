# Auditoria resumida

Principais correções aplicadas:
- src/App.tsx unificado com a versão mais completa da raiz.
- src/index.css unificado com a versão mais completa da raiz.
- Backups de matérias apagadas agora usam portable-data/deleted-subject-backups.
- Abertura de arquivo externo limitada a .json; restauração de .cnbk permanece no fluxo próprio.
- Scripts do package.json ajustados para chamar o binário real do Vite, evitando o wrapper quebrado em node_modules/.bin/vite.

Limitações validadas neste ambiente:
- Não foi gerado .exe Windows aqui, porque o ambiente não é Windows e o empacotamento Electron/NSIS para Windows depende desse alvo.
- O projeto foi saneado para ficar compilável/empacotável no Windows com maior previsibilidade.
