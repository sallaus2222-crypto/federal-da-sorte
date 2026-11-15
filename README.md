# Federal Intelligence — edição independente

Esta edição remove completamente a dependência do Supabase. O aplicativo usa:

- **Fonte:** endpoint JSON da Loteria Federal da CAIXA.
- **Automação:** GitHub Actions consulta a fonte e atualiza `data/federal.json`.
- **Hospedagem:** GitHub Pages.
- **Cache local:** IndexedDB no navegador/aparelho.
- **PWA:** pode ser instalado e mantém a interface disponível offline.

## Como funciona

1. O workflow `Atualizar resultados da Federal` roda a cada 30 minutos (o GitHub pode atrasar execuções agendadas).
2. O coletor consulta o resultado mais recente e tenta obter os 14 concursos anteriores.
3. Cada bilhete e data é validado antes de salvar.
4. O arquivo `data/federal.json` é atualizado no próprio repositório.
5. O aplicativo lê esse arquivo e salva uma cópia no IndexedDB.
6. Se não houver internet, o aplicativo tenta abrir a última cópia local.

## Configuração no GitHub

1. Envie **todo o conteúdo desta pasta** para a raiz do repositório.
2. Em **Settings > Actions > General > Workflow permissions**, permita `Read and write permissions`.
3. Abra **Actions**, selecione `Atualizar resultados da Federal` e execute `Run workflow` uma vez.
4. Aguarde a execução terminar e confira se `data/federal.json` recebeu concursos.
5. Em **Settings > Pages**, publique a partir da branch `main`, pasta `/ (root)`.

Não são necessárias chaves, secrets, projeto Supabase ou Firebase.

## Fonte e limitações

Endpoint consultado:
`https://servicebus2.caixa.gov.br/portaldeloterias/api/federal`

Página oficial:
`https://loterias.caixa.gov.br/Paginas/Federal.aspx`

O endpoint é utilizado pelo portal de resultados, mas não é uma API pública documentada com garantia de estabilidade. Se a CAIXA mudar o formato, o coletor pode precisar de ajuste. A automação não inventa resultados: falha quando a resposta não passa na validação.

A consulta agendada não é instantânea nem garantida em horário exato. O GitHub Actions pode atrasar execuções. O botão Atualizar no app atualiza a leitura do JSON já publicado; ele não dispara uma nova execução do workflow.

## Análise estatística

O painel usa os 15 concursos mais recentes disponíveis no arquivo. Cada concurso tem cinco bilhetes. Terminações, centenas e milhares são frequências observadas, não previsões nem garantias de premiação.

## Privacidade e armazenamento

Não há cadastro nem envio de dados pessoais. O cache de resultados fica no IndexedDB do navegador. Se o usuário limpar os dados do navegador, a cópia local será apagada; os resultados podem ser baixados novamente quando houver conexão.
