# NuvemVerse — plataforma multiplayer

Projeto inicial criado do zero, inspirado na estrutura de plataformas de experiências como Roblox, com identidade visual e código próprios.

## O que já funciona nesta primeira versão
- Cadastro e login com senha criptografada.
- Perfil básico e avatar em blocos.
- Catálogo de experiências.
- Obby 3D simples jogável no navegador.
- Multiplayer em tempo real: jogadores conectados aparecem na mesma sala.
- Lista de amigos e envio/aceite de solicitações.
- Controles de teclado e botões para celular.

## Rodar localmente
1. Instale Node.js 20 ou superior.
2. Na pasta do projeto, rode `npm install`.
3. Rode `npm start`.
4. Abra `http://localhost:3000`.

Sem `DATABASE_URL`, os dados de teste são guardados em `store.json` localmente.

## Publicar no Render
1. Envie todos os arquivos para um repositório GitHub.
2. Crie um Web Service no Render usando esse repositório.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Para manter contas/amigos após reinicializações e deploys, crie um PostgreSQL no Render e adicione a variável `DATABASE_URL` ao serviço web.

## Importante
Esta é a primeira versão funcional/MVP, não uma cópia integral do Roblox. Ela ainda não possui criação livre de jogos pelos usuários, moderação avançada, chat público, economia virtual, marketplace ou infraestrutura para milhões de jogadores. O servidor valida autenticação e registra posições multiplayer; para produção maior, serão necessários limites, moderação, monitoramento e testes de carga.
