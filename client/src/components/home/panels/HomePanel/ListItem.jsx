import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckSquare, Lock, Megaphone } from 'lucide-react';

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
            className={`px-3 py-2 mx-1.5 rounded-lg cursor-pointer flex items-center justify-between group transition-all duration-200 relative ${isSelectionMode && isSelected
                ? "bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                : isActive
                    ? "bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/30 dark:to-gray-900/50 text-blue-600 dark:text-blue-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
        >
            {/* Active Accent Bar */}
            {isActive && !isSelectionMode && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
            )}

            <div className="flex items-center truncate flex-1 gap-3">
                {isSelectionMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"}`}>
                        {isSelected && <CheckSquare size={10} className="text-white" />}
                    </div>
                )}

                {/* Icon/Avatar Container with Soft Backdrop */}
                <div className="flex-shrink-0 flex items-center justify-center">
                    {item.type === 'dm' ? (
                        <div className="relative">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border border-white/10 ${isActive
                                ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                                : item.avatarColor === 'green'
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                    : item.avatarColor === 'yellow'
                                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                                        : item.avatarColor === 'red'
                                            ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark: ROSE-400"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                }`}>
                                {item.label.charAt(0).toUpperCase()}
                            </div>
                            {/* Refined Status Dot */}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 shadow-sm ${item.status === "active" || item.status === "online" ? "bg-green-500" :
                                item.status === "away" ? "bg-yellow-500" :
                                    item.status === "dnd" || item.status === "busy" ? "bg-red-500" :
                                        "bg-gray-400"
                                }`}></div>
                        </div>
                    ) : (
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors border ${isActive
                                ? 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                                : item.label.toLowerCase() === 'announcements'
                                    ? 'border-orange-200 dark:border-orange-800/60 text-orange-500 dark:text-orange-400'
                                    : item.isPrivate
                                        ? 'border-purple-200 dark:border-purple-800/60 text-purple-500 dark:text-purple-400'
                                        : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 group-hover:border-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                            }`}>
                            {item.isPrivate ? (
                                <Lock size={13} strokeWidth={2.5} />
                            ) : item.label.toLowerCase() === 'announcements' ? (
                                <Megaphone size={13} strokeWidth={2.5} />
                            ) : (
                                <span className="text-sm font-bold">#</span>
                            )}
                        </div>
                    )}
                </div>

                <span className={`truncate text-sm tracking-tight transition-all ${isActive ? "font-bold text-gray-900 dark:text-white" : "font-semibold group-hover:text-gray-900 dark:group-hover:text-gray-100"}`}>
                    {item.type === 'channel' ? item.label.replace(/^#/, '') : item.label}
                </span>
            </div>

            {!isSelectionMode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                    }}
                    className={`p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 shadow-sm transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 ${item.isFavorite
                        ? "text-amber-400 opacity-100"
                        : "text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100"
                        }`}
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
