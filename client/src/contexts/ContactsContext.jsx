import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ContactsContext = createContext();
export const useContacts = () => useContext(ContactsContext);

export default function ContactsProvider({ children }) {
  const [contacts, setContacts] = useState([]);

  // Initialize with mock data for now, matching HomePanel
  const [allItems, setAllItems] = useState([
    { id: 'general', type: 'channel', label: 'general', path: '/channels/general', isFavorite: true },
    { id: 'announcements', type: 'channel', label: 'announcements', path: '/channels/announcements', isFavorite: true },
    { id: 'engineering', type: 'channel', label: 'engineering', path: '/channels/engineering', isFavorite: false },
    { id: 'design', type: 'channel', label: 'design', path: '/channels/design', isFavorite: false },
    { id: 'marketing', type: 'channel', label: 'marketing', path: '/channels/marketing', isFavorite: false },
    { id: 'leadership', type: 'channel', label: 'leadership', path: '/channels/leadership', isFavorite: false, isPrivate: true },
    { id: 'random', type: 'channel', label: 'random', path: '/channels/random', isFavorite: false },
    { id: 'project-alpha', type: 'channel', label: 'project-alpha', path: '/channels/project-alpha', isFavorite: false },
    { id: 'sarah', type: 'dm', label: 'Sarah Connor', path: '/dm/sarah', isFavorite: false },
    { id: 'thrishank', type: 'dm', label: 'Thrishank', path: '/dm/john', isFavorite: false },
    { id: 'alice', type: 'dm', label: 'Alice Smith', path: '/dm/alice', isFavorite: false },
  ]);

  useEffect(() => {
    async function loadContacts() {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });
        if (res.data.contacts) {
          setContacts(res.data.contacts);
          // Optionally merge real contacts into allItems if needed
        }
      } catch (err) {
        console.error("CONTACTS LOAD ERROR:", err);
      }
    }

    loadContacts();
  }, []);

  const deleteItem = (id) => {
    setAllItems(prev => prev.filter(item => item.id !== id && item.label !== id));
  };

  const addItem = (item) => {
    setAllItems(prev => [...prev, item]);
  };

  const toggleFavorite = (id) => {
    setAllItems(prev => prev.map(item =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    ));
  };

  return (
    <ContactsContext.Provider value={{ contacts, allItems, setAllItems, deleteItem, addItem, toggleFavorite }}>
      {children}
    </ContactsContext.Provider>
  );
}
