# AutoVideo Manager Core

CONTEXTO

Estamos iniciando o AutoVideo Manager, um SaaS privado de automação e geração de vídeos em lote.

Nesta etapa quero construir SOMENTE a fundação visual do sistema, a navegação e o fluxo visual de acesso.

Nenhum backend será implementado agora.

ESCOPO

Criar:

1. App Shell principal.
2. Sidebar responsiva.
3. Sistema de rotas.
4. Tela de Login mockada.
5. Componentes base reutilizáveis.
6. Estados visuais fundamentais.

LOGIN MOCKADO

A aplicação deve iniciar na tela de Login.

Interface:

- Campo de email.
- Botão "Enviar código".
- Estado de carregamento.
- Estado "Código enviado".
- Campo para código OTP.
- Botão "Verificar código".
- Estado "Acesso autorizado".
- Estado "Acesso negado".

Para teste da interface, utilizar:

Email autorizado:
marcosyurisepol@gmail.com

Comportamento:

- Esse email deve simular acesso autorizado.
- Qualquer outro email deve apresentar "Acesso negado".
- Após o envio simulado do código, mostrar o campo OTP.
- O código pode ser fictício e controlado apenas por React state.
- Não criar cadastro de usuários.
- Não criar lista de usuários.
- Não criar sistema de senha.
- Não implementar autenticação real.

APP SHELL

Após o login mockado:

- Sidebar fixa no desktop.
- Sidebar como drawer/menu hambúrguer no mobile.
- Logo AutoVideo Manager.
- Navegação:

  Dashboard
  Templates
  Automation Flow
  Configurações

- Destacar visualmente a página ativa.
- Navegação sem recarregar o navegador.

ROTAS

Criar rotas independentes para:

/dashboard
/templates
/automation-flow
/configuracoes

A aplicação deve iniciar em:

/login

COMPONENTES BASE

Criar ou reutilizar componentes existentes para:

- Button
- Input
- Select
- Badge
- Dialog/Modal
- Drawer
- Toast
- Tooltip
- Loader
- Empty State
- Error State

Antes de criar qualquer componente novo, verifique se já existe um componente equivalente no projeto.

Não criar componentes duplicados desnecessariamente.

REGRA DE UX

Nenhum botão ou ferramenta deve ser puramente decorativo.

Toda interação deve seguir:

CLIQUE → AÇÃO → FEEDBACK → NOVO ESTADO

Exemplo:

Enviar código
→ loading
→ código enviado
→ campo OTP disponível

Verificar código
→ loading
→ acesso autorizado ou acesso negado

Sidebar
→ clique
→ mudança de rota
→ página correspondente

ESTILO

- Dark Mode neon premium. -bright mode premium e completo.
- Visual minimalista.
- Profissional.
- Responsivo.
- Tailwind CSS.
- shadcn/ui.
- Lucide Icons.
- Componentes reutilizáveis.
- Espaçamento e tipografia consistentes.
- Animações discretas.

ESTADOS

Todos os componentes relevantes devem possuir estados visuais de:

- Loading
- Success
- Error
- Empty
- Disabled

GUARDRAILS

NÃO implementar nesta etapa:

- Supabase.
- Supabase Auth.
- Storage.
- Banco de dados.
- APIs externas.
- Secrets.
- localStorage.
- autenticação real.
- lógica de usuários reais.
- upload real.
- processamento de vídeo.

NÃO implementar ainda as funcionalidades internas do Dashboard, Templates, Automation Flow ou Configurações.

Essas páginas devem existir apenas como estrutura inicial navegável.

NÃO alterar ou adicionar arquitetura de backend.

CRITÉRIOS DE ACEITE

1. A aplicação inicia no Login.
2. marcosyurisepol@gmail.com é reconhecido como usuário autorizado no mock.
3. Qualquer outro email apresenta acesso negado.
4. O fluxo de OTP funciona visualmente.
5. Após autorização, o usuário entra no App Shell.
6. Sidebar funciona.
7. As quatro rotas funcionam.
8. Navegação não recarrega a página.
9. Sidebar funciona corretamente no desktop e mobile.
10. Todos os controles criados nesta etapa possuem comportamento visual real.
11. Não existem botões meramente decorativos.
12. Não foi adicionada nenhuma integração com backend ou API.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0938d14f-115b-4410-aaf0-97f0bfd8686a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
