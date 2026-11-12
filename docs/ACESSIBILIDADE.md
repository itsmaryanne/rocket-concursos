# Acessibilidade: o que foi verificado e corrigido

Auditoria automática no site real, em dois temas (noite e dia) e dois tamanhos (desktop e celular), em todas as abas e telas.

## Corrigido

- **Abas:** agora usam `role="tab"`, `aria-selected`, `aria-controls` e painéis com `role="tabpanel"`.
- **Pular para o conteúdo:** primeiro item ao apertar Tab; leva o foco ao conteúdo principal.
- **Botões repetidos** ("Excluir", "Aceitar", "Remover"...) agora dizem o que afetam (ex.: "Excluir sessão de 50 minutos em 04/11/2026"). O texto visível não mudou.
- **Checkbox de revisão** ganhou nome ("Concluir revisão …").
- **Gráfico de evolução e calendário de streak** têm texto alternativo com os valores.
- **Calendário e tabelas que rolam de lado** podem ser focados pelo teclado.
- **Foco visível** em botões, links e resumos, inclusive sobre o cabeçalho escuro.
- **Paginação** marca a página atual com `aria-current="page"`.
- **Movimento reduzido:** quem pede menos animação não recebe rolagem suave.
- **Cores:** navegadores sem `light-dark()` recebem as mesmas cores por um bloco de reserva (validado: resultado idêntico).
- **Favicon e descrição** da página (ajudam o Lighthouse e a aba do navegador).

## Verificado sem problemas

- Contraste mínimo WCAG AA (4,5:1 para texto comum) em todas as telas, nos dois temas.
- Todos os campos têm rótulo; `lang="pt-BR"`; sem ids duplicados; sem saltos de nível de título.

## Testes que protegem isso

`e2e/acessibilidade.spec.js` (abas, teclado, nomes, contraste nos dois temas) e, opcionalmente, o axe-core (`npm i -D @axe-core/playwright`).

## Ainda precisa de verificação humana

- **Leitor de tela** (NVDA no Windows ou VoiceOver no iPhone): ler uma tela completa e conferir se a ordem faz sentido.
- **Zoom de 200%** e texto maior no celular.
- **Mensagens por `alert()`:** funcionam, mas interrompem. Trocar por avisos na própria página melhora a experiência (item para a etapa do backend).
- **Daltonismo** no calendário de streak: a diferença entre dia marcado e não marcado é de cor e de opacidade.
