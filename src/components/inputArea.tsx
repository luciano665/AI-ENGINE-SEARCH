// components/InputArea.tsx

import React from "react";
import { ArrowUp } from "lucide-react";

type InputAreaProps = {
  message: string;
  setMessage: (msg: string) => void;
  handleSend: () => void;
  isLoading: boolean;
};

export default function InputArea({
  message,
  setMessage,
  handleSend,
  isLoading,
}: InputAreaProps) {
  return (
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
  );
}
