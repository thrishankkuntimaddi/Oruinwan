const CalendarWidget = () => {
  const events = [
    { date: "Jul 4", event: "Independence Day - Office Closed" },
    { date: "Jul 6", event: "Design Review with Team Beta" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h2>
      <ul className="space-y-2 text-sm text-gray-700">
        {events.map((ev, i) => (
          <li key={i}>
            <span className="font-semibold text-gray-900">{ev.date}</span>: {ev.event}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CalendarWidget;
