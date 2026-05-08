# Documentação do JSON — OFF Nutrition Lab

Esta documentação explica como o front-end deve consumir o banco de dados em JSON da OFF Nutrition Lab, quais propriedades devem aparecer no site, quais são apenas internas, como montar produtos e variações, quais imagens usar e quais dados devem ser enviados para o checkout da Shopify.

---

## 1. Objetivo do JSON

O JSON funciona como uma base de dados local e relacional para alimentar o front-end da loja.

Ele deve ser usado para:

- listar produtos na vitrine;
- montar cards de produto;
- exibir a página de detalhes do produto;
- montar seletores de variação, como sabor e tamanho;
- controlar preço, estoque local e disponibilidade;
- indicar imagens principais e imagens de galeria;
- enviar a variação correta para o checkout da Shopify;
- configurar textos de botão, quantidade mínima/máxima e atributos extras do checkout.

Ele não deve ser usado para mostrar todos os dados brutos na tela. Muitas propriedades são apenas técnicas, relacionais ou de integração.

---

## 2. Estrutura geral do JSON

A estrutura principal é:

```json
{
  "store": {},
  "settings": {},
  "brands": [],
  "categories": [],
  "optionTypes": [],
  "optionValues": [],
  "products": [],
  "productOptions": [],
  "productImages": [],
  "shippingProfiles": [],
  "variants": [],
  "productSeo": [],
  "productCheckout": []
}
```

Cada bloco tem uma função específica. O front-end deve cruzar as informações usando os IDs.

Exemplo:

```json
{
  "productId": 1,
  "brandId": 1,
  "categoryId": 1,
  "optionValueIds": [2, 3]
}
```

Esse padrão significa que o front-end deve buscar as informações relacionadas nas outras listas.

---

# 3. `store`

## Função

Guarda dados gerais da loja.

```json
"store": {
  "name": "OFF Nutrition Lab",
  "shopifyDomain": "offnutrition.com.br",
  "storefrontAccessToken": "COLOQUE_AQUI_SEU_TOKEN_PUBLICO_STOREFRONT_API",
  "currency": "BRL",
  "locale": "pt-BR"
}
```

## Como usar no front-end

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `name` | Nome da loja; pode aparecer no header, footer, title ou alt institucional | Sim |
| `shopifyDomain` | Usado internamente para comunicação com Shopify | Não |
| `storefrontAccessToken` | Token público da Storefront API | Não |
| `currency` | Usado para formatar preços | Não diretamente |
| `locale` | Usado para formatar moeda, datas e idioma | Não diretamente |

## Observação importante

Mesmo o token da Storefront API sendo público, ele não deve aparecer visualmente no site. Ele deve ser usado apenas no código responsável pela integração com a Shopify.

---

# 4. `settings`

## Função

Define o comportamento geral do front-end.

```json
"settings": {
  "useLocalProducts": true,
  "useShopifyCheckout": true,
  "useLocalStockControl": true,
  "cartStorageKey": "off_cart",
  "checkoutBehavior": "redirect_to_shopify_checkout"
}
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `useLocalProducts` | Define se os produtos virão do JSON local | Não |
| `useShopifyCheckout` | Define se o checkout será feito pela Shopify | Não |
| `useLocalStockControl` | Define se o front-end deve considerar estoque local | Não |
| `cartStorageKey` | Nome da chave usada no `localStorage` para salvar o carrinho | Não |
| `checkoutBehavior` | Define o comportamento ao finalizar compra | Não |

## Regra recomendada

Se `useLocalProducts` for `true`, o front-end deve montar a loja usando os dados do JSON.

Se `useShopifyCheckout` for `true`, ao finalizar a compra o front-end deve criar o checkout/cart usando os IDs da Shopify presentes na variação selecionada.

---

# 5. `brands`

## Função

Lista de marcas disponíveis.

```json
"brands": [
  {
    "id": 1,
    "name": "OFF Nutrition Lab",
    "slug": "off-nutrition-lab"
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Relacionar produto com marca | Não |
| `name` | Exibir nome da marca no card ou página do produto | Sim, se fizer sentido |
| `slug` | Usado para URL, filtro ou rota | Não necessariamente |

## Onde aplicar no site

Pode aparecer em:

- card de produto;
- página de detalhes;
- filtros por marca;
- breadcrumb;
- URL amigável.

Exemplo de uso:

```js
const brand = brands.find(brand => brand.id === product.brandId);
```

---

# 6. `categories`

## Função

Lista de categorias dos produtos.

```json
"categories": [
  {
    "id": 1,
    "name": "Suplementos",
    "slug": "suplementos"
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Relacionar produto com categoria | Não |
| `name` | Exibir categoria, filtro ou breadcrumb | Sim |
| `slug` | Usado para URLs e filtros | Não diretamente |

## Onde aplicar no site

Pode ser usado em:

- menu de categorias;
- filtro de produtos;
- breadcrumb;
- página de categoria;
- card de produto, se desejar.

---

# 7. `products`

## Função

Contém os dados principais do produto. Aqui não ficam preço, estoque ou variação. Essas informações ficam em `variants`.

```json
"products": [
  {
    "id": 1,
    "name": "Catalyze Pro",
    "slug": "catalyze-pro",
    "subtitle": "Energy drink",
    "brandId": 1,
    "categoryId": 1,
    "description": "Fórmula avançada...",
    "shortDescription": "Energia, foco e constância para sua rotina.",
    "featured": true,
    "active": true,
    "shopify": {
      "productId": "gid://shopify/Product/..."
    }
  }
]
```

## Como usar no front-end

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Identificador interno do produto | Não |
| `name` | Nome principal do produto | Sim |
| `slug` | URL amigável do produto | Não diretamente |
| `subtitle` | Frase curta abaixo do nome | Sim |
| `brandId` | Buscar a marca em `brands` | Não |
| `categoryId` | Buscar a categoria em `categories` | Não |
| `description` | Descrição completa na página do produto | Sim |
| `shortDescription` | Descrição curta no card e hero do produto | Sim |
| `featured` | Define se aparece em seções de destaque | Não diretamente |
| `active` | Define se o produto deve ser exibido | Não |
| `shopify.productId` | ID do produto na Shopify | Não |

## Regras de exibição

O front-end deve exibir apenas produtos com:

```js
product.active === true
```

Produtos com `active: false` devem ficar ocultos da vitrine, mesmo que existam no JSON.

Produtos com `featured: true` podem aparecer em áreas como:

- seção principal da home;
- carrossel de destaque;
- vitrine de produtos recomendados;
- landing page do produto.

## Onde aplicar cada informação

### Card de produto

Usar preferencialmente:

- `product.name`
- `product.subtitle`
- `product.shortDescription`
- imagem principal de `productImages`
- menor preço disponível entre as variações ativas
- preço antigo, se existir
- botão vindo de `productCheckout.cartButtonText` ou `productCheckout.buttonText`

### Página de produto

Usar:

- `product.name`
- `product.subtitle`
- `product.description`
- marca resolvida por `brandId`
- categoria resolvida por `categoryId`
- imagens principais e galeria
- opções de variação
- preço da variação selecionada
- estoque/disponibilidade da variação selecionada
- botões de checkout

---

# 8. `productImages`

## Função

Guarda as imagens relacionadas ao produto.

```json
"productImages": [
  {
    "id": 1,
    "productId": 1,
    "src": "./assets/products/catalyze-pro/catalyze-pro-front.png",
    "alt": "Catalyze Pro - imagem principal",
    "type": "main",
    "position": 1
  },
  {
    "id": 2,
    "productId": 1,
    "src": "./assets/products/catalyze-pro/catalyze-pro-detail.png",
    "alt": "Catalyze Pro - detalhes do produto",
    "type": "gallery",
    "position": 2
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Relacionar imagem com produto ou variação | Não |
| `productId` | Identificar o produto dono da imagem | Não |
| `src` | Caminho da imagem | Sim, como `src` da imagem |
| `alt` | Texto alternativo da imagem | Sim, no atributo `alt` |
| `type` | Define função da imagem | Não diretamente |
| `position` | Ordenação das imagens | Não |

## Imagem principal

A imagem principal do produto é a imagem com:

```js
image.type === "main"
```

Se houver mais de uma imagem `main`, usar a de menor `position`.

Exemplo:

```js
const mainImage = productImages
  .filter(image => image.productId === product.id && image.type === "main")
  .sort((a, b) => a.position - b.position)[0];
```

## Imagens de galeria

As imagens de galeria são as imagens com:

```js
image.type === "gallery"
```

Elas devem aparecer na galeria da página do produto, thumbnails, carrossel ou seção de detalhes.

Exemplo:

```js
const galleryImages = productImages
  .filter(image => image.productId === product.id && image.type === "gallery")
  .sort((a, b) => a.position - b.position);
```

## Regra recomendada para a página do produto

Na página do produto:

1. Mostrar primeiro a imagem `main`.
2. Abaixo ou ao lado, mostrar imagens `gallery`.
3. Ordenar todas por `position`.
4. Usar `alt` sempre no atributo da imagem.

Exemplo de HTML esperado:

```html
<img src="./assets/products/catalyze-pro/catalyze-pro-front.png" alt="Catalyze Pro - imagem principal">
```

## O que não mostrar

Não mostrar na tela:

- `id`
- `productId`
- `type`
- `position`

Esses campos são apenas para controle do sistema.

---

# 9. `optionTypes`

## Função

Define os grupos de variação do produto.

Exemplos:

- Sabor
- Tamanho
- Cor
- Modelo

```json
"optionTypes": [
  {
    "id": 1,
    "name": "Sabor",
    "slug": "sabor",
    "position": 1
  },
  {
    "id": 2,
    "name": "Tamanho",
    "slug": "tamanho",
    "position": 2
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Relacionar com `optionValues` e `productOptions` | Não |
| `name` | Título do seletor de variação | Sim |
| `slug` | Identificador amigável para lógica/rota/filtro | Não |
| `position` | Ordem dos seletores | Não |

## Onde aparece

Na página do produto, o `name` deve aparecer como título do seletor.

Exemplo:

```txt
Sabor
[Frutas Vermelhas] [Acid Lemon]

Tamanho
[300g · 30 doses] [600g · 60 doses]
```

---

# 10. `optionValues`

## Função

Define os valores disponíveis para cada tipo de opção.

```json
"optionValues": [
  {
    "id": 1,
    "optionTypeId": 1,
    "value": "Frutas Vermelhas",
    "slug": "frutas-vermelhas"
  },
  {
    "id": 3,
    "optionTypeId": 2,
    "value": "300g · 30 doses",
    "slug": "300g-30-doses"
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Relacionar com `variants.optionValueIds` | Não |
| `optionTypeId` | Saber a qual grupo pertence | Não |
| `value` | Texto do botão/chip de seleção | Sim |
| `slug` | Lógica interna, URL ou filtro | Não |

## Onde aparece

Na seleção de variação do produto.

Exemplo:

```html
<button>Frutas Vermelhas</button>
<button>Acid Lemon</button>
```

## Importante

O front-end não deve mostrar todos os `optionValues` em todos os produtos. Ele deve usar `productOptions` para saber quais grupos de opção pertencem ao produto atual.

---

# 11. `productOptions`

## Função

Define quais tipos de opção cada produto usa.

```json
"productOptions": [
  {
    "id": 1,
    "productId": 1,
    "optionTypeId": 1,
    "position": 1
  },
  {
    "id": 2,
    "productId": 1,
    "optionTypeId": 2,
    "position": 2
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Controle interno | Não |
| `productId` | Produto relacionado | Não |
| `optionTypeId` | Grupo de opção usado pelo produto | Não |
| `position` | Ordem dos seletores | Não |

## Regra de montagem das opções

Para montar os seletores de variação da página do produto:

1. Buscar todos os `productOptions` do produto atual.
2. Ordenar por `position`.
3. Para cada `optionTypeId`, buscar o tipo em `optionTypes`.
4. Para cada tipo, buscar os valores em `optionValues`.
5. Exibir os valores como botões/chips.

Exemplo de lógica:

```js
const productOptionGroups = productOptions
  .filter(item => item.productId === product.id)
  .sort((a, b) => a.position - b.position)
  .map(item => {
    const type = optionTypes.find(type => type.id === item.optionTypeId);
    const values = optionValues.filter(value => value.optionTypeId === item.optionTypeId);

    return { type, values };
  });
```

---

# 12. `variants`

## Função

Contém as variações vendáveis do produto.

Cada variação representa uma combinação real que pode ser comprada.

Exemplo:

```txt
Catalyze Pro + Acid Lemon + 300g
```

```json
"variants": [
  {
    "id": 2,
    "productId": 1,
    "title": "Catalyze Pro - Acid Lemon - 300g",
    "availableForSale": true,
    "optionValueIds": [2, 3],
    "pricing": {
      "price": 129.9,
      "compareAtPrice": 159.9,
      "installmentsText": "ou em até 12x no cartão"
    },
    "inventory": {
      "manageStock": true,
      "quantity": 10
    },
    "imageIds": [1, 2],
    "shippingProfileId": 1,
    "shopify": {
      "variantId": "gid://shopify/ProductVariant/...",
      "merchandiseId": "gid://shopify/ProductVariant/..."
    }
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Controle interno da variação | Não |
| `productId` | Relacionar variação com produto | Não |
| `title` | Nome completo da variação selecionada | Pode mostrar em resumo/carrinho |
| `availableForSale` | Controla se pode comprar | Não diretamente |
| `optionValueIds` | Identifica a combinação da variação | Não |
| `pricing.price` | Preço atual da variação | Sim |
| `pricing.compareAtPrice` | Preço antigo/de comparação | Sim, se maior que o preço atual |
| `pricing.installmentsText` | Texto de parcelamento | Sim |
| `inventory.manageStock` | Define se considera estoque local | Não |
| `inventory.quantity` | Quantidade em estoque local | Pode mostrar como aviso, não obrigatório |
| `imageIds` | Imagens específicas da variação | Não |
| `shippingProfileId` | Perfil de peso/frete local | Não normalmente |
| `shopify.variantId` | ID técnico da variação Shopify | Não |
| `shopify.merchandiseId` | ID enviado ao checkout Shopify | Não |

## Regra principal

O preço exibido na tela deve vir da variação selecionada, não do produto.

```js
selectedVariant.pricing.price
```

## Formatação de preço

O JSON salva o preço como número:

```json
"price": 129.9
```

O front-end deve formatar em BRL:

```js
const price = selectedVariant.pricing.price.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});
```

Resultado:

```txt
R$ 129,90
```

## Preço antigo

Mostrar `compareAtPrice` apenas se ele existir e for maior que `price`.

```js
const hasDiscount = variant.pricing.compareAtPrice > variant.pricing.price;
```

Se `hasDiscount` for verdadeiro, pode mostrar:

```txt
De R$ 159,90 por R$ 129,90
```

Se for falso, não mostrar preço antigo.

## Disponibilidade

A variação deve poder ser comprada somente se:

```js
variant.availableForSale === true
```

E, se `settings.useLocalStockControl` for `true`, também verificar:

```js
variant.inventory.manageStock === false || variant.inventory.quantity > 0
```

## Regra recomendada para botão de compra

Se a variação estiver disponível:

```txt
Comprar agora
```

Se a variação estiver indisponível:

```txt
Indisponível
```

E o botão deve ficar desabilitado.

## Como encontrar a variação selecionada

Quando o usuário selecionar opções, por exemplo:

```js
selectedOptionValueIds = [2, 3]
```

O front-end deve encontrar a variação que tenha exatamente esses IDs em `optionValueIds`.

Exemplo:

```js
function findSelectedVariant(productId, selectedOptionValueIds, variants) {
  return variants.find(variant => {
    if (variant.productId !== productId) return false;
    if (variant.optionValueIds.length !== selectedOptionValueIds.length) return false;

    return selectedOptionValueIds.every(id => variant.optionValueIds.includes(id));
  });
}
```

## O que não mostrar na tela

Não mostrar diretamente:

- `id`
- `productId`
- `optionValueIds`
- `imageIds`
- `shippingProfileId`
- `shopify.variantId`
- `shopify.merchandiseId`
- `inventory.manageStock`

Esses dados são técnicos.

---

# 13. `shippingProfiles`

## Função

Define peso e necessidade de envio.

```json
"shippingProfiles": [
  {
    "id": 1,
    "name": "Suplemento 300g",
    "requiresShipping": true,
    "weight": {
      "value": 0.3,
      "unit": "kg"
    }
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Relacionar com a variação | Não |
| `name` | Nome interno do perfil | Não |
| `requiresShipping` | Controle interno/logística | Não |
| `weight.value` | Peso do item | Só se quiser exibir ficha técnica |
| `weight.unit` | Unidade do peso | Só se quiser exibir ficha técnica |

## Observação sobre Shopify

Se o checkout for feito pela Shopify, o cálculo real de frete normalmente será feito pela própria Shopify com base no produto/variação cadastrada lá.

Nesse caso, o front-end não precisa enviar `shippingProfileId` para o checkout.

Esse campo serve principalmente para controle local, organização ou exibição técnica, se necessário.

---

# 14. `productSeo`

## Função

Define título e descrição SEO do produto.

```json
"productSeo": [
  {
    "id": 1,
    "productId": 1,
    "title": "Catalyze Pro | Energético em pó | OFF Nutrition Lab",
    "description": "Conheça o Catalyze Pro, energético em pó da OFF Nutrition Lab para energia, foco e rotina."
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Controle interno | Não |
| `productId` | Relacionar SEO ao produto | Não |
| `title` | Usar em `<title>` e meta tags | Não diretamente no corpo |
| `description` | Usar em meta description | Não diretamente no corpo |

## Onde aplicar

Na página do produto:

```html
<title>Catalyze Pro | Energético em pó | OFF Nutrition Lab</title>
<meta name="description" content="Conheça o Catalyze Pro, energético em pó da OFF Nutrition Lab para energia, foco e rotina.">
```

## Regra recomendada

Não usar `productSeo.description` como descrição visual do produto. Para texto visível, usar:

- `product.shortDescription`
- `product.description`

---

# 15. `productCheckout`

## Função

Guarda regras e textos de checkout por produto.

```json
"productCheckout": [
  {
    "id": 1,
    "productId": 1,
    "quantityDefault": 1,
    "quantityMin": 1,
    "quantityMax": 10000,
    "buttonText": "Comprar agora",
    "cartButtonText": "Adicionar ao carrinho",
    "lineAttributes": [
      {
        "key": "origem",
        "value": "site-estatico-off"
      }
    ]
  }
]
```

## Como usar

| Propriedade | Uso recomendado | Mostrar na tela? |
|---|---|---|
| `id` | Controle interno | Não |
| `productId` | Relacionar checkout ao produto | Não |
| `quantityDefault` | Quantidade inicial do seletor | Não diretamente |
| `quantityMin` | Quantidade mínima permitida | Não |
| `quantityMax` | Quantidade máxima permitida | Não |
| `buttonText` | Texto do botão de compra imediata | Sim |
| `cartButtonText` | Texto do botão de adicionar ao carrinho | Sim |
| `lineAttributes` | Atributos extras enviados ao checkout Shopify | Não |

## Onde aplicar no site

Na página do produto:

```html
<button>Adicionar ao carrinho</button>
<button>Comprar agora</button>
```

Os textos devem vir de:

```js
productCheckout.cartButtonText
productCheckout.buttonText
```

## Quantidade

O seletor de quantidade deve usar:

```js
quantityDefault
quantityMin
quantityMax
```

Exemplo:

```html
<input type="number" min="1" max="10000" value="1">
```

Se a variação tiver estoque local ativo, o `max` recomendado deve ser o menor valor entre:

- `productCheckout.quantityMax`
- `variant.inventory.quantity`

Exemplo:

```js
const maxQuantity = settings.useLocalStockControl && variant.inventory.manageStock
  ? Math.min(productCheckout.quantityMax, variant.inventory.quantity)
  : productCheckout.quantityMax;
```

---

# 16. O que enviar para o checkout da Shopify

Ao finalizar a compra pela Shopify, o front-end deve enviar principalmente a variação selecionada.

## Dados essenciais

Enviar:

```json
{
  "merchandiseId": "gid://shopify/ProductVariant/...",
  "quantity": 1
}
```

O `merchandiseId` vem de:

```js
selectedVariant.shopify.merchandiseId
```

A quantidade vem do seletor de quantidade do usuário.

## Dados adicionais

Enviar também `lineAttributes`, se existirem no `productCheckout`.

Exemplo:

```json
"attributes": [
  {
    "key": "origem",
    "value": "site-estatico-off"
  }
]
```

## Exemplo de payload conceitual para Shopify

```js
const checkoutPayload = {
  lines: [
    {
      merchandiseId: selectedVariant.shopify.merchandiseId,
      quantity: selectedQuantity,
      attributes: productCheckout.lineAttributes || []
    }
  ]
};
```

## O que não enviar para Shopify

Não enviar:

- `product.name`
- `product.description`
- `productImages`
- `categoryId`
- `brandId`
- `optionTypes`
- `optionValues`
- `pricing.price`
- `inventory.quantity`
- `shippingProfileId`

A Shopify deve reconhecer o produto, preço, estoque oficial e frete pelo `merchandiseId` da variação cadastrada na própria Shopify.

## Atenção importante

O preço exibido no site vem do JSON local, mas o preço final cobrado no checkout será o preço cadastrado na Shopify.

Por isso, os preços locais devem estar sempre alinhados com os preços da Shopify para evitar divergência.

---

# 17. Como montar o card de produto

## Dados recomendados

Para cada produto ativo:

- `product.name`
- `product.subtitle`
- `product.shortDescription`
- imagem principal `productImages.type === "main"`
- menor preço entre as variações disponíveis
- menor preço antigo válido entre as variações disponíveis, se existir
- botão `productCheckout.cartButtonText`

## Exemplo de montagem

```js
const activeProducts = products.filter(product => product.active);

const productCard = activeProducts.map(product => {
  const mainImage = productImages
    .filter(image => image.productId === product.id && image.type === "main")
    .sort((a, b) => a.position - b.position)[0];

  const availableVariants = variants.filter(variant =>
    variant.productId === product.id &&
    variant.availableForSale
  );

  const lowestPrice = Math.min(...availableVariants.map(variant => variant.pricing.price));

  return {
    name: product.name,
    subtitle: product.subtitle,
    shortDescription: product.shortDescription,
    image: mainImage,
    price: lowestPrice
  };
});
```

## Não usar no card

Não mostrar no card:

- IDs técnicos;
- token da Shopify;
- `optionValueIds`;
- `shopify.productId`;
- `shopify.variantId`;
- `shopify.merchandiseId`;
- `shippingProfileId`.

---

# 18. Como montar a página de produto

## Passo 1 — Encontrar o produto pela URL

Usar o `slug`:

```js
const product = products.find(product => product.slug === slugFromUrl);
```

## Passo 2 — Validar se o produto está ativo

```js
if (!product || !product.active) {
  // Exibir 404 ou redirecionar
}
```

## Passo 3 — Buscar imagens

```js
const images = productImages
  .filter(image => image.productId === product.id)
  .sort((a, b) => a.position - b.position);

const mainImage = images.find(image => image.type === "main") || images[0];
const galleryImages = images.filter(image => image.type === "gallery");
```

## Passo 4 — Buscar opções do produto

```js
const optionGroups = productOptions
  .filter(item => item.productId === product.id)
  .sort((a, b) => a.position - b.position)
  .map(item => {
    const type = optionTypes.find(type => type.id === item.optionTypeId);
    const values = optionValues.filter(value => value.optionTypeId === item.optionTypeId);
    return { type, values };
  });
```

## Passo 5 — Buscar variação selecionada

```js
const selectedVariant = findSelectedVariant(product.id, selectedOptionValueIds, variants);
```

## Passo 6 — Atualizar preço e disponibilidade

```js
const price = selectedVariant.pricing.price;
const compareAtPrice = selectedVariant.pricing.compareAtPrice;
const available = selectedVariant.availableForSale;
```

## Passo 7 — Enviar para checkout

```js
const payload = {
  lines: [
    {
      merchandiseId: selectedVariant.shopify.merchandiseId,
      quantity: selectedQuantity,
      attributes: productCheckout.lineAttributes || []
    }
  ]
};
```

---

# 19. Ordem recomendada de prioridade das imagens

## Para card de produto

1. Imagem `type: "main"`
2. Se não existir, primeira imagem ordenada por `position`
3. Se não existir imagem, usar placeholder visual

## Para galeria

1. Imagens `type: "gallery"`
2. Ordenar por `position`
3. Se a galeria estiver vazia, mostrar apenas a imagem principal

## Para variação selecionada

Se a variação tiver `imageIds`, o front-end pode priorizar essas imagens quando a variação for selecionada.

Exemplo:

```js
const variantImages = productImages.filter(image =>
  selectedVariant.imageIds.includes(image.id)
);
```

Regra recomendada:

- Ao abrir o produto, mostrar imagem principal do produto.
- Ao selecionar uma variação, se ela tiver imagens próprias em `imageIds`, atualizar a galeria para essas imagens.
- Se a variação não tiver imagens próprias, manter as imagens gerais do produto.

---

# 20. Resumo do que deve aparecer na tela

## Pode aparecer na tela

- Nome da loja: `store.name`
- Nome do produto: `product.name`
- Subtítulo: `product.subtitle`
- Descrição curta: `product.shortDescription`
- Descrição completa: `product.description`
- Nome da marca resolvida por `brandId`
- Nome da categoria resolvida por `categoryId`
- Imagem principal: `productImages.type === "main"`
- Galeria: `productImages.type === "gallery"`
- Nome dos grupos de opção: `optionTypes.name`
- Valores das opções: `optionValues.value`
- Preço: `variant.pricing.price`
- Preço antigo: `variant.pricing.compareAtPrice`, somente se maior que o preço atual
- Texto de parcelas: `variant.pricing.installmentsText`
- Botão de compra: `productCheckout.buttonText`
- Botão de carrinho: `productCheckout.cartButtonText`
- Quantidade disponível, se quiser mostrar aviso de estoque

## Não deve aparecer na tela

- `id`
- `productId`
- `brandId`
- `categoryId`
- `optionTypeId`
- `optionValueIds`
- `imageIds`
- `shippingProfileId`
- `shopify.productId`
- `shopify.variantId`
- `shopify.merchandiseId`
- `storefrontAccessToken`
- `cartStorageKey`
- `checkoutBehavior`
- `lineAttributes`
- `inventory.manageStock`

Esses campos são técnicos, relacionais ou de integração.

---

# 21. Resumo do que enviar para a Shopify

## Enviar para Shopify

Enviar apenas o necessário para criar o carrinho/checkout:

```js
{
  merchandiseId: selectedVariant.shopify.merchandiseId,
  quantity: selectedQuantity,
  attributes: productCheckout.lineAttributes || []
}
```

## Não enviar para Shopify

Não enviar dados visuais nem relacionais do JSON local.

A Shopify precisa receber a variação correta por `merchandiseId`. O restante deve ser controlado pela própria Shopify.

---

# 22. Fluxo ideal do usuário no site

1. Usuário acessa a home.
2. Front-end carrega o JSON.
3. Filtra produtos com `active: true`.
4. Monta cards usando produto, imagem principal e menor preço disponível.
5. Usuário abre um produto.
6. Front-end carrega imagens, descrição e opções.
7. Usuário seleciona sabor e tamanho.
8. Front-end encontra a variação correspondente.
9. O preço, estoque, imagens e botão são atualizados.
10. Usuário clica em comprar.
11. Front-end envia `selectedVariant.shopify.merchandiseId`, quantidade e `lineAttributes` para a Shopify.
12. Usuário é redirecionado para o checkout da Shopify.

---

# 23. Boas práticas para o front-end

## Sempre filtrar produtos ativos

```js
products.filter(product => product.active)
```

## Sempre validar variação antes do checkout

```js
if (!selectedVariant || !selectedVariant.shopify.merchandiseId) {
  alert("Selecione uma variação válida antes de continuar.");
}
```

## Sempre formatar preço no front-end

Não salvar preço formatado no JSON.

Correto:

```json
"price": 129.9
```

Errado:

```json
"price": "R$ 129,90"
```

## Sempre usar `alt` nas imagens

```html
<img src="..." alt="Catalyze Pro - imagem principal">
```

## Sempre respeitar `availableForSale`

Se a variação estiver indisponível, o botão de compra deve ficar desabilitado.

---

# 24. Exemplo de objeto final para renderização de produto

O front-end pode montar um objeto intermediário assim:

```js
const viewModel = {
  id: product.id,
  name: product.name,
  slug: product.slug,
  subtitle: product.subtitle,
  brand: brand.name,
  category: category.name,
  shortDescription: product.shortDescription,
  description: product.description,
  mainImage,
  galleryImages,
  optionGroups,
  variants: productVariants,
  checkout: productCheckoutData,
  seo: productSeoData
};
```

Esse `viewModel` é o objeto ideal para o front-end usar na tela, porque ele já vem limpo e sem expor campos técnicos desnecessários.

---

# 25. Checklist final de implementação

Antes de colocar o front-end em produção, validar:

- Todos os produtos ativos têm pelo menos uma imagem `main`.
- Todos os produtos ativos têm pelo menos uma variação disponível.
- Toda variação disponível tem `shopify.merchandiseId` preenchido.
- Todo produto tem `productCheckout` configurado.
- Todo produto tem `productSeo` configurado.
- Todo preço local está igual ao preço da Shopify.
- Toda variação tem a combinação correta em `optionValueIds`.
- O botão de compra só ativa depois que uma variação válida for selecionada.
- O checkout recebe apenas `merchandiseId`, `quantity` e `lineAttributes`.

---

# 26. Regra de ouro

O JSON é a fonte local de exibição e organização do site.

A Shopify é a fonte final do checkout.

Portanto:

- o site usa o JSON para mostrar produto, imagens, textos, preço e opções;
- o checkout usa a Shopify para finalizar a compra;
- o elo entre os dois é a variação selecionada através de `shopify.merchandiseId`.

