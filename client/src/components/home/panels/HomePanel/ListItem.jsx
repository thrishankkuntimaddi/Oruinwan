import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckSquare, Lock } from 'lucide-react';

const ListItem = ({ item, isSelectionMode, selectedItems, setSelectedItems, toggleFavorite }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const currentPath = location.pathname;

    // Construct path dynamically based on Home context
    const isHome = location.pathname.includes('/home');
    const itemPath = item.type === 'channel'
        ? `/workspace/${workspaceId}${isHome ? '/home' : ''}/channel/${item.id}`
        : `/workspace/${workspaceId}${isHome ? '/home' : ''}/dm/${item.id}`;
    const isActive = currentPath === itemPath;
    const isSelected = selectedItems.has(item.id);

    const handleClick = (e) => {
        if (isSelectionMode) {
            e.stopPropagation();
            const newSelected = new Set(selectedItems);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
            } else {
                newSelected.add(item.id);
            }
            setSelectedItems(newSelected);
        } else {
            // Navigate to the item path
            navigate(itemPath);
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`px-4 py-1.5 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${isSelectionMode && isSelected ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800" :
                isActive ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium" : "hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                }`}
        >
            <div className="flex items-center truncate flex-1 gap-2">
                {isSelectionMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"}`}>
                        {isSelected && <CheckSquare size={10} className="text-white" />}
                    </div>
                )}

                {/* Channel/DM Icon or Avatar */}
                {item.type === 'dm' ? (
                    <div className="relative">
                        {/* Dynamic avatar color based on user status */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ${isActive
                            ? "bg-blue-200 text-blue-700"
                            : item.avatarColor === 'green'
                                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                : item.avatarColor === 'yellow'
                                    ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                                    : item.avatarColor === 'red'
                                        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                            }`}>
                            {item.label.charAt(0).toUpperCase()}
                        </div>
                        {/* Status Indicator */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${item.status === "active" || item.status === "online" ? "bg-green-500" :
                            item.status === "away" ? "bg-yellow-500" :
                                item.status === "dnd" || item.status === "busy" ? "bg-red-500" :
                                    "bg-gray-400"
                            }`}></div>
                    </div>
                ) : (
                    <span className="opacity-70 text-lg flex items-center">
                        {item.isPrivate ? <Lock size={16} /> : "#"}
                    </span>
                )}

                <span className="truncate text-sm">{item.type === 'channel' ? item.label.replace(/^#/, '') : item.label}</span>
            </div>

            {!isSelectionMode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                    }}
                    className={`p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all ${item.isFavorite ? "text-yellow-400 opacity-100" : "text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100"}`}
                    title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={item.isFavorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default ListItem;
