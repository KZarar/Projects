import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';

interface VoiceAppProps {
  functionAppUrl: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface IWindowWithAudioContext extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext: typeof AudioContext;
}
const typedWindow = window as unknown as IWindowWithAudioContext;
const audioContext = new (typedWindow.AudioContext || typedWindow.webkitAudioContext)();

const CONVERSATION_WINDOW_SIZE = 6;

export const VoiceAppComponent: React.FC<VoiceAppProps> = ({ functionAppUrl }) => {
  const [statusText, setStatusText] = useState('Hold the mic to speak.');
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      handleSendQuery(transcript);
    }
  }, [transcript]);

  const handleMicDown = () => {
    if (audioSource) {
      audioSource.stop();
    }
    startListening();
  };

  const handleSendQuery = async (query: string) => {
    if (!functionAppUrl) {
      console.error("Azure Function URL is not configured in the component properties.");
      setStatusText('Error: Function URL not set.');
      return;
    }
    
    setIsProcessing(true);
    setStatusText('Thinking...');
    
    const newMessages: Message[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);

    const recentMessages = newMessages.slice(-CONVERSATION_WINDOW_SIZE);

    try {
      const response = await fetch(functionAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recentMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      setStatusText('Speaking...');
      
      const responseData = await response.json();
      const aiText = responseData.text;
      
      setMessages(prev => [...prev, {role: 'assistant', content: aiText}]);
      
      const audioBlob = atob(responseData.audio);
      const audioArray = new Uint8Array(audioBlob.length);
      for (let i = 0; i < audioBlob.length; i++) {
          audioArray[i] = audioBlob.charCodeAt(i);
      }
      const audioBuffer = await audioContext.decodeAudioData(audioArray.buffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);

      setAudioSource(source);

      source.onended = () => {
        setStatusText('Hold the mic to speak.');
        setIsProcessing(false);
      };

    } catch (error) {
      console.error("Failed to fetch from Azure Function:", error);
      setStatusText('Error. Try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="voice-app-container">
      <div className="display-area">
        <div className="response-text">
          {isListening ? 'Listening...' : statusText}
        </div>
      </div>
      <div className="control-area">
        <button
          className={`mic-button ${isListening ? 'listening' : ''}`}
          disabled={isProcessing}
          onMouseDown={handleMicDown}
          onMouseUp={stopListening}
          onTouchStart={handleMicDown}
          onTouchEnd={stopListening}
        >
          🎤
        </button>
      </div>
    </div>
  );
};