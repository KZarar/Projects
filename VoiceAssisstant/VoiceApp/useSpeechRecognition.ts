import { useState, useEffect, useRef } from 'react';

// Define the types for the SpeechRecognition and GrammarList for browser compatibility.
type SpeechRecognitionConstructor = new () => SpeechRecognition;
type SpeechGrammarListConstructor = new () => SpeechGrammarList;

interface IWindowWithSpeech extends Window {
  SpeechRecognition: SpeechRecognitionConstructor;
  webkitSpeechRecognition: SpeechRecognitionConstructor;
  SpeechGrammarList: SpeechGrammarListConstructor;
  webkitSpeechGrammarList: SpeechGrammarListConstructor;
}

const typedWindow = window as unknown as IWindowWithSpeech;
const SpeechRecognition = typedWindow.SpeechRecognition || typedWindow.webkitSpeechRecognition;
const SpeechGrammarList = typedWindow.SpeechGrammarList || typedWindow.webkitSpeechGrammarList;
const isSpeechRecognitionSupported = !!SpeechRecognition;

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!isSpeechRecognitionSupported) {
      console.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    
    if (SpeechGrammarList) {
      const speechRecognitionList = new SpeechGrammarList();
      const numbers = 'zero | oh | one | two | three | four | five | six | seven | eight | nine';
      const grammar = `#JSGF V1.0; grammar contactId; public <id> = ( C | see ) ( ${numbers} )+;`;
      speechRecognitionList.addFromString(grammar, 1);
      recognition.grammars = speechRecognitionList;
    }

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const rawTranscript = event.results[event.resultIndex][0].transcript;
      let finalTranscript = rawTranscript;

      const idPattern = /(c|see)[\s-]*((?:\d|oh|zero|one|two|three|four|five|six|seven|eight|nine|\s)+)/i;
      const match = rawTranscript.match(idPattern);

      if (match) {
        console.log("Detected a Contact ID pattern. Extracting and formatting.");
        
        const idPart = match[0];
        const formattedId = idPart.toLowerCase()
                                .replace(/\s/g, '')
                                .replace('see', 'c')
                                .replace('-', '')
                                .replace('dash', '')
                                .replace('hyphen', '')
                                .replace(/oh/g, '0')
                                .replace(/zero/g, '0')
                                .replace(/one/g, '1')
                                .replace(/two/g, '2')
                                .replace(/three/g, '3')
                                .replace(/four/g, '4')
                                .replace(/five/g, '5')
                                .replace(/six/g, '6')
                                .replace(/seven/g, '7')
                                .replace(/eight/g, '8')
                                .replace(/nine/g, '9')
                                .toUpperCase();
        
        finalTranscript = rawTranscript.replace(idPart, formattedId);
      }
      
      setTranscript(finalTranscript.trim());
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        console.warn('Speech recognition error: No speech was detected.');
      } else if (event.error === 'audio-capture') {
        console.error('Speech recognition error: Microphone not available.');
      } else {
        console.error('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSpeechRecognitionSupported,
  };
};