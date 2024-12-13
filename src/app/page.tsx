"use client";

import { useState } from "react";
import Header from "@/components/header";
import MessagesContainer from "@/components/messageContainer";
import InputArea from "@/components/inputArea";
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
      <Header onShare={handleShare} />

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto pb-32 pt-4">
        <MessagesContainer messages={messages} isLoading={isLoading} />
      </div>

      {/* Input Area */}
      <InputArea
        message={message}
        setMessage={setMessage}
        handleSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
}
