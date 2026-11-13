# Plano do backend: Cloudflare Workers + D1

Substitui o rascunho anterior (Supabase), que foi descartado: o plano gratuito pausa projetos inativos e o login por ID numérico sem e-mail exigiria contornos.

## Requisitos (suas decisões)

| Requisito | Como é atendido |
|---|---|
| Custo R$ 0 | Workers (plano gratuito) + D1 (plano gratuito), sem cobrança automática ao passar do limite |
| Login por ID de 5 dígitos + senha | Autenticação própria no Worker |
| Sem e-mail | Código de recuperação de 100 bits, mostrado uma vez |
| Modo offline mantido | O site continua funcionando com `localStorage`; o servidor só complementa |
| Sincronização entre aparelhos | Etapa 5 (o esquema já tem `updated_at` e `deleted_at`) |
| Amizades entre contas diferentes | Etapa 7 (endpoints que validam cada ação) |
| Dados só do dono | Toda consulta filtra por `account_id` da sessão |
| ID pode crescer no futuro | `public_id` é só um apelido; a chave real é um UUID |

## Riscos que precisam ficar claros

1. **Autenticação própria é a parte mais delicada.** Aqui ela está feita com Web Crypto padrão (PBKDF2, sal, pimenta, tempo constante), mas não é um serviço gerenciado e merece revisão antes de ter usuários reais.
2. **Hash de senha no plano gratuito:** o Worker gratuito tem pouco CPU por requisição. Um hash forte (centenas de milhares de iterações) pode não caber, e a Web Crypto do Workers limita as iterações. O custo é configurável (`PBKDF2_ITERATIONS`) e precisa ser **medido depois do deploy**. Hash mais fraco compensa-se com senha longa (mínimo de 10) e pimenta.
3. **Negação de serviço pela cota:** um bot pode gastar as requisições e gravações diárias grátis e derrubar o login para todos até a renovação. O site segue funcionando no modo local.
4. **Token no navegador:** como o site (GitHub Pages) e a API ficam em domínios diferentes, a sessão usa token em `localStorage`, que roubo por XSS expõe. Por isso as correções de validação e escape do `app.js` são parte da segurança do backend.
5. **ID de 5 dígitos** tem só 100 mil combinações. Por isso ele nunca é tratado como segredo, e o limite de tentativas vale também para IDs que não existem.
6. **Sem e-mail e sem o código, a conta perdida não tem como ser recuperada.**

## Etapas

| Etapa | Entrega | Estado |
|---|---|---|
| 1 | Banco e autenticação: cadastro, login, sair, recuperar, limite de tentativas, sessões | ✅ código e testes prontos (`backend/`); falta publicar e medir o CPU |
| 2 | Esquema SQL revisado | ✅ `backend/schema.sql` (testado em SQLite) |
| 3 | Ligar o site à API (tela de entrar com a conta), mantendo o modo local | ⬜ |
| 4 | Camada de armazenamento no `app.js` (local e remoto) | ⬜ |
| 5 | Sincronização (mudanças desde X, apagados, conflito por data de alteração) | ⬜ |
| 6 | Migração do JSON antigo sem duplicar | ⬜ |
| 7 | Amizades no servidor: pedir, aceitar, recusar, remover | ⬜ |
| 8 | Compartilhamento configurável pelo usuário | ⬜ |
| 9 | Auditoria: testes de segurança entre duas contas | ⬜ |

## Decisões ainda abertas

- **Conflitos na sincronização:** proposta é "a última alteração vence", por item. Serve para este app (cada registro é editado quase só em um aparelho).
- **O que um amigo enxerga:** hoje, tudo em modo leitura. Proposta: o usuário escolhe (por exemplo, esconder as observações).
- **Avatar:** guardar no servidor aumenta o consumo; proposta é reduzir para uma imagem pequena ou manter só local no começo.
- **Troca de senha e exclusão de conta:** faltam; entram junto da etapa 3.

## Regras para todas as etapas

1. Nenhuma funcionalidade atual pode sumir.
2. O modo offline não depende do backend.
3. Nenhum segredo vai para o navegador nem para o repositório.
4. Um usuário nunca acessa dados de outro sem autorização.
5. Dados locais nunca são apagados por falha de sincronização.
6. Toda funcionalidade nova tem teste.
7. Backups exportáveis continuam existindo, para poder trocar de provedor.
