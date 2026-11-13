# Backend do Rocket Concursos (Cloudflare Workers + D1)

Etapa 1: **contas e sessões**. Entrar com **ID de 5 dígitos + senha**, sem e-mail, com código de recuperação.
Os dados de estudo e as amizades ainda **não** passam por aqui (as tabelas já existem em `schema.sql`, prontas para a sincronização).

## Endpoints

| Método e caminho | Corpo | Resposta |
|---|---|---|
| `POST /auth/cadastro` | `{ nome, senha }` | `201` com `conta`, `token`, `expira_em`, `codigo_de_recuperacao` (aparece **uma vez**) |
| `POST /auth/entrar` | `{ id, senha }` | `200` com `conta`, `token`, `expira_em` |
| `POST /auth/sair` | (cabeçalho `Authorization: Bearer TOKEN`) | `200` |
| `GET /auth/eu` | (cabeçalho `Authorization`) | `200` com `conta` |
| `POST /auth/recuperar` | `{ id, codigo, nova_senha }` | `200` com novo `token` e **novo** `codigo_de_recuperacao` |

Erros: `400` dados inválidos, `401` credenciais ou sessão inválidas, `403` origem não permitida, `413` corpo grande, `429` muitas tentativas (com `Retry-After`).

## Regras de segurança implementadas

- Senha: mínimo de **10 caracteres**; guardada como PBKDF2-SHA256 com **sal aleatório** e **pimenta** (segredo do servidor que não fica no banco).
- Sessões: token aleatório de 256 bits; o banco guarda só o **hash**; validade de 30 dias; sair apaga a sessão.
- Limite de tentativas: 5 erros por ID em 15 min bloqueiam o ID (também IDs que não existem); 30 por IP; 5 cadastros por hora por IP; 5 códigos de recuperação errados por hora. O IP é guardado só como hash.
- Resposta idêntica para "ID inexistente" e "senha errada", com o mesmo custo de CPU (não dá para descobrir quais IDs existem).
- Recuperação: o código usado deixa de valer, todas as sessões caem e um novo código é entregue.
- CORS só para as origens de `ALLOWED_ORIGINS`.
- O ID de 5 dígitos **não é segredo** e não é chave das tabelas (a chave é um UUID interno).

## Testar (sem conta e sem internet)

Da raiz do projeto, com Node 22 ou mais novo:

```bash
npm run test:backend
```

Os testes usam o SQLite do Node no lugar do D1 (`test/d1-sqlite.js`), então validam as regras, o esquema SQL e a API. **Não validam** o comportamento real do Worker na Cloudflare (veja "Medir o CPU").

## Colocar no ar (custo zero)

1. Crie uma conta gratuita na Cloudflare e instale o Wrangler: `npm i -D wrangler` e `npx wrangler login`.
2. Entre em `backend/` e crie o banco: `npx wrangler d1 create rocket-concursos`. Copie o `database_id` para o `wrangler.toml`.
3. Crie as tabelas: `npx wrangler d1 execute rocket-concursos --remote --file=schema.sql`
4. Gere a pimenta e guarde em local seguro (sem ela, ninguém consegue entrar):
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   depois `npx wrangler secret put PASSWORD_PEPPER` e cole o valor.
5. Em `wrangler.toml`, troque `ALLOWED_ORIGINS` pelo endereço do seu site no GitHub Pages.
6. `npx wrangler deploy`. O endereço sai no formato `https://rocket-concursos-api.SEU-USUARIO.workers.dev`.

Para testar no seu computador: crie `backend/.dev.vars` com `PASSWORD_PEPPER=...` (esse arquivo **não** vai para o git), rode `npx wrangler d1 execute rocket-concursos --local --file=schema.sql` e `npx wrangler dev`.

## Medir o CPU do hash (importante no plano gratuito)

O plano gratuito limita o tempo de CPU por requisição. Um hash de senha forte gasta CPU de propósito, então:

1. Depois do deploy, faça um cadastro e um login de teste e confira se respondem sem erro (`npx wrangler tail` mostra os logs).
2. Se aparecer erro de limite de recursos (por exemplo 1102), reduza `PBKDF2_ITERATIONS` em passos (100000, 60000, 40000...) e faça deploy de novo.
3. Contas já criadas continuam válidas: o custo fica gravado em cada hash. Se um dia você subir o valor, cada conta é atualizada automaticamente no próximo login.

Menos iterações significam senhas mais fáceis de quebrar se o banco vazar. A pimenta ajuda (o banco sozinho não basta), mas por isso a senha tem mínimo de 10 caracteres.

## Limites a vigiar

Conferir sempre nos painéis da Cloudflare: requisições por dia do Worker e linhas lidas e escritas por dia do D1. Ao atingir o limite gratuito as chamadas passam a falhar até a renovação; nesse plano não há cobrança automática. Um bot pode esgotar a cota de propósito (negação de serviço). O site continua funcionando no modo local.

## Fora do escopo desta etapa

Sincronização dos dados de estudo, amizades no servidor, compartilhamento, troca de senha logada e exclusão de conta.
