import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';

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
    const Icon = item.isPrivate ? "#" : (item.type === 'dm' ? "👤" : "#");
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
            className={`px-4 py-1.5 mx-2 rounded-md cursor-pointer flex items-center justify-between group transition-colors ${isSelectionMode && isSelected ? "bg-blue-50 border border-blue-200" :
                isActive ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
        >
            <div className="flex items-center truncate flex-1 gap-2">
                {isSelectionMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
                        {isSelected && <CheckSquare size={10} className="text-white" />}
                    </div>
                )}
                <span className="opacity-70 text-lg">{Icon}</span>
                <span className="truncate text-sm">{item.label}</span>
            </div>

            {!isSelectionMode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                    }}
                    className={`p-1 rounded hover:bg-gray-300 transition-all ${item.isFavorite ? "text-yellow-400 opacity-100" : "text-gray-400 opacity-0 group-hover:opacity-100"}`}
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
