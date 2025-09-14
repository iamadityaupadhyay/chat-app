"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import { addToCart } from "./lib/productService";
import { config } from "./lib/config";
import axios from "axios";

const EnhancedVoiceChat = () => {
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState(
    "You are a helpful AI assistant for an e-commerce platform. Provide concise, engaging responses. When users request products, return a list of relevant products with details (name, price, description, image) without mentioning them in the text response unless necessary. Let the user select a product before taking actions like adding to cart. Remember context and user preferences."
  );
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memory, setMemory] = useState({
    lists: {},
    context: {},
    preferences: {},
  });
  const [interimTranscript, setInterimTranscript] = useState("");
  const [autoListen, setAutoListen] = useState(false); // Changed default to false
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const recognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const messagesEndRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const conversationTimeoutRef = useRef(null);
  const lastProcessedTranscriptRef = useRef("");
  const isProcessingMessageRef = useRef(false);

  // Enhanced scroll with smooth animation
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, interimTranscript]);

  // Trigger confetti and popup for success messages
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage.role === "assistant" &&
      lastMessage.content.toLowerCase().includes("success")
    ) {
      setSuccessMessage(lastMessage.content);
      setShowSuccessPopup(true);
      // Remove confetti trigger here to avoid issues
      setTimeout(() => setShowSuccessPopup(false), 3000);
    }
  }, [messages]);

  // Initialize advanced speech recognition with better error handling
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = false; // Changed to false for better control
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {

        setIsRecording(true);
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        // Prevent processing if we're already handling a message or AI is speaking
        if (isProcessingMessageRef.current || isSpeaking) {

          return;
        }

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        // Only update interim if it's different and substantial
        if (interim && interim.length > 2) {
          setInterimTranscript(interim);
        }

        // Process final transcript with duplicate prevention
        if (final && final.length > 2) {
          // Check if this is a duplicate or very similar to last processed
          const similarity = calculateSimilarity(final, lastProcessedTranscriptRef.current);

          if (similarity < 0.8) { // Only process if less than 80% similar

            lastProcessedTranscriptRef.current = final;
            setInterimTranscript("");
            clearTimeout(silenceTimeoutRef.current);

            // Stop recognition immediately to prevent further input
            recognition.stop();

            handleUserMessage(final);
          } else {

          }
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        setIsListening(false);
        setInterimTranscript("");
        isProcessingMessageRef.current = false;

        // Only retry on specific errors and if auto-listen is enabled
        if (
          ["no-speech", "audio-capture"].includes(event.error) &&
          autoListen &&
          !isSpeaking &&
          !isProcessingMessageRef.current
        ) {
          setTimeout(() => restartListening(), 2000);
        }
      };

      recognition.onend = () => {

        setIsRecording(false);
        setIsListening(false);

        // Only restart if conditions are met
        if (
          autoListen &&
          !isSpeaking &&
          !isProcessingMessageRef.current &&
          !isLoading
        ) {
          setTimeout(() => restartListening(), 1000);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      clearTimeout(silenceTimeoutRef.current);
      clearTimeout(conversationTimeoutRef.current);
    };
  }, [autoListen, isSpeaking, isLoading]);

  // Function to calculate text similarity (simple implementation)
  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const getEditDistance = (str1, str2) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const restartListening = useCallback(() => {
    if (
      recognitionRef.current &&
      !isSpeaking &&
      !isLoading &&
      !isProcessingMessageRef.current &&
      autoListen
    ) {
      try {

        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to restart recognition:", error);
        // Wait longer before retrying if there's an error
        setTimeout(() => {
          if (autoListen && !isSpeaking && !isLoading && !isProcessingMessageRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Second restart attempt failed:", e);
            }
          }
        }, 3000);
      }
    }
  }, [isSpeaking, isLoading, autoListen]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (isRecording) {

      recognitionRef.current.stop();
      setIsRecording(false);
      setIsListening(false);
      setAutoListen(false);
      isProcessingMessageRef.current = false;
    } else {

      stopSpeaking();
      setAutoListen(true);
      isProcessingMessageRef.current = false;
      lastProcessedTranscriptRef.current = "";

      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start recognition:", error);
      }
    }
  };

  // Handle product selection
  const handleProductSelect = async (product, assistantMessageIndex) => {
    isProcessingMessageRef.current = true;

    // Stop any ongoing recognition
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    try {
      console.log("Product selected:", product);
      const response = await axios.post(config.addToCartUrl, {
        productId: product.id,
        quantity: 1,
        order_delivery_type: 1,
        lat: "28.6016406",
        long: "77.3896809"
      }, {
        headers: {
          ...config.cartHeaders,
          'token': "null"
        }
      });
      const selectMessage = {
        role: "user",
        content: `Add ${product.name}. to cart.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, selectMessage]);
      const aiMessage = {
        role: "assistant",
        content: `${product.name} has been added to your cart!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      speakText(aiMessage.content);
  setTextInput("");
    } catch (error) {
      const aiMessage = {
        role: "assistant",
        content: `Product is currently out of stock or cannot be added to the cart.`,
        timestamp: new Date(),
      };
      speakText(aiMessage.content);
      console.error(`Error adding ${product.name} to cart:`, error);
    }
  }
  const structureResponse = async (rawText) => {
    try {
      const prompt = `Parse the following AI response and extract structured data in JSON format only. Do not include any other text outside the JSON.
      Response to parse: "${rawText}"

      Instructions:
      - text: A clean, concise version of the response without mentioning or listing specific products (e.g., remove product names, prices, descriptions from the text unless they are not product-related).
      - num_products: The number of products mentioned or recommended (integer, 0 if none).
      - products: An array of product objects. For each product, extract only: {name: string, price: number, id: number, image: string}. If no products, empty array [].

      Return ONLY valid JSON like:
      {
        "text": "Your cleaned text here",
        "num_products": 3,
        "products": [
          {
            "id":1,
            "name": "Product Name",
            "price": 29.99,
            "description": "Short description",
            "image": "product_image_url"
          }
        ]
      }`;

      const response = await fetch("/api/chat-gpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const structuredData = await response.json();


      // Handle different response formats
      let parsedData;

      // Check if response is a string that needs parsing
      if (typeof structuredData === 'string') {
        // Try to match JSON within markdown code fences
        const jsonMatch = structuredData.match(/```json\s*([\s\S]*?)\s*```/) ||
          structuredData.match(/```[\s\S]*?([\s\S]*?)\s*```/) ||
          // Try to match raw JSON string
          structuredData.match(/{[\s\S]*}/);

        if (jsonMatch && jsonMatch[1]) {
          parsedData = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try parsing the entire string as JSON
          try {
            parsedData = JSON.parse(structuredData);
          } catch {
            // If parsing fails, return fallback
            throw new Error("Invalid JSON format");
          }
        }
      } else if (typeof structuredData === 'object' && structuredData !== null) {
        // If response is already an object, use it directly
        parsedData = structuredData;
      } else {
        throw new Error("Unexpected response format");
      }

      // Validate the parsed data structure
      if (!parsedData.text || typeof parsedData.num_products !== 'number' || !Array.isArray(parsedData.products)) {
        throw new Error("Invalid JSON structure");
      }

      return parsedData;
    } catch (error) {
      console.error("Structure response error:", error);
      // Fallback to raw text
      return {
        text: rawText,
        num_products: 0,
        products: [],
      };
    }
  };

  // Enhanced message handling with context awareness and response structuring
  const handleUserMessage = async (message) => {
    if (!message.trim() || isProcessingMessageRef.current) {

      return;
    }


    isProcessingMessageRef.current = true;

    stopSpeaking();
    setInterimTranscript("");

    // Stop recognition to prevent feedback
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }

    const userMessage = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setTextInput("");
    setIsLoading(true);

    try {
      const apiResponse = await callEnhancedAPI(message);

      if (apiResponse.memoryUpdate) {
        setMemory((prev) => ({
          ...prev,
          ...apiResponse.memoryUpdate,
        }));
      }

      // Structure the raw text response
      const structured = await structureResponse(apiResponse.text || "Here are some products you might like:");
      console.log("Structured response:", structured);


      const aiMessage = {
        role: "assistant",
        content: structured.text,
        products: structured.products || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Delay speech to ensure processing is complete
      setTimeout(() => {
        speakText(aiMessage.content);
      }, 500);

    } catch (error) {
      console.error("Message handling error:", error);
      const errorMessage = {
        role: "assistant",
        content: "I'm having trouble connecting right now. Could you try again?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      speakText(errorMessage.content);
    } finally {
      setIsLoading(false);
      // Reset processing flag after speech begins
      setTimeout(() => {
        isProcessingMessageRef.current = false;
      }, 2000);
    }
  };

  // Enhanced API call with product handling
  const callEnhancedAPI = async (userInput) => {
    try {
      const conversationHistory = [
        { role: "system", content: systemInstruction },
        ...messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: userInput },
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userInput,
          systemInstruction,
          conversationHistory,
          memory,
        }),
      });


      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("API call error:", error);
      return {
        text: "I found some products, but something went wrong. Please try again.",
        products: [],
        memoryUpdate: memory,
      };
    }
  };

  // Enhanced text-to-speech with better control
  const speakText = (text) => {
    text = text.replace(/tool_code[\s\S]*/g, "").trim();

    if ("speechSynthesis" in window && text) {
      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onstart = () => {

        setIsSpeaking(true);
        // Ensure recognition is stopped while speaking
        if (recognitionRef.current && isRecording) {
          recognitionRef.current.stop();
        }
      };

      utterance.onend = () => {

        setIsSpeaking(false);

        // Wait a bit longer before restarting recognition
        if (autoListen && !isProcessingMessageRef.current) {
          setTimeout(() => {

            restartListening();
          }, 1500);
        }
      };

      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event);
        setIsSpeaking(false);
        if (autoListen && !isProcessingMessageRef.current) {
          setTimeout(() => restartListening(), 1000);
        }
      };

      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);

    }
  };

  const clearConversation = () => {
    setMessages([]);
    setMemory({ lists: {}, context: {}, preferences: {} });
    stopSpeaking();
    setAutoListen(false);
    isProcessingMessageRef.current = false;
    lastProcessedTranscriptRef.current = "";

    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserMessage(textInput);
    }
  };

  const getOrbMode = () => {
    if (isLoading) return "thinking";
    if (isSpeaking) return "speaking";
    if (isListening) return "listening";
    return "idle";
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Central Reactive Orb */}
      {(isListening || isSpeaking || isLoading) && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="relative w-32 h-32">
            {isListening && (
              <>
                <div className="absolute inset-0 w-full h-full rounded-full bg-blue-400/30 animate-ping"></div>
                <div
                  className="absolute inset-0 w-full h-full rounded-full bg-blue-400/20 animate-ping"
                  style={{ animationDelay: "0.5s" }}
                ></div>
              </>
            )}
            {isSpeaking && (
              <>
                <div className="absolute inset-0 w-full h-full rounded-full bg-green-400/30 animate-ping"></div>
                <div
                  className="absolute inset-0 w-full h-full rounded-full bg-green-400/20 animate-ping"
                  style={{ animationDelay: "0.5s" }}
                ></div>
              </>
            )}
            <div
              className={`w-full h-full rounded-full shadow-2xl transition-all duration-300 transform ${getOrbMode() === "listening"
                ? "bg-gradient-to-r from-blue-400 to-blue-600 scale-110 animate-pulse shadow-blue-500/50"
                : getOrbMode() === "speaking"
                  ? "bg-gradient-to-r from-green-400 to-green-600 scale-110 animate-[wave_2s_ease-in-out_infinite] shadow-green-500/50"
                  : getOrbMode() === "thinking"
                    ? "bg-gradient-to-r from-purple-400 to-purple-600 scale-110 animate-spin shadow-purple-500/50"
                    : "bg-gradient-to-r from-gray-300 to-gray-400 scale-100"
                }`}
            >
              <div
                className={`absolute inset-0 rounded-full opacity-50 ${getOrbMode() === "listening"
                  ? "bg-blue-200 animate-pulse"
                  : getOrbMode() === "speaking"
                    ? "bg-green-200 animate-pulse"
                    : getOrbMode() === "thinking"
                      ? "bg-purple-200 animate-pulse"
                      : ""
                  }`}
              ></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              {getOrbMode() === "listening" && (
                <Mic className="w-8 h-8 text-white drop-shadow-md" />
              )}
              {getOrbMode() === "speaking" && (
                <Volume2 className="w-8 h-8 text-white drop-shadow-md" />
              )}
              {getOrbMode() === "thinking" && (
                <img src="/image.png" className="w-28  h-28 text-white rounded-full drop-shadow-md" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-xl p-6 shadow-2xl border border-green-200/50 max-w-sm text-center animate-[fadeIn_0.3s_ease-in-out]">
            <svg
              className="w-12 h-12 text-green-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Success!
            </h3>
            <p className="text-sm text-gray-600">Successfully Added to the cart</p>
          </div>
        </div>
      )}

      {/* Enhanced Header */}
      <div className="bg-white/95 backdrop-blur-md shadow-xl border-b border-blue-200/50 px-6 py-4 relative z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className=" bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-lg">
              <img src="/image.png" className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Deliverit Assistant
              </h1>
              <p className="text-sm text-gray-600">
                {isListening
                  ? "Listening to you..."
                  : isSpeaking
                    ? "Responding now..."
                    : isLoading
                      ? "Thinking..."
                      : autoListen
                        ? "Ready to listen"
                        : "Ready to chat"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={clearConversation}
              className="p-2 hover:bg-red-50 rounded-lg transition-all duration-200 text-red-600 hover:scale-105"
              title="Clear conversation"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Settings */}
      {showSettings && (
        <div className="bg-white/95 backdrop-blur-md border-b border-blue-200/50 px-6 py-4 space-y-4 relative z-10">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Conversation Style
            </label>
            <textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm transition-all"
            />
          </div>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoListen}
                onChange={(e) => {
                  setAutoListen(e.target.checked);
                  if (!e.target.checked && recognitionRef.current && isRecording) {
                    recognitionRef.current.stop();
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Continuous listening (auto-resumes after AI speaks)
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Enhanced Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 relative z-10">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 mt-8">
            <div className="mb-4 rounded-full">
              <img src="/image.png" className="w-16 h-16 rounded-full mx-auto text-blue-500 mb-4 animate-bounce" />
            </div>
            <p className="text-xl mb-2 font-semibold text-gray-700">
              Hello! I'm your Deliverit Assistant.
            </p>
            <p className="text-sm">
              Click the microphone to start voice chat, or type your message below.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              💡 Try saying: "Show me some headphones" or "I want to buy a smartwatch"
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i}>
            <div
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                } items-start space-x-2 ${m.role === "user" ? "space-x-reverse" : ""
                }`}
            >
              {m.role === "assistant" && (
                <div className="p-2  rounded-full mt-1">
                  <img src="/image.png" className="w-8 h-8 text-white rounded-full" />
                </div>
              )}
              <div
                className={`max-w-xs lg:max-w-md px-5 py-4 rounded-2xl shadow-lg transition-all hover:shadow-xl ${m.role === "user"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                  : "bg-white/80 backdrop-blur-sm text-gray-800 border border-gray-200/50"
                  }`}
              >
                <p className="text-sm leading-relaxed">
                  {m.content
                    .replace(/<\/?[^>]+(>|$)/g, "")
                    .replace(/tool_code[\s\S]*/g, "")
                    .trim()}
                </p>
                <p
                  className={`text-xs mt-2 ${m.role === "user" ? "text-blue-100" : "text-gray-500"
                    }`}
                >
                  {m.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {m.role === "user" && (
                <div className="p-2 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full mt-1 shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>

            {/* Assistant Product Suggestions */}
            {m.role === "assistant" && m.products && m.products.length > 0 && (
              <div className="gap-4 ml-12 mt-4">
                {/* Assistant Message */}
                <div className="">
                  <p className="text-sm font-medium text-gray-700">
                    I found {m.products.length} product{m.products.length > 1 ? "s" : ""}.
                    Here are some more trending products you might like:
                  </p>
                </div>

                {/* Horizontal Product Cards (Right Side) */}
                <div className="overflow-x-auto mb-2">
                  <div className="flex gap-4">
                    {m.products.map((product, idx) => (
                      <div
                        key={product.id || `${product.name}-${idx}`}
                        className="min-w-[180px] bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200"
                      >
                        {product.image && (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-32 object-cover"
                          />
                        )}
                        <div className="p-3">
                          <h3 className="font-semibold text-gray-800 text-sm truncate">
                            {product.name}
                          </h3>
                          <p className="text-green-600 font-bold text-sm mt-1">
                            ₹{product.price?.toFixed(2) || "N/A"}
                          </p>
                          <button
                            onClick={() => handleProductSelect(product, i)}
                            disabled={isLoading}
                            className="mt-2 w-full bg-blue-500 text-white py-1.5 px-3 rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            Select & Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        ))}

        {/* Interim transcript display */}
        {interimTranscript && (
          <div className="flex justify-end items-start space-x-2 space-x-reverse">
            <div className="max-w-xs lg:max-w-md px-5 py-4 rounded-2xl bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-lg opacity-80 border border-blue-300/30">
              <p className="text-sm leading-relaxed italic">
                {interimTranscript}
              </p>
            </div>
            <div className="p-2 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full mt-1 shadow-lg">
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start items-start space-x-2">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mt-1 shadow-lg">
              <img src="/image.png" className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white/80 backdrop-blur-sm text-gray-800 shadow-lg border border-gray-200/50 max-w-xs lg:max-w-md px-5 py-4 rounded-2xl">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input */}
      <div className="bg-white/95 backdrop-blur-md border-t border-blue-200/50 px-6 py-4 relative z-10">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl ${isListening
              ? "bg-gradient-to-r from-red-500 to-red-600 text-white scale-110 animate-pulse"
              : autoListen
                ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:scale-105"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300 hover:scale-105"
              }`}
            title={
              isListening
                ? "Stop listening"
                : autoListen
                  ? "Auto-listening enabled - Click to stop"
                  : "Start listening"
            }
          >
            {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <div className="flex-1">
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading || isProcessingMessageRef.current}
              placeholder={
                isListening
                  ? "Listening... or type here"
                  : "Type your message or use voice..."
              }
              rows={1}
              className="w-full px-4 py-3 border border-gray-300/50 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm transition-all hover:shadow-md disabled:bg-gray-50"
            />
          </div>

          <button
            onClick={() => handleUserMessage(textInput)}
            disabled={!textInput.trim() || isLoading || isProcessingMessageRef.current}
            className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Send className="w-6 h-6" />
          </button>

          <button
            onClick={isSpeaking ? stopSpeaking : undefined}
            className={`p-4 rounded-full transition-all duration-300 shadow-lg ${isSpeaking
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white animate-pulse hover:scale-105 cursor-pointer"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300 hover:scale-105 cursor-default"
              }`}
            title={isSpeaking ? "Click to stop speaking" : "Speech status"}
          >
            {isSpeaking ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-500">
            {autoListen && isListening
              ? "🎤 Listening... Speak naturally"
              : autoListen
                ? "🎤 Auto-listen enabled • Will resume after AI responds"
                : "Click mic to start listening • Type messages • Press Enter to send"}
          </p>
          {isProcessingMessageRef.current && (
            <p className="text-xs text-orange-600 mt-1">
              Processing your message...
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes wave {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default EnhancedVoiceChat;