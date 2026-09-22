import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        // On vérifie auprès du backend si le token est toujours valide
        await api.get('/auth/me');
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.log("Token invalide ou expiré (ex: base de données réinitialisée). Déconnexion...");
      // Si on a une erreur 401, on efface l'ancien token pour forcer le login
      await AsyncStorage.multiRemove(['token', 'user']);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string, user: any) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await AsyncStorage.multiRemove(['token', 'user']);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}