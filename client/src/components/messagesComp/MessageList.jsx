// components/MessageList.jsx
import { useState } from "react";

const messagesData = {
  all: [
    {
      type: "dm",
      name: "Thrishank",
      status: "Active",
    },
    {
      type: "dm",
      name: "Muzamil",
      status: "Active",
    },
    {
      type: "dm",
      name: "Preethi",
      status: "Active",
    },
    { type: "channel", name: "Design Team", status: "Active" },
    { type: "channel", name: "General", status: "Active" },
    { type: "channel", name: "Random", status: "Active" }
  ]
};

const Tabs = ["All", "Direct Messages", "Channels"];

export default function MessageList({ onSelectChat }) {
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMessages = messagesData.all.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === "All") return matchesSearch;
    if (activeTab === "Direct Messages") return item.type === "dm" && matchesSearch;
    if (activeTab === "Channels") return item.type === "channel" && matchesSearch;

    return false;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="flex w-full rounded-lg h-12 bg-[#f0f2f4]">
          <div className="flex items-center justify-center pl-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
              <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-[#f0f2f4] focus:outline-none px-4 text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#dce0e5] px-4 gap-8">
        {Tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex flex-col items-center justify-center pb-[13px] pt-4 text-sm font-bold tracking-wide ${
              activeTab === tab
                ? "text-[#111418] border-b-[3px] border-[#111418]"
                : "text-[#637488] border-b-[3px] border-transparent"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Messages List (scrollable area) */}
      <div className="flex-1 overflow-y-auto pt-4">
        {filteredMessages.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-4 px-4 py-2 min-h-[72px] hover:bg-gray-100 cursor-pointer"
            onClick={() => onSelectChat(item)}
          >
            {item.type === "dm" ? (
              <div
                className="bg-center bg-no-repeat bg-cover rounded-full h-14 w-14"
                style={{ backgroundImage: `url(${item.image})` }}
              ></div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-[#f0f2f4] w-12 h-12">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M224,88H175.4l8.47-46.57a8,8,0,0,0-15.74-2.86l-9,49.43H111.4l8.47-46.57a8,8,0,0,0-15.74-2.86L95.14,88H48a8,8,0,0,0,0,16H92.23L83.5,152H32a8,8,0,0,0,0,16H80.6l-8.47,46.57a8,8,0,0,0,6.44,9.3A7.79,7.79,0,0,0,80,224a8,8,0,0,0,7.86-6.57l9-49.43H144.6l-8.47,46.57a8,8,0,0,0,6.44,9.3A7.79,7.79,0,0,0,144,224a8,8,0,0,0,7.86-6.57l9-49.43H208a8,8,0,0,0,0-16H163.77l8.73-48H224a8,8,0,0,0,0-16Z" />
                </svg>
              </div>
            )}
            <div className="flex flex-col justify-center">
              <p className="text-[#111418] text-base font-medium line-clamp-1">{item.name}</p>
              <p className="text-[#637488] text-sm font-normal line-clamp-2">{item.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
