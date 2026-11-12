# Testes do Rocket Concursos

Sem Angular e sem frameworks. Os arquivos do site (`index.html`, `style.css`, `app.js`) continuam sendo os únicos publicados.

| Ferramenta | Pasta | Para quê |
|---|---|---|
| **Vitest + jsdom + Testing Library** | `tests/` | Regras do app, rápido |
| **Playwright** | `e2e/` | Navegador de verdade: layout, acessibilidade, backup, vários navegadores |
| **Cobertura (V8 do Chromium)** | `scripts/cobertura.mjs` | Mostra quais linhas e funções do `app.js` os testes executam |
| **Lighthouse CI** | `lighthouserc.json` | Desempenho, acessibilidade, boas práticas e SEO da página |

## Instalação (uma vez, na raiz do projeto, Node 20+)

```bash
npm install
npx playwright install chromium
```

Opcionais:

```bash
npx playwright install firefox webkit     # para npm run test:e2e:todos
npm i -D @axe-core/playwright             # ativa o teste do axe-core
```

## Comandos

```bash
npm test                    # Vitest
npm run test:e2e            # Playwright: desktop + celular (Chromium)
npm run test:e2e:todos      # + Firefox, Safari (WebKit) e iPhone
npm run test:e2e:edge       # Microsoft Edge (precisa do Edge instalado)
npm run test:e2e:ui         # Playwright com interface visual
npm run test:e2e:cobertura  # roda o Playwright e gera coverage-e2e/resumo.md e app.html
npm run test:all            # Vitest + Playwright
npm run lighthouse          # Lighthouse (precisa do Chrome instalado)
```

Relatório do Playwright: `npx playwright show-report`.

## Cobertura

- `coverage-e2e/resumo.md`: porcentagens e lista de funções que nenhum teste chamou.
- `coverage-e2e/app.html`: o `app.js` com as linhas executadas em verde e as não executadas em vermelho.
- Mede o `app.js` pelos testes do Playwright (Chromium). O Vitest não aparece aqui porque executa o arquivo via `eval`.
- Linha coberta quer dizer "foi executada por algum teste", e não "foi bem verificada".

## O que está coberto

**`tests/` (Vitest)**
- `auth.test.js`: cadastro, ID, senha curta, sair, entrar, senha errada
- `registros.test.js`: questões, taxa de acertos, validação, metas
- `sessoes.test.js`: paginação (5 por página e 10 nos registros gerais), ordem, botões
- `amizades.test.js`: busca por ID, pedido, aceitar, recusar, modo leitura
- `integridade.test.js`: JSON corrompido, falha ao gravar, dados inválidos, IDs hostis, IDs duplicados, migração v2
- `fluxos.test.js`: aviso de senha, perfil, revisões, simulados, excluir registro, metas, remover amigo

**`e2e/` (Playwright, desktop e celular)**
- `auth`, `amizades`, `backup`, `paginacao`, `streak`, `tema-responsivo`: fluxos principais
- `fluxos.spec.js`: perfil (nome, foto, imagem corrompida), revisões, simulados, registros, metas, remover amigo
- `integridade.spec.js`: armazenamento corrompido ou cheio, itens inválidos, XSS por ID e por texto, importação, IDs duplicados, migração v1 e v2
- `ordenacao.spec.js`: ordem das listas, busca por nome, excluir pela lista geral, importar backup antigo
- `lacunas.spec.js`: recusar e cancelar pedido, "Ver mais" da nota, copiar ID, seletores de arquivo, redimensionar
- `acessibilidade.spec.js`: abas ARIA, teclado, nomes acessíveis, contraste WCAG AA nos dois temas, axe-core (opcional)

## Estado da validação

- **Playwright (Chromium, desktop e celular):** 136 testes passaram e 2 foram pulados (o axe-core, que precisa do pacote opcional).
- **Cobertura do `app.js`:** 97,5% das linhas e 100% das funções.
- **Vitest:** sintaxe checada, **não executado** no ambiente onde foi escrito. Rode `npm test` e avise se algo falhar.
- **Firefox, WebKit e iPhone:** configurados, **não executados**. No GitHub Actions rodam num job que ainda não bloqueia.
- **Lighthouse:** configurado, **não executado**.

## ATL (Angular Testing Library)

Só funciona com componentes Angular. Este projeto usa a DOM Testing Library, que é a base dela.

## Se algo falhar

- **`vitest` ou `playwright` "não é reconhecido":** rode `npm install`.
- **Playwright não acha o navegador:** `npx playwright install chromium`.
- **Botões do paginador não respondem no Vitest:** os `onclick` inline precisam de `runScripts: "dangerously"` (já está no `vitest.config.js`) e o `helpers.js` executa o `app.js` na janela do jsdom por isso.
- **Mudou um texto de botão ou um `id`:** ajuste o teste correspondente. Os testes usam os `id` do HTML.
- **Teste de contraste falhou:** a mensagem diz o texto, a razão obtida e o mínimo. Corrija a cor no `style.css`.
