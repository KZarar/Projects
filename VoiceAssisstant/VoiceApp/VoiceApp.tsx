import * as React from 'react';
import './css/VoiceApp.css';
import { useSpeechRecognition } from './useSpeechRecognition'; // Import the hook


interface VoiceAppProps {
  functionAppUrl: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Define a specific interface for the window object that includes the non-standard property.
// This is the correct, type-safe approach.
interface IWindowWithAudioContext extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
}

// Create a typed reference to the window object using our new interface.
const typedWindow = window as unknown as IWindowWithAudioContext;
const audioContext = new (typedWindow.AudioContext || typedWindow.webkitAudioContext)();


export const VoiceAppComponent: React.FC<VoiceAppProps> = ({ functionAppUrl }) => {
  const [status, setStatus] = React.useState<'idle' | 'listening' | 'processing' | 'playing' | 'error'>('idle');
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [audioSource, setAudioSource] = React.useState<AudioBufferSourceNode | null>(null);

  const { isListening, transcript, startListening, stopListening, isSpeechRecognitionSupported } = useSpeechRecognition();

  React.useEffect(() => {
    if (!isListening && transcript) {
      handleSendQueryToAzure(transcript);
    }
  }, [isListening, transcript]);

  const handleListenStart = () => {
    if (audioSource) {
      audioSource.stop();
    }
    if (!isSpeechRecognitionSupported || isListening) return;
    setStatus('listening');
    startListening();
  };

  const handleListenStop = () => {
    if (isListening) stopListening();
  };

  const handleSendQueryToAzure = async (query: string) => {
    if (!query.trim() || !functionAppUrl) {
      if (!functionAppUrl) console.error("Azure Function URL is not configured in the component properties.");
      return;
    }

    setStatus('processing');
    const newMessages: Message[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);

    try {
      const response = await fetch(functionAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      if (!response.body) throw new Error("Response has no body");

      setStatus('playing');

      const audioBuffer = await response.arrayBuffer();
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      source.start(0);

      setAudioSource(prevSource => {
        if (prevSource) {
          prevSource.stop();
        }
        return source;
      });

      source.onended = () => {
        setStatus('idle');
      };

    } catch (error) {
      console.error("Error during audio playback:", error);
      setStatus('error');
    }
  };

  const renderDisplayContent = () => {
    switch (status) {
      case 'listening': return <div className="indicator-text listening-active">Listening...</div>;
      case 'processing': return <div className="thinking-indicator"></div>;
      case 'playing': return <div className="indicator-text">Speaking...</div>;
      case 'error': return <div className="response-text error-text">An error occurred.</div>;
      case 'idle':
      default: return <div className="response-text">Hold the mic to speak.</div>;
    }
  };

  return (
    <div className="voice-app-container">
      <div className="display-area">{renderDisplayContent()}</div>
      <div className="control-area">
        <button
          onMouseDown={handleListenStart} onMouseUp={handleListenStop}
          onTouchStart={handleListenStart} onTouchEnd={handleListenStop}
          className={`mic-button ${isListening || status === 'playing' ? 'listening' : ''}`}
          disabled={!isSpeechRecognitionSupported || status === 'processing'}
          title="Hold to Talk"
        >🎤</button>
      </div>
    </div>
  );
};