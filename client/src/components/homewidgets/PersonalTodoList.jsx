const PersonalTodoList = () => {
  const todos = [
    "Finish dashboard design",
    "Reply to client feedback",
    "Plan sprint backlog",
  ];

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">My To-Do List</h2>
      <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
        {todos.map((todo, i) => (
          <li key={i}>{todo}</li>
        ))}
      </ul>
    </div>
  );
};

export default PersonalTodoList;
