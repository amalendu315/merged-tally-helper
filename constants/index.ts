const salesURL = process.env.SALES_URL || "";
const authorization = process.env.URL_AUTHORIZATION || "";
const cookie = process.env.URL_COOKIE || "";

const cloudURL = process.env.CLOUD_URL || "";
const cloudAuthToken = process.env.CLOUD_AUTH_TOKEN || "";

const returnCloudURL = process.env.RETURN_CLOUD_URL || "";
const returnCloudAuthToken = process.env.RETURN_CLOUD_AUTH_TOKEN || "";

export {
  salesURL,
  authorization,
  cookie,
  cloudURL,
  cloudAuthToken,
  returnCloudURL,
  returnCloudAuthToken,
};
