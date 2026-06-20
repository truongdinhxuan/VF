// import './App.css'
import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/auth/LoginPage";
import AdminHomePage from "./pages/admin/AdminHomePage";
import MilkrunHomepage from "./pages/milkrun/MilkrunHomepage";
import UserHomePage from "./pages/admin/users/UserHomePage";
import HomePage from "./pages/HomePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TeamLeadHomepage } from "./pages/teamlead/TeamLeadHomePage";
import { AdminLayout } from "./layouts/admin/AdminLayout";

function App() {
  return (
    <Routes>
      /*
        Index route
       */
      <Route path="/">
        <Route index element={<HomePage/>} />
      </Route>
      /**
        Authenticator route
       */
      <Route path="/auth">
        <Route path="login" index element={<LoginPage/>} />
      </Route>
      /**
        Admin route
       */
      <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}/>}>
        <Route element={<AdminLayout/>}>
          <Route index element={<AdminHomePage/>} />
          <Route path="users" element={<UserHomePage/>} />
        </Route>
      </Route>
      /**
        Milkrun route
       */
      <Route path="/milkrun" element={<ProtectedRoute allowedRoles={["milkrun"]}/>}>
        <Route index element={<MilkrunHomepage/>} />
      </Route>
      /**
        TeamLead route
       */
      <Route path="/teamlead" element={<ProtectedRoute allowedRoles={["teamlead"]}/>}>
        <Route index element={<TeamLeadHomepage/>} />
      </Route>
    </Routes>
  )
}
export default App