const MessagePreview = () => {
  const messages = [
    {
      name: "Ethan Carter",
      message: "Hey, did you check the new Figma file?",
    },
    {
      name: "Sophia Clark",
      message: "I’ve pushed the latest code to GitHub!",
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Messages</h2>
      <ul className="space-y-3">
        {messages.map((msg, i) => (
          <li key={i} className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">{msg.name}</span>: {msg.message}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MessagePreview;

