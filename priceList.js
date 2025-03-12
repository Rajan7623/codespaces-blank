import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = "2025-01";

const headers = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
};

// GraphQL query to fetch market catalogs
const MARKET_QUERY = `
  query Catalogs {
    catalogs(first: 10, type: MARKET) {
      nodes {
        id
        status
        priceList { id }
        publication { id }
        ... on MarketCatalog {
          markets(first: 10) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`;

// Mutation to create a price list
const PRICE_LIST_CREATE_MUTATION = `
  mutation priceListCreate($input: PriceListCreateInput!) {
    priceListCreate(input: $input) {
      priceList {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const PRICE_LIST_FIXED_PRICES_ADD_MUTATION = `
  mutation priceListFixedPricesAdd($priceListId: ID!, $prices: [PriceListPriceInput!]!) {
    priceListFixedPricesAdd(priceListId: $priceListId, prices: $prices) {
      prices {
        price {
          amount
          currencyCode
        }
      }
      userErrors {
        field
        code
        message
      }
    }
  }
`;

const PRODUCTS_BY_COLLECTION_QUERY = `
  query getCollectionProducts($collectionId: ID!) {
    collection(id: $collectionId) {
      products(first: 100) {
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }
      }
    }
  }
`;

// async function createPriceList(priceListInput) {
//   try {
//     const response = await axios.post(
//       `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
//       {
//         query: PRICE_LIST_CREATE_MUTATION,
//         variables: { input: priceListInput },
//       },
//       { headers }
//     );

//     console.log(response.data);
    
//     const data = response.data?.data?.priceListCreate;
//     if (data?.userErrors.length) {
//       console.error("User Errors:", data.userErrors);
//       return null;
//     }

//     return data?.priceList?.id;
//   } catch (error) {
//     console.error("Error creating price list:", error.response?.data || error.message);
//     throw error;
//   }
// }

async function fetchMarkets() {
  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      { query: MARKET_QUERY },
      { headers }
    );

    const catalogs = response.data?.data?.catalogs?.nodes || [];

    if (catalogs.length === 0) {
      console.log("No catalogs found.");
      return [];
    }

    const unitedStatesMarketId = "gid://shopify/Market/38931529925"; // United States market ID

    // Filter catalogs to only include those that have the United States market
    const filteredCatalogs = catalogs.filter((catalog) =>
      catalog.markets.nodes.some((market) => market.id === unitedStatesMarketId)
    ).map((catalog) => ({
      catalogId: catalog.id,
      priceListId: catalog.priceList?.id || null,
      markets: catalog.markets.nodes || [],
    }));

    if (filteredCatalogs.length === 0) {
      console.log("No catalogs found for the United States.");
      return [];
    }

    console.log("Filtered catalogs:", JSON.stringify(filteredCatalogs, null, 2));
    return filteredCatalogs;
    // =======

    // Now create a price list for the United States market
    // for (const catalog of filteredCatalogs) {
    //   const priceListInput = {
    //     name: `Updated Prices for ${catalog.markets[0]?.name || 'Unknown Market'}`, // Set dynamic name based on market
    //     currency: "INR", // Set currency as INR (adjust as necessary)
    //     catalogId: catalog.catalogId,
    //     parent: {
    //       adjustment: {
    //         type: "PERCENTAGE_INCREASE", // Type of adjustment, e.g., fixed amount or percentage
    //         value: 0, // For no adjustment
    //       }
    //     },
    //   };

    //   const priceListId = await createPriceList(priceListInput);
    //   if (priceListId) {
    //     console.log(`Price list created with ID: ${priceListId}`);
    //   } else {
    //     console.log("Failed to create price list.");
    //   }
    // }

  } catch (error) {
    console.error("Error fetching markets or creating price list:", error.response?.data || error.message);
    throw error;
  }
}

async function updateProductPrices(priceListId, prices) {
  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        query: PRICE_LIST_FIXED_PRICES_ADD_MUTATION,
        variables: { priceListId, prices },
      },
      { headers }
    );

    const data = response.data?.data?.priceListFixedPricesAdd;
    if (data?.userErrors.length) {
      console.error("User Errors:", data.userErrors);
      return null;
    }

    console.log("Prices updated successfully:", data.prices);
    return data.prices;
  } catch (error) {
    console.error("Error updating prices:", error.response?.data || error.message);
    throw error;
  }
}

async function fetchProductsFromCollection(collectionId) {
  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        query: PRODUCTS_BY_COLLECTION_QUERY,
        variables: { collectionId },
      },
      { headers }
    );

    const products = response.data?.data?.collection?.products?.edges || [];
    const prices = products.flatMap((product) =>
      product.node.variants.edges.map((variant) => ({
        price: { amount: (parseFloat(variant.node.price) + 20).toFixed(2), currencyCode: "INR" },
        variantId: variant.node.id,
      }))
    );

    return prices;
  } catch (error) {
    console.error("Error fetching products from collection:", error);
    throw error;
  }
}

async function fetchMarketsAndUpdatePrices() {
  try {
    const catalogs = await fetchMarkets();
    const collectionId = "gid://shopify/Collection/317998072005"; // Replace with your collection ID

    for (const catalog of catalogs) {
      if (!catalog.priceListId) {
        console.log(`No price list found for catalog: ${catalog.catalogId}`);
        continue;
      }

      const priceListId = catalog.priceListId;
      const prices = await fetchProductsFromCollection(collectionId);

      if (prices.length === 0) {
        console.log("No products found in the collection.");
        continue;
      }

      await updateProductPrices(priceListId, prices);
    }
  } catch (error) {
    console.error("Error in fetchMarketsAndUpdatePrices:", error);
  }
}

// Run the process
fetchMarketsAndUpdatePrices();
