# Testes do Rocket Concursos

Dois níveis de teste, sem Angular e **sem mudar** `index.html`, `app.js` ou `style.css`.

| Ferramenta | Pasta | Para quê |
|---|---|---|
| **Vitest + jsdom + Testing Library** | `tests/` | Regras do app (rápido): login, registros, sessões, paginação, amizades |
| **Playwright** | `e2e/` | Navegador de verdade: layout, streak, tema, mobile, backup |

## Instalação (uma vez, na raiz do projeto, Node 20+)

```bash
npm i -D vitest jsdom @testing-library/dom @testing-library/user-event @playwright/test http-server
npx playwright install chromium
```

Coloque estes arquivos **ao lado do `index.html`**: `package.json`, `vitest.config.js`,
`playwright.config.js`, `.gitignore`, `tests/` e `e2e/`.
Se você já tem um `package.json` ou `.gitignore`, junte o conteúdo em vez de sobrescrever.

## Comandos

```bash
npm test             # Vitest (uma rodada)
npm run test:watch   # Vitest reroda ao salvar
npm run test:e2e     # Playwright (sobe o servidor sozinho na porta 4173)
npm run test:e2e:ui  # Playwright com interface visual
npm run test:all     # os dois
```

Relatório do Playwright: `npx playwright show-report`.

## O que está coberto

**`tests/` (Vitest)**
- `auth.test.js`: cadastro, ID de 5 números, senha curta, sair, entrar, senha errada
- `registros.test.js`: questões e taxa de acertos, validação, registros gerais, meta semanal
- `sessoes.test.js`: paginação de 5 em 5, ordem do mais recente ao mais antigo, botões, excluir na última página, voltar à página 1
- `amizades.test.js`: busca por ID, pedido, aceitar, recusar, modo leitura no perfil do amigo

**`e2e/` (Playwright, em desktop e celular)**
- `streak.spec.js`: 364 dias, **sem barra de rolagem vertical**, dia marcado
- `paginacao.spec.js`: sessões (5) e registros gerais (10), ordem, números das páginas
- `auth.spec.js`, `amizades.spec.js`: fluxos completos
- `backup.spec.js`: exportar, apagar tudo, importar de volta, arquivo inválido
- `tema-responsivo.spec.js`: tema persistente, sem rolagem horizontal, menu e Esc

## Sobre "ATL"

- **Angular Testing Library** só serve para componentes Angular, então não funciona aqui.
- Ela é construída em cima da **DOM Testing Library** (`@testing-library/dom`), que é a usada neste projeto. Quando você for ao Angular, essa mesma forma de testar continua valendo.

## Estado da validação

- **Playwright:** os 34 testes foram executados contra o seu `index.html`/`app.js`/`style.css` e passaram.
- **Vitest:** a sintaxe foi checada, mas **não foi executado** (o ambiente de geração não tinha jsdom nem internet). Se algum teste falhar na primeira rodada, o mais provável é detalhe de ambiente, e não do app.

## Se algo falhar

- **Botões do paginador não respondem no Vitest:** os `onclick` inline precisam do jsdom com `runScripts: "dangerously"` (já configurado no `vitest.config.js`). O `helpers.js` executa o `app.js` dentro da janela do jsdom por isso.
- **`Cannot find module`:** rode o `npm i -D ...` de novo.
- **Playwright não acha o navegador:** `npx playwright install chromium`.
- **Mudou um texto de botão** (ex.: "Próxima ›", "Salvar sessão")? Atualize o teste correspondente.
- **Os testes usam os `id` do HTML** (`#sessionList`, `#regName`...). Renomeou um id? Ajuste nos testes.
