import {create} from 'zustand';
import {axiosInstance} from '../lib/axios.js';
import toast from 'react-hot-toast';
import { LogOut } from 'lucide-react';

export const useAuthStore = create((set) => ({
    authUser: null,
    isSigningUp: false, 
    isLoggingIn: false, 
    isUpdatingProfile: false,

    isCheckingAuth: true,

    checkAuth: async() => {
      try {
        const response = await axiosInstance.get('/auth/check');

        set({authUser:response.data});
      } catch (error) {
        console.error('Error checking authentication:', error);
        set({authUser: null});
      } finally {
        set({isCheckingAuth: false});
      }
    },

    signup: async(data) => {
      set({isSigningUp: true});  
      try {
          const res = await axiosInstance.post('/auth/signup', data);
          set({authUser: res.data});
          toast.success("Account created successfully!");
        } catch (error) {
          toast.error(error.response.data.message || "Failed to create account.");
          console.error('Error during signup:', error);
        } finally {
          set({isSigningUp: false});
        }
    },

    logout: async() => 
      {
        try {
          await axiosInstance.post('/auth/logout');
          set({authUser: null});
          toast.success("Logged out successfully!");
        } catch (error) {
          toast.error("Failed to log out.");
          console.error('Error during logout:', error);
        }
    }
  })); 