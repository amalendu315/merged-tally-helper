const salesURL = process.env.SALES_URL || "";
const authorization = process.env.URL_AUTHORIZATION || "";
const cookie = process.env.URL_COOKIE || "";

//India
const cloudURL = process.env.CLOUD_URL || "";
const cloudAuthToken = process.env.CLOUD_AUTH_TOKEN || "";
//India
const returnCloudURL = process.env.RETURN_CLOUD_URL || "";
const returnCloudAuthToken = process.env.RETURN_CLOUD_AUTH_TOKEN || "";

//Nepal Sale
const saleCloudURL = process.env.NEPAL_SALE_CLOUD_URL || "";
const saleCloudAuthToken = process.env.NEPAL_SALE_CLOUD_AUTH_TOKEN || "";

//Nepal Purchase
const purchaseCloudURL = process.env.NEPAL_PURCHASE_CLOUD_URL || "";
const purchaseCloudAuthToken =
  process.env.NEPAL_PURCHASE_CLOUD_AUTH_TOKEN || ""


export {
  salesURL,
  authorization,
  cookie,
  cloudURL,
  cloudAuthToken,
  returnCloudURL,
  returnCloudAuthToken,
  saleCloudURL,
  saleCloudAuthToken,
  purchaseCloudURL,
  purchaseCloudAuthToken,
};
