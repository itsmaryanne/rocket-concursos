# Seções para colar no README.md

> Cole onde fizer sentido. Não substituí o seu README porque não tenho o conteúdo atual dele.

## Estrutura

```
rocket-concursos/
├── index.html
├── style.css
├── app.js
├── tests/            testes do Vitest (regras do app)
├── e2e/              testes do Playwright (navegador real)
├── scripts/          cobertura e preparo do Lighthouse
├── docs/             backlog, acessibilidade e plano do backend
├── supabase/         rascunho do banco (ainda não aplicado)
├── .github/workflows/ testes, cobertura e Lighthouse
├── vitest.config.js
├── playwright.config.js
└── package.json
```

## Testes

```bash
npm install
npx playwright install chromium

npm test                    # Vitest
npm run test:e2e            # Playwright (desktop e celular)
npm run test:e2e:todos      # + Firefox, Safari e iPhone
npm run test:e2e:cobertura  # cobertura do app.js em coverage-e2e/
npm run lighthouse          # Lighthouse
```

## Limitações conhecidas

- **Os dados ficam só no navegador** (`localStorage`). Trocar de aparelho ou limpar o navegador apaga tudo. Use **Exportar backup** com frequência.
- **Contas e amizades funcionam apenas entre perfis do mesmo navegador.** Ainda não há servidor.
- **Senhas são guardadas sem proteção** no navegador (o cadastro já avisa isso). Não use uma senha que você usa em outros sites.

## Recuperação de dados

- Se os dados salvos ficarem ilegíveis ou forem limpos por conter itens inválidos, o site guarda uma **cópia do original** no próprio navegador, com chave `trilha_aprovacao_v3_corrompido_…` ou `trilha_aprovacao_v3_antes_da_limpeza_…`.
- Para ver: DevTools (F12) → Application → Local Storage.
- Se aparecer o aviso **"Alterações não salvas"**, o navegador recusou a gravação (armazenamento cheio ou bloqueado). Use **Exportar backup** antes de fechar a página.
