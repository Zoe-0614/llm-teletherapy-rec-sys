import { PaperAirplaneIcon } from "@heroicons/react/solid";
import { useMeeting, usePubSub } from "@videosdk.live/react-sdk";
import React, { useEffect, useRef, useState } from "react";
import { json_verify, nameTructed } from "../../utils/helper";

const Recommendation = ({ senderId, senderName, text }) => {
  const mMeeting = useMeeting();
  const localParticipantId = mMeeting?.localParticipant?.id;
  const localSender = localParticipantId === senderId;

  return (
    <div
      className={`flex ${localSender ? "justify-end" : "justify-start"} my-2`}
    >
      <div
        className={`max-w-2xl py-2 px-4 rounded-lg ${
          localSender ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"
        }`}
      >
        <div className="font-semibold">
          {localSender ? "You" : nameTructed(senderName, 15)}
        </div>
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
};

const RecSysInput = ({ inputHeight, onSendMessage, preloadedPrefix: preloadedText }) => {
  const [message, setMessage] = useState(preloadedText); // Preload the prefix
  const inputRef = useRef();

  useEffect(() => {
    setMessage(preloadedText); 
  }, [preloadedText]);

  const sendMessage = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      setMessage("");
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full flex items-center p-2 bg-gray-800" style={{ height: inputHeight }}>
      <input
        type="text"
        className="flex-grow p-2 rounded-l-lg text-white bg-gray-900"
        placeholder="Type here..."
        autoComplete="off"
        ref={inputRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
      />
      <button
        className="p-2 bg-blue-600 text-white rounded-r-lg"
        onClick={sendMessage}
        disabled={!message.trim()}
      >
        <PaperAirplaneIcon className="w-5 h-5 transform rotate-90" />
      </button>
    </div>
  );
};


const RecSysMessages = ({ listHeight }) => {
  const listRef = useRef();
  const { messages } = usePubSub("LLM");

  const scrollToBottom = (data) => {
    if (!data) {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    } else {
      const { text } = data;

      if (json_verify(text)) {
        const { type } = JSON.parse(text);
        if (type === "LLM") {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        }
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return messages ? (
    <div ref={listRef} style={{ overflowY: "scroll", height: listHeight }}>
      <div className="p-4">
        {messages.map((msg, i) => {
          const { senderId, senderName, message } = msg;
          return (
            <Recommendation
              key={`recsys_item_${i}`}
              {...{ senderId, senderName, text: message }}
            />
          );
        })}
      </div>
    </div>
  ) : (
    <p>No messages</p>
  );
};


export function RecSysPanel({ panelHeight, localParticipantId, isHost }) {
  const mMeeting = useMeeting();
  const isHost = mMeeting?.localParticipant?.role === 'host';
  // Early return null if the current user is not the host
  if (!isHost) {
    return null;
  }
  
  const [messages, setMessages] = useState([]);
  const inputHeight = 72; 
  const listHeight = panelHeight - inputHeight;
  const preloadedPrefix = "[INST] You are a professional mental health counselor during a real-time patient consultation session. \
  Your role is to offer the junior therapist 1-3 recommendations on how to respond to the patient's questions/situation. \
  It's crucial that these suggestions are concise, as the therapist needs to react in real time. Aim to help the therapist gain experience and effectively address the patient's concerns. \
  Example: <User> : Lately, I've been feeling really disconnected from reality. I often find it hard to distinguish between what's real and what's not. \
  For example, last week, I was having dinner with my family, and I suddenly thought my brother was about to attack me. I know it doesn't make any sense, but it felt real in that moment. \
  This has happened a few times, but not all the time. I'm also having a hard time concentrating and remembering things that have happened recently. \
  I've had some depressive episodes in the past, but this seems a bit different to me. Can you help me figure out what's going on? \
  <Assistant>: Thank you for sharing your experience with me. It sounds like you've been dealing with a mix of symptoms, and I can understand how that can be concerning. Before I can provide any feedback or guidance, can you please tell me more about your experience? For example, how long have these feelings of disconnection been happening, and are there any other symptoms you've noticed recently? It would also be helpful to know about any stressors in your life right now or any history of mental health issues in your family. This information will help me understand your situation better.]";

  const [preloadedText, setPreloadedText] = useState(""); 
  const [conversationStarted, setConversationStarted] = useState(false);
  let recognition;
  const handleSendMessage = async (messageText, isPrefix = false) => {

    try {
      const apiEndpoint = 'https://yourbackend.com/llm';
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, senderId: localParticipantId}),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const responseData = await response.json();
      
      // Update conversation with the LLM's response
      setMessages((currentMessages) => [
        ...currentMessages,
        { senderId: "Host", senderName: "You", message: messageText, timestamp: new Date().toISOString(), localSender: true },
        { senderId: "LLM", senderName: "LLM", message: llmResponse, timestamp: new Date().toISOString(), localSender: false },
      ]);
  
      if (isPrefix && !conversationStarted) {
        setConversationStarted(true); // Mark the conversation as started once the prefix is sent
      }
    } catch (error) {
      console.error("Error sending message to LLM:", error);
    }
  };

  const startSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join('');

      console.log(transcript);
      setPreloadedText(transcript); // Update text box with real-time speech to text
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
    };

    recognition.start();
  };

  // Effect to handle preloaded prefix sending
  useEffect(() => {
    if (!conversationStarted) {
      handleSendMessage(preloadedPrefix, true);
    }
  }, [conversationStarted]);

  // Effect to start speech-to-text conversion
  useEffect(() => {
    if (conversationStarted) {
      console.log("Starting speech to text conversion...");
      startSpeechToText();
    }
  }, [conversationStarted]);

  return (
    <div>
      <RecSysMessages listHeight={listHeight} messages={messages} />
      <RecSysInput 
        inputHeight={inputHeight} 
        onSendMessage={handleSendMessage} 
        preloadedText={preloadedText} 
        setPreloadedText={setPreloadedText} 
      />
    </div>
  );
}