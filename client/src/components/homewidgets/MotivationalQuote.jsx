// src/components/MotivationalQuote.jsx
import { useEffect, useState } from "react";

const quotes = [
  "Success is not final, failure is not fatal: It is the courage to continue that counts.",
  "Your limitation—it’s only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Great things never come from comfort zones.",
  "Don’t stop when you’re tired. Stop when you’re done.",
];

const MotivationalQuote = () => {
  const [quote, setQuote] = useState("");

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setQuote(quotes[randomIndex]);
  }, []);

  return (
    <div className="bg-white shadow rounded-xl p-6 flex flex-col justify-between h-full">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">💡 Motivation</h2>
      <p className="text-gray-600 italic text-sm">{quote}</p>
    </div>
  );
};

export default MotivationalQuote;
