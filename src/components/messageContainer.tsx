// components/MessagesContainer.tsx

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dark } from "react-syntax-highlighter/dist/cjs/styles/prism";

type Message = {
  role: "user" | "ai";
  content: string;
};

type MessagesContainerProps = {
  messages: Message[];
  isLoading: boolean;
};

export default function MessagesContainer({
  messages,
  isLoading,
}: MessagesContainerProps) {
  return (
    <div className="max-w-3xl mx-auto px-4">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex gap-4 mb-4 ${
            msg.role === "ai" ? "justify-start" : "justify-end flex-row-reverse"
          }`}
        >
          <div
            className={`px-4 py-2 rounded-2xl max-w-[80%] ${
              msg.role === "ai"
                ? "bg-black border border-gray-700 text-gray-100"
                : "bg-gray-500 text-white ml-auto"
            }`}
          >
            {msg.role === "ai" ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                  // Code blocks with syntax highlighting
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={dark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Custom heading levels if needed
                  h1: ({ ...props }) => <h2 {...props} />,
                  h2: ({ ...props }) => <h3 {...props} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              msg.content
            )}
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
  );
}
