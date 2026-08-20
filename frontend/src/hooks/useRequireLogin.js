import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";

export default function useRequireLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (action) => {
    if (!user) {
      Swal.fire({
        title: "Login Required",
        text: "Please login first to continue.",
        icon: "warning",
      }).then(() => navigate("/login"));
      return;
    }
    action(user);
  };
}
