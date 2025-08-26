/**
 * Import the 2nd generation onRequest function from the Firebase SDK.
 */
const { onRequest } = require("firebase-functions/v2/https");

/**
 * A 2nd generation webhook for receiving data from the Bland AI service.
 *
 * This function is triggered by an HTTP POST request. It logs the entire
 * request body to the Cloud Functions logs for inspection and then sends
 * a success response to acknowledge receipt of the data.
 *
 * @param {object} request - The HTTP request object from Express.js.
 * @param {object} response - The HTTP response object from Express.js.
 */
exports.blandAiWebhook = onRequest((request, response) => {
  // Check if the request method is POST.
  if (request.method !== "POST") {
    // If not, send a 405 Method Not Allowed error.
    return response.status(405).send("Method Not Allowed");
  }

  // Log the entire request body, pretty-printed for readability.
  console.log("Received Bland AI Webhook Payload:");
  console.log(JSON.stringify(request.body, null, 2));

  // Send a 200 OK success response back to the Bland AI server.
  response.status(200).json({ status: "received" });
});
