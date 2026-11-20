
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App.jsx";
import AuthGate from "./components/AuthGate.jsx";
import AcceptInvitation from "./components/AcceptInvitation.jsx";

import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth/complete"
          element={<AcceptInvitation />}
        />

        <Route
          path="/*"
          element={
            <AuthGate>
              {({ profile, onSignOut }) => (
                <App
                  profile={profile}
                  onSignOut={onSignOut}
                />
              )}
            </AuthGate>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
