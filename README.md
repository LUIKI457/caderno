# Caderno de Estudos

Site estático (HTML + CSS + JS puro) que lê os arquivos `.json` e `.txt` da pasta `materias/` do seu próprio repositório e os transforma em um caderno digital. Sem backend, sem banco de dados, sem build.

**Regra principal:** coloque o arquivo no GitHub e ele aparece no caderno.

## 1. Criar o repositório

1. No GitHub, clique em **New repository**.
2. Escolha um nome, por exemplo `caderno`, e marque **Public**. A API do GitHub só funciona sem login em repositórios públicos.
3. Envie para a raiz do repositório: `index.html`, `style.css`, `app.js` e `README.md`.
4. Crie a pasta `materias/` (veja a seção 3).

## 2. Publicar no GitHub Pages

1. Abra **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**.
3. Selecione a branch `main` e a pasta `/ (root)`, e clique em **Save**.
4. Após alguns minutos o site estará em `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

## 3. Configurar `owner`, `repo` e `branch`

No início do `app.js`:

```js
const CONFIG = {
    owner: "MEU_USUARIO",       // seu usuário do GitHub
    repo: "MEU_REPOSITORIO",    // nome do repositório
    branch: "main",             // branch publicada
    contentFolder: "materias"   // pasta com os conteúdos
};
```

## 4. Onde colocar os arquivos e como organizar as matérias

Cada pasta dentro de `materias/` vira uma matéria. O nome da pasta define o nome exibido (`historia` vira "História").

```
materias/
├── historia/
│   ├── periodo-regencial.json
│   ├── primeiro-reinado.txt
│   └── revoltas/            ← subpastas também funcionam
│       └── cabanagem.txt
├── geografia/
│   └── africa.json
└── matematica/
    └── equacoes.json
```

- A pasta de primeiro nível é a matéria. As subpastas organizam os conteúdos dentro dela.
- Se uma pasta de matéria não tiver acentos (`historia`), o site usa uma lista de nomes comuns para acentuar. Outra forma: coloque `"materia": "História"` em um JSON da pasta (o texto precisa ser igual ao nome da pasta, só que acentuado).
- Arquivos que não sejam `.json` ou `.txt` são ignorados.
- **Adicionar:** faça o commit do arquivo.
- **Editar:** edite o arquivo no GitHub.
- **Apagar:** exclua o arquivo.
- Depois de qualquer mudança, abra o site e clique em **↻ Atualizar**. O cache local dura 10 minutos.
- O link de um conteúdo tem este formato: `#historia/periodo-regencial`.

## 5. Exemplo de `.txt`

```
Período Regencial

O Período Regencial começou após a abdicação de Dom Pedro I.

Avanço Liberal

Foi marcado por medidas de descentralização política.
- Código de Processo Criminal
- Ato Adicional de 1834

Regresso Conservador

Representou uma tendência de maior centralização.
```

Regras de leitura:

- A primeira linha isolada vira o título. Sem ela, o nome do arquivo é o título.
- Linhas curtas, isoladas e sem ponto final viram seções. Também vale `# Título`.
- Linhas começando com `-`, `*`, `•` ou `1.` viram listas.
- Parágrafos e quebras de linha são preservados.

## 6. Exemplo de `.json`

```json
{
  "titulo": "Período Regencial",
  "materia": "História",
  "descricao": "Resumo do período regencial",
  "topicos": [
    { "titulo": "Avanço Liberal", "conteudo": "Medidas de descentralização política..." },
    { "titulo": "Regresso Conservador", "conteudo": ["Fortalecimento do poder central", "Lei de Interpretação"] }
  ]
}
```

O leitor reconhece `titulo/title/nome`, `materia/subject`, `descricao/description`, `conteudo/content/texto/text` e `topicos/topics/secoes/sections`. Os tópicos aceitam subtópicos aninhados. Listas de textos viram listas.

Se a estrutura for desconhecida, o JSON é exibido como uma árvore legível. Se o JSON for inválido, o arquivo aparece com aviso de erro e o texto bruto, e os demais continuam funcionando.

## Observações

- **Limite da API:** sem autenticação o GitHub permite cerca de 60 requisições por hora por IP. O cache evita gastar isso. Ao atualizar, só são baixados de novo os arquivos que mudaram.
- **Ordenar por data** usa uma chamada extra por arquivo (Commits API), feita apenas quando você escolhe essa ordenação.
- **Delay do GitHub:** o `raw.githubusercontent.com` pode demorar alguns minutos para refletir uma edição recente.
- **Segurança:** o conteúdo é sempre inserido como texto (`textContent`). O código não usa `innerHTML`, então HTML dentro dos arquivos aparece como texto e não é executado.
