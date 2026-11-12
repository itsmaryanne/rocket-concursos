# Backlog técnico: Rocket Concursos

Atualizado em 11/11/2026. Legenda: ✅ feito e testado · 🟡 parcial ou não validado aqui · ⬜ pendente.

## Decisões

- Continua em **HTML/CSS/JS puro** (sem Angular, sem framework) por enquanto.
- Backend: proposta em `docs/BACKEND-PLANO.md` e rascunho em `supabase/schema.sql`. **Aguardando as decisões listadas no plano.**
- Modularização do `app.js`: junto da camada de armazenamento do backend (exige módulos ES e trocar os `onclick` inline).

## Achados da auditoria

| # | Achado | Estado |
|---|---|---|
| A1 | JSON corrompido: o próximo `save()` apagava o original | ✅ cópia guardada + aviso |
| A2 | `save()` mostrava sucesso mesmo falhando | ✅ aviso fixo + sem "sucesso" falso |
| A3 | Importação aceitava registros sem validar (HTML injetável) | ✅ validação por tipo |
| A4 | IDs dentro de `onclick` executavam código | ✅ IDs restritos a `[A-Za-z0-9_-]` |
| A5 | Itens inválidos sumiam em silêncio | ✅ contagem informada + cópia do original |
| A6 | Migração v1/v2 mostrava credenciais não gravadas | ✅ grava já em v3 |
| A7 | Alertas "salvo!" sem ter salvo | ✅ só quando gravou |
| A8 | Senhas em texto puro no `localStorage` | 🟡 aviso na tela; solução real exige backend |
| A9 | Contas e amizades só no mesmo navegador | ⬜ exige backend |
| A10 | Abas sem semântica ARIA, botões "Excluir" sem contexto, gráfico e calendário sem texto alternativo | ✅ corrigido |
| A11 | Navegadores sem `light-dark()` perdiam o tema | ✅ bloco de reserva (cores idênticas, validado) |

## Qualidade

| ID | Tarefa | Estado |
|---|---|---|
| RC-001 | Sincronizar local e GitHub | ⬜ commit e push dos arquivos desta entrega |
| RC-002 | Publicar configuração dos testes | ⬜ idem |
| RC-003 | Registrar cobertura | ✅ 97,5% das linhas e 100% das funções (`npm run test:e2e:cobertura`) |
| RC-004 | Lista de funções sem cobertura | ✅ gerada no `resumo.md` (hoje: nenhuma) |
| RC-005 | README | 🟡 trechos prontos em `docs/README-secoes.md` |
| RC-006 a RC-011 | Integridade de dados | ✅ |
| RC-015 | Revisar `innerHTML` | 🟡 números, IDs e textos testados; revisar o restante ao modularizar |
| RC-016 | Validar importação | ✅ |
| RC-023 | GitHub Actions | ✅ `.github/workflows/tests.yml` (ativa no push) |
| RC-024 | Chrome, Firefox, Safari, Edge | 🟡 Chromium validado; Firefox, WebKit e iPhone configurados e não executados; Edge via `npm run test:e2e:edge` |
| RC-025 | Acessibilidade | ✅ auditoria, correções e testes (`docs/ACESSIBILIDADE.md`); leitor de tela e zoom 200% dependem de teste humano |
| RC-026 | Lighthouse | 🟡 configurado (`npm run lighthouse` e workflow manual); não executado |
| RC-027 | Documentar limitações | ✅ `docs/README-secoes.md` |

## Pendente

| ID | Tarefa | Depende de |
|---|---|---|
| RC-012 a RC-014 | Autenticação, senhas, controle de acesso | backend |
| RC-017 a RC-022 | Modularizar `app.js` | backend (etapa 2 do plano) |
| RC-028 | Versão estável 1.0, changelog | backend |
| — | Trocar `alert()` por avisos na página | junto do backend |
| — | Rodar Vitest, Firefox, WebKit e Lighthouse e corrigir o que aparecer | você rodar e me enviar os resultados |
