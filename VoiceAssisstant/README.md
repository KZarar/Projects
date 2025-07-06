# 🎤 Voice Assistant PCF Control

Welcome to the **Voice Assistant** PowerApps Component Framework (PCF) control! This control brings voice interaction to your Power Apps using modern browser APIs and Azure Functions for real-time, AI-powered responses. 🚀

---

## ✨ Features
- **Push-to-Talk** microphone button for voice input
- Real-time speech-to-text using browser Speech Recognition
- Sends your query to an Azure Function and plays back the AI-generated audio response
- Animated UI with status indicators (Listening, Processing, Speaking)
- Built with React and TypeScript for maintainability

---

## 🛠️ How It Works
1. **Press and hold** the mic button to start talking
2. Your speech is transcribed in real-time
3. When you release the button, your message is sent to the configured Azure Function
4. The Azure Function returns an audio response, which is played back in the app

---

## ⚡ Getting Started

### Prerequisites
- Power Apps environment with PCF support
- An Azure Function endpoint that accepts POST requests and returns audio (WAV/MP3)
- Modern browser (Chrome, Edge, etc.) with Speech Recognition support

### Installation
1. Clone or download this repo
2. Build the control:
   ```powershell
   npm install
   npm run build
   ```
3. Import the control into your Power Apps environment

### Configuration
- **functionAppUrl**: Set this property to your Azure Function endpoint URL

---

## 🧩 File Structure
- `VoiceApp/` - Main React component and logic
- `VoiceApp/index.ts` - PCF control entry point
- `VoiceApp/VoiceApp.tsx` - UI and voice logic
- `VoiceApp/useSpeechRecognition.ts` - Custom React hook for speech recognition
- `VoiceApp/css/VoiceApp.css` - Styles
- `VoiceApp/generated/ManifestTypes.d.ts` - Auto-generated types
- `VoiceApp/ControlManifest.Input.xml` - PCF manifest

---

## 🚦 Status Indicators
- 🟣 **Idle**: Hold the mic to speak
- 🔴 **Listening**: Capturing your voice
- 🟡 **Processing**: Thinking...
- 🟢 **Speaking**: Playing response
- ❌ **Error**: Something went wrong

---

## 🙏 Credits
- My first ever PCF built with ❤️ using React, TypeScript, and the PowerApps Component Framework


## 🔮 Roadmap 
- Add function calling to interact with Dataverse seamlessly.
