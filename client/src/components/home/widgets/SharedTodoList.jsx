const SharedTodoList = () => {
  const sharedTodos = [
    {
      task: "Update website hero section",
      assignedTo: "Team Design",
    },
    {
      task: "Migrate database to new server",
      assignedTo: "DevOps",
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Shared To-Dos</h2>
      <ul className="space-y-3 text-sm text-gray-700">
        {sharedTodos.map((item, i) => (
          <li key={i}>
            <span className="font-medium text-gray-900">{item.task}</span>
            <span className="ml-2 text-gray-500">({item.assignedTo})</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SharedTodoList;