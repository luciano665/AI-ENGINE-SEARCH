"use client";

import { useState } from "react";
import Header from "@/components/header";
import { ArrowUp } from "lucide-react";

type Message = {
  role: "user" | "ai";
  content: string;
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hello! How can I help you today? 🚀" },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;

    //Validation of URL provided
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (!message.match(urlRegex)) {
      setMessages(prev => [
        ...prev,
        {
          role: "ai",
          content: "Please include a valid url",
        },
      ]);
    }

    // Add user message to the conversation
    const userMessage = { role: "user" as const, content: message };
    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: message }),
      });

      // TODO: Handle the response from the chat API to display the AI response in the UI
      if (!response.ok) {
        const errorData = await response.json();
        console.log("Error:", errorData.error || "Unexpected error");
        setMessages(prev => [
          ...prev,
          {
            role: "ai",
            content: "Oops! Something went wrong, Please try again",
          },
        ]);
        return;
      }

      const data = await response.json();

      //Add ai's response to conversation
      const aiMessage = {
        role: "ai" as const,
        content: data.answer || "Coudn't get find de answer",
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);

      setMessages(prev => [
        ...prev,
        { role: "ai", content: "An error ocurred, please try again" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  //Hanlde share
  const handleShare = () => {
    const chatContent = messages
      .map(msg => `[${msg.role}]: ${msg.content}`)
      .join("\n");
    navigator.clipboard
      .writeText(chatContent)
      .then(() => alert("Chat content copied to clipboard!"))
      .catch(() => alert("Failed to copy chat content"));
  };

  // TODO: Modify the color schemes, fonts, and UI as needed for a good user experience
  // Refer to the Tailwind CSS docs here: https://tailwindcss.com/docs/customizing-colors, and here: https://tailwindcss.com/docs/hover-focus-and-other-states
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      {/*<div className="w-full bg-black border-b border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-white">Chat</h1>
        </div>
      </div> */}
      <Header onShare={handleShare} />

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto pb-32 pt-4">
        <div className="max-w-3xl mx-auto px-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-4 mb-4 ${
                msg.role === "ai"
                  ? "justify-start"
                  : "justify-end flex-row-reverse"
              }`}
            >
              <div
                className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                  msg.role === "ai"
                    ? "bg-black border border-gray-700 text-gray-100"
                    : "bg-gray-500 text-white ml-auto"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c.79 0 1.5-.71 1.5-1.5S8.79 9 8 9s-1.5.71-1.5 1.5S7.21 11 8 11zm8 0c.79 0 1.5-.71 1.5-1.5S16.79 9 16 9s-1.5.71-1.5 1.5.71 1.5 1.5 1.5zm-4 4c2.21 0 4-1.79 4-4h-8c0 2.21 1.79 4 4 4z" />
                </svg>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-gray-800 border border-gray-700 text-gray-100">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 w-full bg-black border-t border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyPress={e => e.key === "Enter" && handleSend()}
              placeholder="Type your message..."
              className="flex-1 rounded-xl border border-gray-700 bg-gray-700 px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent placeholder-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="bg-gray-700 text-white px-5 py-3 rounded-full hover:bg-gray-500 transition-all disabled:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : ""}
              <ArrowUp />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
