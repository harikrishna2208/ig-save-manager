import React from "react";
import { Button } from "../components/Button";

interface LoginScreenProps {
  onCheckSession?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onCheckSession }) => {
  const handleOpenLogin = () => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: "https://www.instagram.com/accounts/login/" });
    } else {
      window.open("https://www.instagram.com/accounts/login/", "_blank");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        padding: "30px",
        textAlign: "center",
      }}
    >
      <svg
        style={{
          width: "64px",
          height: "64px",
          color: "var(--text-muted)",
          marginBottom: "20px",
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>

      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "12px" }}>
        Login to Instagram
      </h2>
      
      <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px", maxWidth: "280px" }}>
        We couldn't detect an active Instagram session in your browser. Please log in to your account to load collections.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "200px" }}>
        <Button variant="primary" block onClick={handleOpenLogin}>
          Go to Instagram Login
        </Button>
        {onCheckSession && (
          <Button variant="secondary" block onClick={onCheckSession}>
            Verify Login Session
          </Button>
        )}
      </div>
    </div>
  );
};
