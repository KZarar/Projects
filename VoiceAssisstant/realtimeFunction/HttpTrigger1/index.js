const fetch = require('node-fetch');
const { ClientSecretCredential } = require("@azure/identity");

// --- CONFIGURATION ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATAVERSE_URL = process.env.DATAVERSE_URL;
const DATAVERSE_CLIENT_ID = process.env.DATAVERSE_CLIENT_ID;
const DATAVERSE_CLIENT_SECRET = process.env.DATAVERSE_CLIENT_SECRET;
const DATAVERSE_TENANT_ID = process.env.DATAVERSE_TENANT_ID;

// --- TOOL DEFINITIONS ---
const tools = [
  {
    "type": "function",
    "function": {
      "name": "search_by_contact_id",
      "description": "Finds a contact in the system using their unique contact ID and returns their full name and ID.",
      "parameters": {
        "type": "object",
        "properties": { "contactId": { "type": "string", "description": "The unique ID (e.g., C0001) of the contact to search for." }},
        "required": ["contactId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_mobile_phone_number",
      "description": "Gets the mobile phone number for a contact given their unique ID.",
      "parameters": {
        "type": "object",
        "properties": { "contactId": { "type": "string", "description": "The unique ID (e.g., C0001) of the contact." }},
        "required": ["contactId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_contact_phone_number",
      "description": "Updates the mobile phone number for a contact given their unique ID and the new number.",
      "parameters": {
        "type": "object",
        "properties": {
          "contactId": { "type": "string", "description": "The unique ID (e.g., C0001) of the contact." },
          "mobileNumber": { "type": "string", "description": "The new mobile phone number." }
        },
        "required": ["contactId", "mobileNumber"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_contact_address",
      "description": "Gets the full address for a contact given their unique ID.",
      "parameters": {
        "type": "object",
        "properties": { "contactId": { "type": "string", "description": "The unique ID (e.g., C0001) of the contact." }},
        "required": ["contactId"]
      }
    }
  }
];

// --- MAIN AZURE FUNCTION HANDLER ---
module.exports = async function (context, req) {
    context.log("Received request body:", req.body);
    try {
        if (!OPENAI_API_KEY || !DATAVERSE_URL || !DATAVERSE_CLIENT_ID || !DATAVERSE_CLIENT_SECRET || !DATAVERSE_TENANT_ID) {
            throw new Error("Server configuration is incomplete.");
        }
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return { status: 400, body: "A 'messages' array is required." };
        }
        const aiTextResponse = await getAiContextualResponse(messages, context);
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'tts-1', input: aiTextResponse, voice: 'alloy' }),
        });
        if (!ttsResponse.ok) throw new Error(`TTS API failed with status ${ttsResponse.status}`);
        const audioBuffer = await ttsResponse.buffer();
        context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: {
                audio: audioBuffer.toString('base64'),
                text: aiTextResponse
            },
        };
    } catch (error) {
        context.log.error('Error in main handler:', error.message);
        context.res = { status: 500, body: `An error occurred: ${error.message}` };
    }
};

// --- HELPER FUNCTIONS ---

async function getAiContextualResponse(messageHistory, context) {
    const systemMessage = { 
        role: "system", 
        content: "You are a helpful assistant for a Dataverse system. Your primary task is to respond to the most recent user message. Use previous messages for context only, but do not re-execute actions from previous turns. When a contact is found, remember their ID for follow-up questions. Politely decline any requests not related to managing contacts." 
    };
    
    const initialResponse = await callOpenAI([systemMessage, ...messageHistory], context, tools);
    const responseMessage = initialResponse.choices[0].message;

    if (responseMessage.tool_calls) {
        context.log(`AI has decided to call ${responseMessage.tool_calls.length} function(s).`);
        const toolPromises = responseMessage.tool_calls.map(async (toolCall) => {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            let result;

            switch (functionName) {
                case "search_by_contact_id":
                    result = await callDataverseApi("kzh_SearchbyContactID", { "varContactID": functionArgs.contactId }, context);
                    break;
                case "get_mobile_phone_number":
                    result = await callDataverseApi("kzh_GetMobilePhoneNumber", { "varContactID": functionArgs.contactId }, context);
                    break;
                case "update_contact_phone_number":
                    result = await callDataverseApi("kzh_UpdateContactPhoneNumber", { "varContactID": functionArgs.contactId, "varMobilePhoneNumber": functionArgs.mobileNumber }, context);
                    break;
                case "get_contact_address":
                    result = await callDataverseApi("kzh_GetContactAddress", { "varContactID": functionArgs.contactId }, context);
                    break;
                default:
                    result = { error: "Unknown function called by AI." };
            }
            return { tool_call_id: toolCall.id, role: "tool", content: JSON.stringify(result) };
        });
        const toolResults = await Promise.all(toolPromises);
        const finalResponse = await callOpenAI([ ...messageHistory, responseMessage, ...toolResults ], context);
        return finalResponse.choices[0].message.content;
    }
    return responseMessage.content;
}

async function callOpenAI(messages, context, tools = null) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const body = { model: "gpt-4o", messages, temperature: 0.7 };
    if (tools) {
        body.tools = tools;
        body.tool_choice = "auto";
    }
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        context.log.error(`OpenAI API error! Status: ${response.status}`, errorBody);
        throw new Error('OpenAI API call failed.');
    }
    return response.json();
}

async function callDataverseApi(apiName, payload, context) {
    context.log(`Calling Dataverse API: ${apiName} with payload:`, payload);
    try {
        const credential = new ClientSecretCredential(DATAVERSE_TENANT_ID, DATAVERSE_CLIENT_ID, DATAVERSE_CLIENT_SECRET);
        const accessToken = (await credential.getToken(`${DATAVERSE_URL}/.default`)).token;
        const response = await fetch(`${DATAVERSE_URL}/api/data/v9.2/${apiName}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Dataverse API failed with status ${response.status}: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        context.log.error(`Dataverse call failed: ${error.message}`);
        return { error: `Failed to query Dataverse for API: ${apiName}.` };
    }
}