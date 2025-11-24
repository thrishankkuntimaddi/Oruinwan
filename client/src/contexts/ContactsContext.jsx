import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ContactsContext = createContext();
export const useContacts = () => useContext(ContactsContext);

export default function ContactsProvider({ children }) {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    async function loadContacts() {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.get(`${API_BASE}/api/chat/contacts`, { headers });
        setContacts(res.data.contacts);
      } catch (err) {
        console.error("CONTACTS LOAD ERROR:", err);
      }
    }

    loadContacts();
  }, []);

  return (
    <ContactsContext.Provider value={{ contacts }}>
      {children}
    </ContactsContext.Provider>
  );
}
