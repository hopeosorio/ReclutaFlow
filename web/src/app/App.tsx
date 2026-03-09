import { BrowserRouter, Route, Routes } from "react-router-dom";
import RequireAuth from "@/components/RequireAuth";
import InteractiveStars from "@/components/InteractiveStars";
import ThemeToggle from "@/components/ThemeToggle";
import { AuthProvider } from "./AuthProvider";
import CrmLayout from "./layouts/CrmLayout";
import PublicLayout from "./layouts/PublicLayout";
import Apply from "./routes/Apply";
import CrmAdmin from "./routes/CrmAdmin";
import CrmApplicationDetail from "./routes/CrmApplicationDetail";
import CrmDashboard from "./routes/CrmDashboard";
import CrmInterviews from "./routes/CrmInterviews";
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";
import TrackApplication from "./routes/TrackApplication";

export default function App() {
  return (
    <AuthProvider>
      <InteractiveStars />
      <ThemeToggle />
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/track" element={<TrackApplication />} />
            <Route path="/login" element={<Login />} />
          </Route>
          <Route element={<RequireAuth roles={["rh_admin", "rh_recruiter", "interviewer"]} />}>
            <Route path="/crm" element={<CrmLayout />}>
              <Route index element={<CrmDashboard />} />
              <Route path="interviews" element={<CrmInterviews />} />
              <Route path="admin" element={<CrmAdmin />} />
              <Route path="applications/:id" element={<CrmApplicationDetail />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
