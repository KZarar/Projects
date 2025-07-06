const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

module.exports = async function (context, req) {
    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0) {
            context.res = { status: 400, body: "A 'messages' array is required." };
            return;
        }

        // First, get the complete text response from the chat model
        const aiTextResponse = await getAiContextualResponse(messages, context);

        // Second, get the full audio file from the TTS API
        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                input: aiTextResponse,
                voice: 'alloy',
                response_format: 'mp3'
            }),
        });

        if (!ttsResponse.ok) {
            throw new Error(`TTS API failed with status ${ttsResponse.status}`);
        }

        // Buffer the entire audio file in memory on the server
        const audioBuffer = await ttsResponse.buffer();

        // Send the complete audio file to the client. Remove isRaw.
        context.res = {
            status: 200,
            headers: {
                "Content-Type": "audio/mpeg",
            },
            body: audioBuffer,
        };

    } catch (error) {
        context.log.error('Error:', error.message);
        context.res = { status: 500, body: `An error occurred: ${error.message}` };
    }
};

async function getAiContextualResponse(messageHistory, context) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const systemMessage = {
        role: "system",
        content: "You are a helpful assistant. Only provide short and concise answers. Remember the previous parts of the conversation."
    };
    const requestBody = {
        model: "gpt-4o",
        messages: [systemMessage, ...messageHistory],
        temperature: 0.7,
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) throw new Error('Failed to get chat response from OpenAI.');

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim();
}