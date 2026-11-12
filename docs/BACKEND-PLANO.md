# Plano do backend (rascunho)

Objetivo: contas reais, dados sincronizados entre aparelhos e amizades que funcionam entre pessoas diferentes. Isso resolve os achados **A8** (senhas em texto puro) e **A9** (contas só no mesmo navegador) do `docs/BACKLOG.md`.

## Escolha proposta: Supabase

- Login seguro pronto (a senha nunca passa pelo seu código nem fica guardada por você).
- Banco Postgres com **Row Level Security**: o servidor decide quem lê o quê, e não o navegador.
- Funciona com o site atual em HTML/CSS/JS puro, publicado no GitHub Pages (a biblioteca é carregada no navegador).
- Existe plano gratuito. **Confira os limites atuais no site do Supabase antes de decidir** (por exemplo, o que acontece com projetos inativos).

## Decisões que preciso de você

1. **Login por e-mail e senha?** O Supabase Auth usa e-mail. Hoje o site usa só "nome + ID + senha". O e-mail passa a ser dado pessoal (LGPD).
2. **Manter o modo sem conta (só navegador)?** Seria um "modo offline" para quem não quer cadastro.
3. **ID de amigo:** hoje são 5 números. O rascunho usa 8 dígitos, porque 5 dígitos acabariam rápido com muitos usuários.
4. **Amigos veem os dados uns dos outros?** Hoje o amigo vê o dashboard inteiro. O rascunho mantém isso (somente leitura). Dá para limitar o que é compartilhado.
5. **Política de privacidade** e aviso de cookies/armazenamento: precisa existir antes de coletar e-mails.

## Etapas

1. **Criar um projeto Supabase de teste** e rodar `supabase/schema.sql` (ele é um rascunho: revise antes).
2. **Isolar o armazenamento no `app.js`:** hoje `load()` e `save()` falam direto com o `localStorage`. Criar uma camada (`repositorio`) com duas implementações: local e Supabase. Os testes atuais continuam valendo para a versão local.
3. **Login:** cadastro, entrada, saída e recuperação de senha pelo Supabase Auth. A tela atual de ID e senha é substituída.
4. **Dados:** registros, revisões, simulados e sessões passam a ir para as tabelas, com os mesmos limites de validação que já existem no `app.js`.
5. **Amizades:** pedidos, aceite, recusa e remoção usando a tabela `friendships` (as políticas já impedem pedir em nome de outra pessoa).
6. **Migração dos dados atuais:** ao entrar pela primeira vez, oferecer "importar meus dados deste navegador" a partir do backup JSON atual.
7. **Testes de segurança:** com dois usuários de teste, provar que o usuário A não lê nem altera os dados do usuário B (nem com a chave pública do navegador). Esses testes entram no Playwright.

## Cuidados

- A chave pública (`anon`) do Supabase **pode** ficar no site, porque a proteção está no RLS. A chave `service_role` **nunca** vai para o repositório nem para o navegador.
- Sem RLS ligado em todas as tabelas, qualquer pessoa leria tudo. O rascunho liga em todas; testar isso é a etapa 7.
- Use um projeto separado para os testes automatizados. Não rode testes no projeto com dados reais.

## Fora do escopo agora

Modularizar o `app.js` em vários arquivos (item 4 do plano original). Faz mais sentido junto da etapa 2, quando a camada de armazenamento for isolada.
