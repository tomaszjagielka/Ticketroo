import React, { createContext, useContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { USER_ROLES } from "../config";

const AUTH_TOKEN_KEY = process.env.REACT_APP_AUTH_TOKEN_KEY;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({
          _id: decoded.userId,
          role: decodeURIComponent(decoded.role),
        });
      } catch (error) {
        console.error("Error decoding token:", error);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = (token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    const decoded = jwtDecode(token);
    setUser({
      _id: decoded.userId,
      role: decodeURIComponent(decoded.role),
    });
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
  };

  const isAdmin = () => user?.role === USER_ROLES.ADMIN;
  const isSpecialist = () => user?.role === USER_ROLES.SPECIALIST;
  const isRegularUser = () => user?.role === USER_ROLES.USER;

  const value = {
    user,
    login,
    logout,
    loading,
    isAdmin,
    isSpecialist,
    isRegularUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
